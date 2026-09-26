"""Доступ панели к базе проекта через агента.

Раньше control-plane подключался к Postgres проекта напрямую по строке из
`databases.url_enc`. У клиента база наружу не смотрит, а агент стоит рядом
с ней — поэтому редактор таблиц, SQL-редактор и правка схемы шлют запросы
сюда, агент исполняет их и отдаёт строки. Строка подключения приходит в
запросе (control-plane хранит её шифрованной), пул на каждую держится в
памяти агента.

`/db/exec` — пачка statements в ОДНОЙ транзакции (READ ONLY по флагу,
`statement_timeout` через SET LOCAL). Параметры приходят строками: панель
пишет касты как `($n::text)::тип`, чтобы asyncpg не пытался кодировать
значение по типу колонки (как это делает text-протокол postgres.js).
json/jsonb в ответе разбираются в объекты. `/db/export` — CSV через
`COPY … TO STDOUT` (ограничен по размеру: через relay идёт одним сообщением).
"""
from __future__ import annotations

import datetime as dt
import decimal
import io
import json
import re
import uuid
from typing import Any

import asyncpg
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/db")

MAX_ROWS = 1000
MAX_TIMEOUT_MS = 120_000
MAX_EXPORT_BYTES = 48 * 1024 * 1024
_pools: dict[str, asyncpg.Pool] = {}


class Statement(BaseModel):
    sql: str = Field(min_length=1, max_length=200_000)
    params: list[Any] = []


class ExecRequest(BaseModel):
    url: str
    statements: list[Statement] = Field(min_length=1, max_length=1000)
    read_only: bool = False
    timeout_ms: int = Field(30_000, ge=100, le=MAX_TIMEOUT_MS)
    max_rows: int = Field(MAX_ROWS, ge=1, le=MAX_ROWS)


class ExportRequest(BaseModel):
    url: str
    sql: str = Field(min_length=1, max_length=200_000)
    params: list[Any] = []


async def _init_conn(conn: asyncpg.Connection) -> None:
    # json/jsonb наружу — объектами, а не строками. На вход они не попадают:
    # параметры идут через text-каст.
    for t in ("json", "jsonb"):
        await conn.set_type_codec(t, encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def _pool(url: str) -> asyncpg.Pool:
    pool = _pools.get(url)
    if pool is None:
        try:
            pool = await asyncpg.create_pool(url, min_size=0, max_size=3, timeout=10, init=_init_conn)
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"database: {e}") from e
        _pools[url] = pool
    return pool


def _jsonable(v: Any) -> Any:
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    if isinstance(v, (dt.datetime, dt.date, dt.time)):
        return v.isoformat()
    if isinstance(v, dt.timedelta):
        return str(v)
    if isinstance(v, decimal.Decimal):
        return str(v)
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, (bytes, bytearray, memoryview)):
        return "\\x" + bytes(v).hex()
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _jsonable(x) for k, x in v.items()}
    return str(v)


def _param(v: Any) -> Any:
    """Параметр к `($n::text)::тип` — всегда строка (объекты — JSON-текстом)."""
    if v is None or isinstance(v, str):
        return v
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return json.dumps(v)


_TAG_RE = re.compile(r"^([A-Z]+(?: [A-Z]+)*?)(?: \d+)?(?: (\d+))?$")


def _row_count(status: str | None, fetched: int) -> int:
    # Статус вида "UPDATE 3" / "INSERT 0 3" / "SELECT 5"; без числа — сколько прочитали.
    if not status:
        return fetched
    m = _TAG_RE.match(status)
    if m and m.group(2) is not None:
        return int(m.group(2))
    parts = status.split()
    if len(parts) >= 2 and parts[-1].isdigit():
        return int(parts[-1])
    return fetched


async def _run_statement(conn: asyncpg.Connection, st: Statement, max_rows: int) -> dict:
    params = [_param(p) for p in st.params]
    try:
        # Вложенная транзакция = savepoint: неудачный prepare (например,
        # несколько statements в тексте) иначе перевёл бы всю транзакцию в
        # aborted, и запасной путь ниже не смог бы выполниться.
        async with conn.transaction():
            stmt = await conn.prepare(st.sql)
    except asyncpg.PostgresSyntaxError as e:
        if "cannot insert multiple commands" in str(e):
            # Несколько statements в одном тексте (SQL-редактор): исполняем
            # простым протоколом, строк он не отдаёт — только статус.
            if params:
                raise
            status = await conn.execute(st.sql)
            return {"command": status.split()[0] if status else None, "columns": [], "rows": [], "row_count": _row_count(status, 0), "truncated": False}
        raise
    rows = await stmt.fetch(*params)
    attrs = stmt.get_attributes()
    status = stmt.get_statusmsg()
    columns = [{"name": a.name, "type": a.type.name} for a in attrs]
    out_rows = [{a.name: _jsonable(r[i]) for i, a in enumerate(attrs)} for r in rows[:max_rows]]
    return {
        "command": status.split()[0] if status else None,
        "columns": columns,
        "rows": out_rows,
        "row_count": _row_count(status, len(rows)),
        "truncated": len(rows) > max_rows,
    }


def _pg_error(e: Exception) -> HTTPException:
    if isinstance(e, asyncpg.PostgresError):
        detail = e.message if hasattr(e, "message") else str(e)
        hint = getattr(e, "hint", None)
        return HTTPException(status_code=400, detail=f"{detail}" + (f" ({hint})" if hint else ""))
    return HTTPException(status_code=502, detail=f"database: {e}")


@router.post("/exec")
async def db_exec(req: ExecRequest) -> dict:
    pool = await _pool(req.url)
    started = dt.datetime.now()
    results: list[dict] = []
    try:
        async with pool.acquire() as conn:
            async with conn.transaction(readonly=req.read_only):
                await conn.execute(f"SET LOCAL statement_timeout = {int(req.timeout_ms)}")
                for st in req.statements:
                    results.append(await _run_statement(conn, st, req.max_rows))
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise _pg_error(e) from e
    return {
        "statements": results,
        "duration_ms": int((dt.datetime.now() - started).total_seconds() * 1000),
        "read_only": req.read_only,
    }


@router.post("/export", response_class=PlainTextResponse)
async def db_export(req: ExportRequest) -> str:
    pool = await _pool(req.url)
    buf = io.BytesIO()
    size = 0

    async def sink(chunk: bytes) -> None:
        nonlocal size
        size += len(chunk)
        if size > MAX_EXPORT_BYTES:
            raise HTTPException(status_code=413, detail="Export is larger than 48 MB — narrow it with a filter")
        buf.write(chunk)

    try:
        async with pool.acquire() as conn:
            async with conn.transaction(readonly=True):
                await conn.copy_from_query(req.sql, *[_param(p) for p in req.params], output=sink, format="csv", header=True)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise _pg_error(e) from e
    return buf.getvalue().decode("utf-8")
