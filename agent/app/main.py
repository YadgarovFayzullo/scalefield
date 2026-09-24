"""FastAPI-сервис статуса researcher.uz.

Только чтение метрик: сервер (psutil/docker), Postgres (pg_stat_*), контент
(SQL), HTTP-трафик (лог прокси), логи контейнеров. Всё под токеном, кроме
/healthz.
"""
from __future__ import annotations

import time

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.collectors.api_traffic import collect_access_logs, collect_api_traffic
from app.collectors.content import collect_content
from app.collectors.database import collect_database
from app.collectors.server import collect_container_logs, collect_server
from app.config import settings
from app.db import close_pool, get_pool
from app.security import require_token

app = FastAPI(title="researcher.uz status", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_STARTED_AT = time.time()


@app.on_event("shutdown")
async def _shutdown() -> None:
    await close_pool()


@app.get("/healthz")
async def healthz() -> dict:
    """Liveness без токена — для healthcheck контейнера."""
    return {"ok": True, "uptime_s": int(time.time() - _STARTED_AT)}


@app.get("/status/summary", dependencies=[Depends(require_token)])
async def summary() -> dict:
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

    # БД
    try:
        pool = await get_pool()
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


@app.get("/status/server", dependencies=[Depends(require_token)])
async def server() -> dict:
    return await collect_server()


@app.get("/status/database", dependencies=[Depends(require_token)])
async def database() -> dict:
    return await collect_database()


@app.get("/status/api", dependencies=[Depends(require_token)])
async def api_traffic() -> dict:
    return await collect_api_traffic()


@app.get("/status/content", dependencies=[Depends(require_token)])
async def content() -> dict:
    return await collect_content()


@app.get("/status/logs", dependencies=[Depends(require_token)])
async def access_logs(
    limit: int = Query(200, ge=1, le=1000),
    level: str = Query("all", pattern="^(all|warn|error)$"),
    host: str = Query(""),
) -> dict:
    """Последние записи access-лога прокси (новые первыми)."""
    return await collect_access_logs(limit=limit, level=level, host=host)


@app.get("/status/container-logs", dependencies=[Depends(require_token)])
async def container_logs(
    name: str = Query(..., min_length=1, max_length=120),
    tail: int = Query(200, ge=1, le=1000),
) -> dict:
    """Хвост stdout/stderr контейнера через docker.sock."""
    return await collect_container_logs(name=name, tail=tail)
