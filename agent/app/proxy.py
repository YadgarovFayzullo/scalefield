"""Кто держит 80/443 на сервере и замена его на Traefik.

Домены и HTTPS сервисов Scalefield живут на лейблах Traefik (сеть `edge`,
entrypoint `websecure`, resolver `le`), а Analytics/Logs читают его JSON
access-log. Если порты занял nginx, Caddy или свой Traefik вне `edge`, агент
работает, но деплой с доменом — нет. Панель показывает это на странице
сервера и предлагает починить одной кнопкой:

- свой Traefik не в `edge` → подключаем его к сети (ничего не останавливаем);
- чужой прокси → останавливаем его (контейнер: restart=no + stop; хост:
  systemctl disable --now через nsenter) и поднимаем наш Traefik. Не
  поднялся — возвращаем прежний прокси как был.

Compose Traefik присылает control-plane (src/lib/agent-install.ts) — один
источник правды и для установки, и для замены.
"""
from __future__ import annotations

import re
from pathlib import Path

from pydantic import BaseModel, Field

from app.config import settings
from app.jobs import Job, run_streaming

PORTS = {"80", "443"}
# Имена процессов прокси на хосте (без контейнера) — чтобы назвать виновника
# и остановить его службой с тем же именем.
HOST_PROXIES = ("nginx", "caddy", "apache2", "httpd", "haproxy", "traefik", "lighttpd", "envoy")
SERVICE_RE = re.compile(r"^[a-z0-9][a-z0-9@._-]{0,62}$")
JOB_TIMEOUT_S = 300


class ReplaceSpec(BaseModel):
    traefik_compose: str = Field(min_length=1, max_length=20_000)


def _client():
    import docker  # noqa: WPS433 — без сокета библиотека не нужна

    return docker.DockerClient(base_url=settings.DOCKER_SOCKET, timeout=10)


def _container_holders() -> list[dict]:
    """Контейнеры, опубликовавшие 80/443 (или сетевой режим host с прокси внутри)."""
    out = []
    for c in _client().containers.list():
        image = (c.attrs.get("Config") or {}).get("Image") or ""
        net = c.attrs.get("NetworkSettings") or {}
        published = set()
        for binds in (net.get("Ports") or {}).values():
            for b in binds or []:
                if b.get("HostPort") in PORTS:
                    published.add(b["HostPort"])
        host_mode = (c.attrs.get("HostConfig") or {}).get("NetworkMode") == "host"
        if published or (host_mode and any(p in image.lower() for p in HOST_PROXIES)):
            out.append(
                {
                    "type": "container",
                    "name": c.name,
                    "image": image,
                    "networks": sorted((net.get("Networks") or {}).keys()),
                    "traefik": "traefik" in image.lower(),
                    "restart": ((c.attrs.get("HostConfig") or {}).get("RestartPolicy") or {}).get("Name") or "no",
                }
            )
    return out


def _proc_root() -> Path:
    return Path(settings.PROC_ROOT or "/proc")


def _host_listening() -> bool:
    """Слушает ли кто-то 80/443 в сетевом пространстве хоста (/proc/1/net/tcp*)."""
    want = {f"{int(p):04X}" for p in PORTS}
    for name in ("tcp", "tcp6"):
        f = _proc_root() / "1" / "net" / name
        try:
            lines = f.read_text().splitlines()[1:]
        except OSError:
            continue
        for line in lines:
            parts = line.split()
            if len(parts) > 3 and parts[3] == "0A" and parts[1].rsplit(":", 1)[-1] in want:
                return True
    return False


def _host_proxy_process() -> str | None:
    for comm in _proc_root().glob("[0-9]*/comm"):
        try:
            name = comm.read_text().strip()
        except OSError:
            continue
        if name in HOST_PROXIES:
            return name
    return None


def _managed() -> Path:
    return Path(settings.APPS_ROOT) / "traefik" / "docker-compose.yml"


def detect() -> dict:
    """Состояние 80/443: `ok` — домены Scalefield работают."""
    holders = _container_holders()
    traefik = next((h for h in holders if h["traefik"]), None)
    other = next((h for h in holders if not h["traefik"]), None)
    base = {"managed": _managed().exists()}
    if traefik and not other:
        on_edge = "edge" in traefik["networks"]
        return {**base, "ok": on_edge, "kind": "traefik", "holder": traefik, "action": None if on_edge else "attach"}
    if other:
        return {**base, "ok": False, "kind": "other", "holder": other, "action": "replace"}
    if _host_listening():
        proc = _host_proxy_process()
        holder = {"type": "host", "name": proc or "unknown process", "service": proc}
        if proc == "traefik":
            return {**base, "ok": False, "kind": "traefik", "holder": holder, "action": None}
        return {**base, "ok": False, "kind": "other", "holder": holder, "action": "replace" if proc else None}
    return {**base, "ok": False, "kind": "none", "holder": None, "action": "install"}


async def _docker(job: Job, *args: str) -> int:
    job.log("$ docker " + " ".join(args))
    return await run_streaming(["docker", *args], Path("/"), job.log, JOB_TIMEOUT_S)


async def _host_service(job: Job, service: str, enable: bool) -> int:
    """systemctl на хосте: агент в контейнере, поэтому через nsenter в PID 1."""
    if not SERVICE_RE.match(service):
        job.log(f"ERROR: bad service name {service!r}")
        return 1
    cmd = f"systemctl {'enable' if enable else 'disable'} --now {service} || service {service} {'start' if enable else 'stop'}"
    return await _docker(job, "run", "--rm", "--privileged", "--pid=host", "alpine:3", "nsenter", "-t", "1", "-m", "-u", "-i", "-n", "-p", "--", "sh", "-c", cmd)


def run_fix_job(spec: ReplaceSpec):
    async def run(job: Job) -> dict:
        state = detect()
        job.log(f"==> Ports 80/443: {state['kind']}" + (f" ({state['holder']['name']})" if state["holder"] else ""))
        action = state["action"]
        if state["ok"]:
            job.log("==> Already fine — Traefik on the edge network holds 80/443")
            return {"ok": True}
        if action is None:
            raise RuntimeError("Can't fix this automatically — free ports 80/443 by hand and press the button again")

        if await _docker(job, "network", "inspect", "edge") != 0:
            if await _docker(job, "network", "create", "edge") != 0:
                raise RuntimeError("Could not create the docker network edge")

        holder = state["holder"]
        if action == "attach":
            job.log(f"==> Attaching {holder['name']} to the edge network")
            if await _docker(job, "network", "connect", "edge", holder["name"]) != 0:
                raise RuntimeError("docker network connect failed")
            job.log("==> Done. Project domains go through your Traefik now")
            return {"ok": True}

        stopped: dict | None = None
        if action == "replace":
            if holder["type"] == "container":
                job.log(f"==> Stopping {holder['name']} ({holder['image']}) and disabling its restart")
                await _docker(job, "update", "--restart=no", holder["name"])
                if await _docker(job, "stop", holder["name"]) != 0:
                    raise RuntimeError(f"Could not stop {holder['name']}")
            else:
                job.log(f"==> Stopping the {holder['service']} service on the host")
                if await _host_service(job, holder["service"], enable=False) != 0:
                    raise RuntimeError(f"Could not stop {holder['service']}")
            stopped = holder

        job.log("==> Starting Traefik (Let's Encrypt, JSON access log)")
        compose = _managed()
        (compose.parent / "letsencrypt").mkdir(parents=True, exist_ok=True)
        Path("/var/log/traefik").mkdir(parents=True, exist_ok=True)
        compose.write_text(spec.traefik_compose, encoding="utf-8")
        code = await run_streaming(["docker", "compose", "-f", str(compose), "up", "-d"], compose.parent, job.log, JOB_TIMEOUT_S)
        if code == 0:
            job.log("==> Traefik is up. Project domains and HTTPS work now")
            return {"ok": True}

        # Не поднялся — возвращаем как было, чтобы сайты не легли.
        job.log("ERROR: Traefik did not start — restoring the previous proxy")
        await run_streaming(["docker", "compose", "-f", str(compose), "down"], compose.parent, job.log, JOB_TIMEOUT_S)
        if stopped and stopped["type"] == "container":
            await _docker(job, "update", f"--restart={stopped['restart']}", stopped["name"])
            await _docker(job, "start", stopped["name"])
        elif stopped:
            await _host_service(job, stopped["service"], enable=True)
        return {"ok": False}

    return run
