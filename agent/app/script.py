"""Деплой скриптом из репозитория — для приложений со своим compose-стеком.

Не все проекты укладываются в «один образ = один сервис»: у QRTifact свой
`docker-compose.prod.yml` (api + worker + db + redis) и миграция перед
перезапуском. Для них агент делает то, что раньше делал CI по SSH:

  1. клонирует нужный коммит в `${APPS_ROOT}/.builds/<app>/<job>`;
  2. зеркалит дерево в `${APPS_ROOT}/<app>` (лишнее удаляет), не трогая файлы,
     которые живут только на сервере (`.env`, `.env.*` и пути из `keep`);
  3. запускает команду деплоя из репозитория (обычно `bash scripts/deploy.sh`)
     в каталоге приложения — её вывод построчно уходит в лог задачи.

Одновременно для одного приложения идёт только один деплой: следующий ждёт.
"""
from __future__ import annotations

import asyncio
import filecmp
import fnmatch
import os
import re
import shutil
from pathlib import Path

from pydantic import BaseModel, Field

from app.config import settings
from app.deploy import BUILD_TIMEOUT_S, NAME_RE, DeployError, _redact
from app.jobs import Job, LogFn, run_streaming

DEFAULT_KEEP = [".env", ".env.*"]
SHA_RE = re.compile(r"^[0-9a-f]{7,40}$")
REF_RE = re.compile(r"^[A-Za-z0-9._/\-]{1,200}$")

_locks: dict[str, asyncio.Lock] = {}


class ScriptSpec(BaseModel):
    """`repo_url` может содержать токен — в лог он не попадает."""

    repo_url: str = Field(min_length=1, max_length=500)
    ref: str = Field(default="main", max_length=200)
    sha: str | None = Field(default=None, max_length=40)
    # Каталог приложения внутри APPS_ROOT (имя, не путь).
    app_dir: str
    command: str = Field(min_length=1, max_length=500)
    # Дополнительные пути (glob относительно каталога приложения), которые не
    # перезаписываются и не удаляются при зеркалировании.
    keep: list[str] = Field(default_factory=list)


def _kept(rel: str, patterns: list[str]) -> bool:
    name = rel.rsplit("/", 1)[-1]
    for p in patterns:
        if fnmatch.fnmatch(rel, p) or fnmatch.fnmatch(name, p) or rel.startswith(p.rstrip("/") + "/"):
            return True
    return False


def mirror(src: Path, dst: Path, keep: list[str]) -> dict:
    """Сделать `dst` копией `src` (без .git), не трогая защищённые пути."""
    patterns = DEFAULT_KEEP + keep
    dst.mkdir(parents=True, exist_ok=True)
    wanted: set[str] = set()
    copied = 0
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d != ".git"]
        rel_root = os.path.relpath(root, src)
        for name in files:
            rel = name if rel_root == "." else f"{rel_root}/{name}"
            wanted.add(rel)
            if _kept(rel, patterns):
                continue
            s, d = src / rel, dst / rel
            if d.is_dir() and not d.is_symlink():
                shutil.rmtree(d)
            if d.exists() and not d.is_symlink() and filecmp.cmp(s, d, shallow=False):
                continue
            d.parent.mkdir(parents=True, exist_ok=True)
            if d.is_symlink():
                d.unlink()
            shutil.copy2(s, d, follow_symlinks=False)
            copied += 1

    removed: list[str] = []
    for root, dirs, files in os.walk(dst, topdown=False):
        rel_root = os.path.relpath(root, dst)
        for name in files:
            rel = name if rel_root == "." else f"{rel_root}/{name}"
            if rel not in wanted and not _kept(rel, patterns):
                (dst / rel).unlink()
                removed.append(rel)
        if rel_root != "." and not _kept(rel_root, patterns):
            try:
                os.rmdir(root)  # только пустые
            except OSError:
                pass
    return {"copied": copied, "removed": removed}


async def _git(args: list[str], cwd: Path, log: LogFn) -> int:
    return await run_streaming(["git", *args], cwd, log, 600, env={"GIT_TERMINAL_PROMPT": "0"})


def validate(spec: ScriptSpec) -> None:
    if not NAME_RE.match(spec.app_dir):
        raise DeployError(f"invalid app dir: {spec.app_dir!r}")
    if not REF_RE.match(spec.ref):
        raise DeployError("invalid ref")
    if spec.sha and not SHA_RE.match(spec.sha):
        raise DeployError("invalid sha")
    for p in spec.keep:
        if p.startswith("/") or ".." in p.split("/"):
            raise DeployError(f"keep paths must be inside the app dir: {p!r}")
    if shutil.which("git") is None:
        raise DeployError("git is not installed in the agent")


async def run_script(spec: ScriptSpec, job: Job) -> dict:
    log = job.log
    validate(spec)
    root = Path(settings.APPS_ROOT)
    app_path = root / spec.app_dir
    lock = _locks.setdefault(spec.app_dir, asyncio.Lock())
    if lock.locked():
        log(f"waiting for the previous deploy of {spec.app_dir} to finish…")
    async with lock:
        workdir = root / ".builds" / spec.app_dir / job.id
        workdir.parent.mkdir(parents=True, exist_ok=True)
        try:
            log(f"==> clone {_redact(spec.repo_url)} @ {spec.sha[:12] if spec.sha else spec.ref}")
            if await _git(["clone", "--depth", "1", "--branch", spec.ref, spec.repo_url, str(workdir)], workdir.parent, log) != 0:
                return {"ok": False, "stage": "clone"}
            if spec.sha:
                head = (await asyncio.to_thread(_head_sha, workdir)) or ""
                if not head.startswith(spec.sha):
                    if await _git(["fetch", "--depth", "1", "origin", spec.sha], workdir, log) != 0:
                        return {"ok": False, "stage": "clone"}
                    if await _git(["checkout", "--quiet", "--detach", spec.sha], workdir, log) != 0:
                        return {"ok": False, "stage": "clone"}
            sha = await asyncio.to_thread(_head_sha, workdir)
            log(f"commit {sha[:12] if sha else '?'}")

            log(f"==> sync code into {app_path}")
            stats = await asyncio.to_thread(mirror, workdir, app_path, spec.keep)
            log(f"{stats['copied']} file(s) updated, {len(stats['removed'])} removed; kept {', '.join(DEFAULT_KEEP + spec.keep)}")
            for rel in stats["removed"][:20]:
                log(f"  removed {rel}")
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

        log(f"$ {spec.command}")
        code = await run_streaming(
            ["bash", "-c", spec.command],
            app_path,
            log,
            BUILD_TIMEOUT_S,
            env={"SCALEFIELD_REF": spec.ref, "SCALEFIELD_SHA": sha or ""},
        )
        if code != 0:
            log(f"ERROR: deploy command exited with code {code}")
        return {"ok": code == 0, "stage": "deploy", "sha": sha}


def _head_sha(repo: Path) -> str:
    try:
        head = (repo / ".git" / "HEAD").read_text().strip()
        if not head.startswith("ref:"):
            return head
        ref_file = repo / ".git" / head.split(" ", 1)[1]
        if ref_file.exists():
            return ref_file.read_text().strip()
        packed = repo / ".git" / "packed-refs"
        if packed.exists():
            for line in packed.read_text().splitlines():
                if line.endswith(head.split(" ", 1)[1]):
                    return line.split(" ", 1)[0]
    except OSError:
        pass
    return ""


def run_script_job(spec: ScriptSpec):
    async def _run(job: Job) -> dict:
        return await run_script(spec, job)

    return _run
