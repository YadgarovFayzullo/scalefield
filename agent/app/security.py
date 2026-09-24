"""Проверка общего секрета между дашбордом и этим API.

Дашборд-прокси (Next.js, серверная сторона) шлёт X-Status-Token. Публичного
доступа к метрикам нет — только owner через свой прокси. /healthz открыт
(liveness), остальное — за токеном.
"""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from app.config import settings


async def require_token(x_status_token: str | None = Header(default=None)) -> None:
    expected = settings.STATUS_API_TOKEN
    if not x_status_token or not hmac.compare_digest(x_status_token, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")
