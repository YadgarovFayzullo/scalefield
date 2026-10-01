"""Агент Scalefield на сервере проекта.

Метрики: сервер (psutil/docker), Postgres (pg_stat_*), контент (SQL),
HTTP-трафик (лог прокси), логи контейнеров. Деплой: control-plane присылает
описание сервиса, агент пишет compose-стек и поднимает контейнер
(app/deploy.py). Всё под токеном, кроме /healthz.
"""
from __future__ import annotations

import asyncio
import time

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.collectors.api_traffic import collect_access_logs, collect_api_traffic
from app.collectors.visitors import collect_visitors
from app.collectors.content import collect_content
from app.collectors.database import collect_database
from app.collectors.server import collect_container_logs, collect_server
from app.config import settings
from app.deploy import (
    BuildSpec,
    DeployError,
    DeploySpec,
    RemoveSpec,
    remove as run_remove,
    run_build_job,
    run_deploy_job,
    stack as read_stack,
)
from app.jobs import get_job, start_job
from app.proxy import ReplaceSpec, detect as detect_proxy, run_fix_job as run_proxy_fix_job
from app.db import close_pool, get_pool
from app.dbproxy import router as db_router
from app.security import require_token
from app.tunnel import start_tunnel, stop_tunnel

app = FastAPI(title="researcher.uz status", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_STARTED_AT = time.time()

# База проекта для редактора таблиц / SQL / схемы (app/dbproxy.py) — под тем же токеном.
app.include_router(db_router, dependencies=[Depends(require_token)])


@app.on_event("startup")
async def _startup() -> None:
    # Обратный туннель к relay (если задан SCALEFIELD_RELAY_URL) — агент сам
    # подключается к control-plane, входящих портов у него нет.
    start_tunnel(app)


@app.on_event("shutdown")
async def _shutdown() -> None:
    await stop_tunnel()
    await close_pool()


@app.get("/healthz")
async def healthz() -> dict:
    """Liveness без токена — для healthcheck контейнера."""
    return {"ok": True, "uptime_s": int(time.time() - _STARTED_AT)}


class DbTarget(BaseModel):
    """База проекта для метрик. `url = None` — у проекта базы нет."""

    url: str | None = None


def _hosts(hosts: str) -> tuple[str, ...] | None:
    return tuple(h.strip() for h in hosts.split(",") if h.strip()) or None


async def _summary(dsn: str | None, include_db: bool) -> dict:
    """Компактная сводка для верхней плашки дашборда: всё живо/нет + ключевое."""
    out: dict = {"ts": int(time.time()), "api_uptime_s": int(time.time() - _STARTED_AT)}

    # Сервер
    try:
        srv = await collect_server()
        out["server"] = {
            "cpu_pct": srv["cpu_pct"],
            "mem_pct": srv["mem"]["pct"],
            "disk_pct": srv["disk"]["pct"],
            "uptime_s": srv["uptime_s"],
            "containers": [
                {"name": c["name"], "status": c["status"], "health": c["health"]}
                for c in srv.get("containers", [])
            ],
        }
        out["server_ok"] = True
    except Exception as e:  # noqa: BLE001
        out["server_ok"] = False
        out["server_error"] = str(e)

    # БД проекта. Нет базы — не «упала», а «не подключена» (db_ok = None).
    if not include_db:
        out["db_ok"] = None
        out["healthy"] = out.get("server_ok", False)
        return out
    try:
        pool = await get_pool(dsn)
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
            size = await conn.fetchval("SELECT pg_size_pretty(pg_database_size(current_database()))")
            conns = await conn.fetchval(
                "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
            )
        out["db_ok"] = True
        out["db"] = {"size_pretty": size, "connections": conns}
    except Exception as e:  # noqa: BLE001
        out["db_ok"] = False
        out["db_error"] = str(e)

    out["healthy"] = out.get("server_ok", False) and out.get("db_ok", False)
    return out


@app.get("/status/summary", dependencies=[Depends(require_token)])
async def summary() -> dict:
    return await _summary(None, True)


@app.post("/status/summary", dependencies=[Depends(require_token)])
async def summary_for(target: DbTarget) -> dict:
    """Сводка для проекта: база — та, что прислал control-plane (или никакой)."""
    return await _summary(target.url, target.url is not None)


@app.get("/status/server", dependencies=[Depends(require_token)])
async def server() -> dict:
    return await collect_server()


@app.get("/status/database", dependencies=[Depends(require_token)])
async def database() -> dict:
    return await collect_database()


@app.post("/status/database", dependencies=[Depends(require_token)])
async def database_for(target: DbTarget) -> dict:
    """Метрики базы проекта по строке подключения из control-plane."""
    if not target.url:
        raise HTTPException(status_code=400, detail="url required")
    try:
        return await collect_database(target.url)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"database: {e}") from e


@app.get("/status/visitors", dependencies=[Depends(require_token)])
async def visitors(
    days: int = Query(7, ge=1, le=30),
    hosts: str = Query(""),
) -> dict:
    """Посетители, просмотры страниц, bounce rate, топ страниц/источников,
    устройства — за `days` дней (по умолчанию неделя, как в Vercel Analytics).
    `hosts` — список через запятую, чтобы на общем сервере проект видел
    только свой трафик (тот же принцип, что и `/status/logs?host=`)."""
    return await collect_visitors(days, _hosts(hosts))


@app.get("/status/api", dependencies=[Depends(require_token)])
async def api_traffic(hosts: str = Query("")) -> dict:
    """HTTP-трафик по access-логу прокси; `hosts` — домены проекта через запятую."""
    return await collect_api_traffic(_hosts(hosts))


@app.get("/status/content", dependencies=[Depends(require_token)])
async def content() -> dict:
    return await collect_content()


@app.get("/status/logs", dependencies=[Depends(require_token)])
async def access_logs(
    limit: int = Query(200, ge=1, le=1000),
    level: str = Query("all", pattern="^(all|warn|error)$"),
    host: str = Query(""),
    hosts: str = Query(""),
) -> dict:
    """Последние записи access-лога прокси (новые первыми). `hosts` — домены
    проекта (обязательный срез на общем сервере), `host` — фильтр внутри них."""
    return await collect_access_logs(limit=limit, level=level, host=host, hosts=_hosts(hosts))


@app.get("/status/container-logs", dependencies=[Depends(require_token)])
async def container_logs(
    name: str = Query(..., min_length=1, max_length=120),
    tail: int = Query(200, ge=1, le=1000),
) -> dict:
    """Хвост stdout/stderr контейнера через docker.sock."""
    return await collect_container_logs(name=name, tail=tail)


# ---------- деплой и сборка (фоновые задачи с живым логом) ----------


@app.post("/jobs/deploy", dependencies=[Depends(require_token)])
async def job_deploy(spec: DeploySpec) -> dict:
    """Записать сервис в compose-стек проекта и поднять его (`up -d --pull always`)."""
    try:
        job = start_job("deploy", {"project": spec.project, "service": spec.service, "image": spec.image}, run_deploy_job(spec))
    except DeployError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return job.to_dict()


@app.post("/jobs/build", dependencies=[Depends(require_token)])
async def job_build(spec: BuildSpec) -> dict:
    """Клонировать репозиторий, собрать образ и задеплоить его."""
    d = spec.deploy
    try:
        job = start_job("build", {"project": d.project, "service": d.service, "image": d.image, "ref": spec.ref}, run_build_job(spec))
    except DeployError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return job.to_dict()


@app.get("/proxy", dependencies=[Depends(require_token)])
async def proxy_state() -> dict:
    """Кто держит 80/443 и работают ли домены Scalefield (Traefik в сети edge)."""
    return await asyncio.to_thread(detect_proxy)


@app.post("/jobs/proxy", dependencies=[Depends(require_token)])
async def job_proxy(spec: ReplaceSpec) -> dict:
    """Починить 80/443: подключить свой Traefik к edge или заменить чужой прокси нашим."""
    return start_job("proxy", {}, run_proxy_fix_job(spec)).to_dict()


@app.get("/jobs/{job_id}", dependencies=[Depends(require_token)])
async def job_state(job_id: str, since: int = Query(0, ge=0)) -> dict:
    """Состояние задачи и строки лога начиная с `since`."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="unknown job")
    return job.to_dict(since)


@app.post("/deploy/remove", dependencies=[Depends(require_token)])
async def remove_service(spec: RemoveSpec) -> dict:
    """Остановить контейнер и убрать сервис из compose-стека."""
    try:
        return await run_remove(spec)
    except DeployError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.get("/deploy/{project}", dependencies=[Depends(require_token)])
async def deploy_stack(project: str) -> dict:
    """Сервисы compose-стека проекта и состояние их контейнеров."""
    try:
        return await read_stack(project)
    except DeployError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
