"""Исполнитель деплоя и сборки: control-plane присылает описание сервиса,
агент пишет его в compose-стек проекта и поднимает контейнер; для сборки —
клонирует репозиторий, собирает образ и деплоит его.

Почему compose, а не docker run через SDK: все приложения на сервере уже
живут стеками в /opt/apps/<name>/docker-compose.yml (Traefik, backend,
frontend, status), и владелец умеет их чинить руками. Агент лишь генерирует
тот же файл и зовёт `docker compose` — при отказе панели стек продолжает
работать и управляется как раньше.

Секреты сервиса попадают в compose открытым текстом (`environment:`) — так же,
как сегодня лежат .env рядом. Файл принадлежит root, каталог не публикуется.

Сборка идёт на том же хосте (образ остаётся локальным, реестр не нужен —
модель Dokku/Coolify). Для слабых серверов билдером может стать другой
сервер с агентом: control-plane тогда шлёт `/jobs/build` туда и пушит образ
в реестр — это следующий шаг.
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from app.config import settings
from app.jobs import Job, LogFn, run_streaming

NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,62}$")
COMPOSE_TIMEOUT_S = 600
BUILD_TIMEOUT_S = 1800


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


class BuildSpec(BaseModel):
    """Сборка из Git и деплой результата. `repo_url` может содержать токен —
    в лог он не попадает."""

    repo_url: str = Field(min_length=1, max_length=500)
    ref: str = Field(default="main", max_length=200)
    dockerfile: str = Field(default="Dockerfile", max_length=200)
    context: str = Field(default=".", max_length=200)
    build_args: dict[str, str] = Field(default_factory=dict)
    deploy: DeploySpec


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
    return Path(settings.APPS_ROOT) / project / "docker-compose.yml"


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


def _docker_client():
    import docker  # noqa: WPS433

    return docker.DockerClient(base_url=settings.DOCKER_SOCKET) if settings.DOCKER_SOCKET else docker.from_env()


def _existing_networks(names: list[str]) -> tuple[list[str], list[str]]:
    """Внешние сети, которых нет на хосте, compose не поднимет — отбрасываем их с предупреждением."""
    if not names:
        return [], []
    try:
        present = {n.name for n in _docker_client().networks.list()}
    except Exception:  # noqa: BLE001
        present = set()
    return [n for n in names if n in present], [n for n in names if n not in present]


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


def _compose_cmd() -> list[str]:
    if shutil.which("docker") is None:
        raise DeployError("docker CLI is not installed in the agent")
    return ["docker", "compose"]


def _container_state(name: str) -> dict | None:
    try:
        c = _docker_client().containers.get(name)
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


async def deploy(spec: DeploySpec, log: LogFn, pull: bool = True) -> dict:
    _check_name(spec.project, "project")
    _check_name(spec.service, "service")
    networks, missing = _existing_networks(spec.networks)
    for n in missing:
        log(f"warning: network {n} not found on host — skipped")

    path = _compose_path(spec.project)
    data = _load(path)
    data["services"][spec.service] = _render_service(spec, networks)
    if networks:
        nets = data.setdefault("networks", {})
        for n in networks:
            nets[n] = {"external": True}
    _save(path, data)
    log(f"compose: {path}")

    cmd = [*_compose_cmd(), "-f", str(path), "-p", spec.project, "up", "-d"]
    if pull:
        cmd += ["--pull", "always"]
    cmd.append(spec.service)
    log(f"$ {' '.join(cmd)}")
    code = await run_streaming(cmd, path.parent, log, COMPOSE_TIMEOUT_S)
    container = _container_state(_container_name(spec.project, spec.service))
    if container:
        log(f"container {container['name']}: {container['status']}")
    return {"ok": code == 0, "compose_path": str(path), "container": container, "image": spec.image}


def _redact(url: str) -> str:
    return re.sub(r"//[^/@]+@", "//***@", url)


async def build_and_deploy(spec: BuildSpec, log: LogFn) -> dict:
    d = spec.deploy
    _check_name(d.project, "project")
    _check_name(d.service, "service")
    if ".." in spec.dockerfile or ".." in spec.context or spec.context.startswith("/"):
        raise DeployError("dockerfile/context must be inside the repository")
    if not re.match(r"^[A-Za-z0-9._/\-]{1,200}$", spec.ref):
        raise DeployError("invalid ref")

    workdir = Path(settings.APPS_ROOT) / ".builds" / d.project / d.service
    if workdir.exists():
        shutil.rmtree(workdir)
    workdir.parent.mkdir(parents=True, exist_ok=True)

    if shutil.which("git") is None:
        raise DeployError("git is not installed in the agent")
    log(f"$ git clone --depth 1 --branch {spec.ref} {_redact(spec.repo_url)} {workdir.name}")
    code = await run_streaming(
        ["git", "clone", "--depth", "1", "--branch", spec.ref, spec.repo_url, str(workdir)],
        workdir.parent,
        log,
        600,
        env={"GIT_TERMINAL_PROMPT": "0"},
    )
    if code != 0:
        return {"ok": False, "stage": "clone"}
    sha = ""
    try:
        head = (workdir / ".git" / "HEAD").read_text().strip()
        ref_file = workdir / ".git" / head.split(" ", 1)[1] if head.startswith("ref:") else None
        sha = ref_file.read_text().strip() if ref_file and ref_file.exists() else head
    except OSError:
        pass
    if sha:
        log(f"commit {sha[:12]}")

    context = (workdir / spec.context).resolve()
    dockerfile = (context / spec.dockerfile).resolve() if not spec.dockerfile.startswith("/") else Path(spec.dockerfile)
    if not str(context).startswith(str(workdir.resolve())) or not str(dockerfile).startswith(str(workdir.resolve())):
        raise DeployError("dockerfile/context must be inside the repository")
    if not dockerfile.exists():
        log(f"ERROR: {spec.dockerfile} not found in {spec.context}")
        return {"ok": False, "stage": "build", "sha": sha}

    cmd = ["docker", "build", "-f", str(dockerfile), "-t", d.image]
    for k, v in spec.build_args.items():
        cmd += ["--build-arg", f"{k}={v}"]
    cmd.append(str(context))
    log(f"$ docker build -f {spec.dockerfile} -t {d.image} {spec.context}")
    code = await run_streaming(cmd, context, log, BUILD_TIMEOUT_S, env={"DOCKER_BUILDKIT": "1"})
    if code != 0:
        return {"ok": False, "stage": "build", "sha": sha}

    result = await deploy(d, log, pull=False)
    result["sha"] = sha
    result["stage"] = "deploy"
    return result


async def remove(spec: RemoveSpec) -> dict:
    _check_name(spec.project, "project")
    _check_name(spec.service, "service")
    path = _compose_path(spec.project)
    data = _load(path)
    if spec.service not in data["services"]:
        return {"ok": True, "output": "service not in compose — nothing to do"}
    lines: list[str] = []
    cmd = [*_compose_cmd(), "-f", str(path), "-p", spec.project, "rm", "-sf", spec.service]
    code = await run_streaming(cmd, path.parent, lines.append, COMPOSE_TIMEOUT_S)
    del data["services"][spec.service]
    _save(path, data)
    return {"ok": code == 0, "output": "\n".join(lines).strip()}


async def stack(project: str) -> dict:
    _check_name(project, "project")
    path = _compose_path(project)
    data = _load(path)
    services = [
        {
            "name": name,
            "image": svc.get("image"),
            "container": _container_state(svc.get("container_name") or _container_name(project, name)),
        }
        for name, svc in data["services"].items()
    ]
    return {"project": project, "compose_path": str(path), "exists": path.exists(), "services": services}


def run_deploy_job(spec: DeploySpec):
    async def _run(job: Job) -> dict:
        return await deploy(spec, job.log)

    return _run


def run_build_job(spec: BuildSpec):
    async def _run(job: Job) -> dict:
        return await build_and_deploy(spec, job.log)

    return _run
