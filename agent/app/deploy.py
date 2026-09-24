"""Исполнитель деплоя: control-plane присылает описание сервиса, агент
пишет его в compose-стек проекта и поднимает контейнер.

Почему compose, а не docker run через SDK: все приложения на сервере уже
живут стеками в /opt/apps/<name>/docker-compose.yml (Traefik, backend,
frontend, status), и владелец умеет их чинить руками. Агент лишь генерирует
тот же файл и зовёт `docker compose` — при отказе панели стек продолжает
работать и управляется как раньше.

Секреты сервиса попадают в compose открытым текстом (`environment:`) — так же,
как сегодня лежат .env рядом. Файл принадлежит root, каталог не публикуется.
"""
from __future__ import annotations

import asyncio
import re
import shutil
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from app.config import settings

NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,62}$")
COMPOSE_TIMEOUT_S = 600


class DeploySpec(BaseModel):
    project: str
    service: str
    image: str = Field(min_length=1, max_length=300)
    env: dict[str, str] = Field(default_factory=dict)
    port: int | None = None
    networks: list[str] = Field(default_factory=list)
    volumes: list[str] = Field(default_factory=list)
    labels: dict[str, str] = Field(default_factory=dict)
    command: str | None = None
    restart: str = "unless-stopped"


class RemoveSpec(BaseModel):
    project: str
    service: str


class DeployError(Exception):
    pass


def _check_name(value: str, what: str) -> str:
    if not NAME_RE.match(value):
        raise DeployError(f"invalid {what}: {value!r}")
    return value


def _compose_path(project: str) -> Path:
    root = Path(settings.APPS_ROOT)
    return root / project / "docker-compose.yml"


def _load(path: Path) -> dict:
    if not path.exists():
        return {"services": {}}
    data = yaml.safe_load(path.read_text()) or {}
    data.setdefault("services", {})
    return data


def _save(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".yml.tmp")
    tmp.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True))
    tmp.replace(path)


def _existing_networks(names: list[str]) -> tuple[list[str], list[str]]:
    """Внешние сети, которых нет на хосте, compose не поднимет — отбрасываем их с предупреждением."""
    if not names:
        return [], []
    try:
        import docker  # noqa: WPS433

        client = docker.DockerClient(base_url=settings.DOCKER_SOCKET) if settings.DOCKER_SOCKET else docker.from_env()
        present = {n.name for n in client.networks.list()}
    except Exception:  # noqa: BLE001
        present = set()
    ok = [n for n in names if n in present]
    missing = [n for n in names if n not in present]
    return ok, missing


def _container_name(project: str, service: str) -> str:
    return f"{project}-{service}"


def _render_service(spec: DeploySpec, networks: list[str]) -> dict:
    svc: dict = {
        "image": spec.image,
        "container_name": _container_name(spec.project, spec.service),
        "restart": spec.restart,
    }
    if spec.env:
        svc["environment"] = dict(spec.env)
    if spec.command:
        svc["command"] = spec.command
    if spec.volumes:
        svc["volumes"] = list(spec.volumes)
    if spec.labels:
        svc["labels"] = [f"{k}={v}" for k, v in spec.labels.items()]
    if networks:
        svc["networks"] = ["default", *networks]
    if spec.port and not spec.labels:
        # Без Traefik-лейблов сервис публикуем на localhost — иначе до него не добраться.
        svc["ports"] = [f"127.0.0.1:{spec.port}:{spec.port}"]
    return svc


async def _run(args: list[str], cwd: Path) -> tuple[int, str]:
    proc = await asyncio.create_subprocess_exec(
        *args,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=COMPOSE_TIMEOUT_S)
    except asyncio.TimeoutError:
        proc.kill()
        raise DeployError(f"`{' '.join(args)}` timed out after {COMPOSE_TIMEOUT_S}s")
    return proc.returncode or 0, out.decode("utf-8", "replace")


def _compose_cmd() -> list[str]:
    if shutil.which("docker") is None:
        raise DeployError("docker CLI is not installed in the agent")
    return ["docker", "compose"]


def _container_state(name: str) -> dict | None:
    try:
        import docker  # noqa: WPS433

        client = docker.DockerClient(base_url=settings.DOCKER_SOCKET) if settings.DOCKER_SOCKET else docker.from_env()
        c = client.containers.get(name)
        health = (c.attrs.get("State", {}).get("Health") or {}).get("Status")
        return {
            "name": c.name,
            "status": c.status,
            "health": health,
            "image": ",".join(c.image.tags) if c.image.tags else c.image.short_id,
            "started_at": c.attrs.get("State", {}).get("StartedAt"),
        }
    except Exception:  # noqa: BLE001
        return None


async def deploy(spec: DeploySpec) -> dict:
    _check_name(spec.project, "project")
    _check_name(spec.service, "service")
    networks, missing = _existing_networks(spec.networks)

    path = _compose_path(spec.project)
    data = _load(path)
    data["services"][spec.service] = _render_service(spec, networks)
    if networks:
        nets = data.setdefault("networks", {})
        for n in networks:
            nets[n] = {"external": True}
    _save(path, data)

    cmd = [*_compose_cmd(), "-f", str(path), "-p", spec.project, "up", "-d", "--pull", "always", spec.service]
    code, out = await _run(cmd, path.parent)
    warnings = [f"network {n} not found on host — skipped" for n in missing]
    return {
        "ok": code == 0,
        "output": "\n".join([*warnings, out.strip()]).strip(),
        "compose_path": str(path),
        "container": _container_state(_container_name(spec.project, spec.service)),
    }


async def remove(spec: RemoveSpec) -> dict:
    _check_name(spec.project, "project")
    _check_name(spec.service, "service")
    path = _compose_path(spec.project)
    data = _load(path)
    if spec.service not in data["services"]:
        return {"ok": True, "output": "service not in compose — nothing to do"}
    cmd = [*_compose_cmd(), "-f", str(path), "-p", spec.project, "rm", "-sf", spec.service]
    code, out = await _run(cmd, path.parent)
    del data["services"][spec.service]
    _save(path, data)
    return {"ok": code == 0, "output": out.strip()}


async def stack(project: str) -> dict:
    _check_name(project, "project")
    path = _compose_path(project)
    data = _load(path)
    services = []
    for name, svc in data["services"].items():
        services.append(
            {
                "name": name,
                "image": svc.get("image"),
                "container": _container_state(svc.get("container_name") or _container_name(project, name)),
            }
        )
    return {"project": project, "compose_path": str(path), "exists": path.exists(), "services": services}
