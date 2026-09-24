"""Фоновые задачи агента (деплой, сборка) с живым логом.

Control-plane запускает задачу и сразу получает id; дальше поллит
`GET /jobs/<id>` и показывает лог по мере выполнения. Задачи живут в памяти
процесса (последние 200) и дублируются в файл `${APPS_ROOT}/.jobs/<id>.log`,
чтобы вывод пережил рестарт агента.
"""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from collections import OrderedDict
from pathlib import Path
from typing import Awaitable, Callable

from app.config import settings

MAX_JOBS = 200
LogFn = Callable[[str], None]


class Job:
    def __init__(self, kind: str, meta: dict) -> None:
        self.id = uuid.uuid4().hex
        self.kind = kind
        self.meta = meta
        self.status = "queued"  # queued | running | succeeded | failed
        self.lines: list[str] = []
        self.started_at = time.time()
        self.finished_at: float | None = None
        self.result: dict | None = None
        self.error: str | None = None
        self._file = Path(settings.APPS_ROOT) / ".jobs" / f"{self.id}.log"

    def log(self, line: str) -> None:
        line = line.rstrip("\n")
        self.lines.append(line)
        try:
            self._file.parent.mkdir(parents=True, exist_ok=True)
            with self._file.open("a", encoding="utf-8") as f:
                f.write(line + "\n")
        except OSError:
            pass

    def to_dict(self, since: int = 0) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "meta": self.meta,
            "status": self.status,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "result": self.result,
            "error": self.error,
            "lines": self.lines[since:],
            "line_count": len(self.lines),
        }


_JOBS: "OrderedDict[str, Job]" = OrderedDict()


def get_job(job_id: str) -> Job | None:
    return _JOBS.get(job_id)


def start_job(kind: str, meta: dict, run: Callable[[Job], Awaitable[dict]]) -> Job:
    job = Job(kind, meta)
    _JOBS[job.id] = job
    while len(_JOBS) > MAX_JOBS:
        _JOBS.popitem(last=False)

    async def _runner() -> None:
        job.status = "running"
        try:
            job.result = await run(job)
            job.status = "succeeded" if job.result.get("ok", True) else "failed"
        except Exception as e:  # noqa: BLE001
            job.error = str(e)
            job.log(f"ERROR: {e}")
            job.status = "failed"
        finally:
            job.finished_at = time.time()

    asyncio.get_running_loop().create_task(_runner())
    return job


async def run_streaming(args: list[str], cwd: Path, log: LogFn, timeout_s: int, env: dict | None = None) -> int:
    """Запуск процесса с построчной передачей вывода в лог задачи."""
    # env дополняет окружение агента, а не заменяет его: без PATH exec не найдёт git/docker.
    proc = await asyncio.create_subprocess_exec(
        *args,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        env={**os.environ, **env} if env else None,
    )
    assert proc.stdout is not None

    async def _pump() -> None:
        while True:
            chunk = await proc.stdout.readline()
            if not chunk:
                break
            log(chunk.decode("utf-8", "replace"))

    try:
        await asyncio.wait_for(_pump(), timeout=timeout_s)
        await proc.wait()
    except asyncio.TimeoutError:
        proc.kill()
        log(f"ERROR: `{' '.join(args)}` timed out after {timeout_s}s")
        return 124
    return proc.returncode or 0
