"""Пулы asyncpg для метрик базы (read-only по смыслу — сервис ничего не пишет).

Пул на каждую строку подключения: на сервере может быть несколько проектов
со своими базами, и раздел Database каждого проекта должен смотреть в СВОЮ
базу (control-plane присылает её строку). Без строки — база из
STATUS_DATABASE_URL (прямой режим и метрики контента researcher.uz).
"""
from __future__ import annotations

import asyncpg

from app.config import settings

_pools: dict[str, asyncpg.Pool] = {}


async def get_pool(dsn: str | None = None) -> asyncpg.Pool:
    dsn = dsn or settings.STATUS_DATABASE_URL
    pool = _pools.get(dsn)
    if pool is None:
        pool = await asyncpg.create_pool(dsn=dsn, min_size=0, max_size=3, command_timeout=15)
        _pools[dsn] = pool
    return pool


async def close_pool() -> None:
    for pool in _pools.values():
        await pool.close()
    _pools.clear()
