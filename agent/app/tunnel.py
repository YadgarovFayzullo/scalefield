"""Обратный туннель к relay Scalefield.

Агент стоит на сервере клиента — за NAT, за файрволом хостера, без публичного
порта. Поэтому не control-plane ходит к агенту, а агент сам держит исходящий
WebSocket к relay и исполняет присланные по нему запросы: каждый
`{"type": "request", id, method, path, body}` прогоняется через это же
FastAPI-приложение внутри процесса (httpx.ASGITransport), так что ручки
`/status/*`, `/jobs/*`, `/deploy/*` не знают, пришёл запрос по сети или по
туннелю. Порт uvicorn остаётся только для /healthz докера.

Без SCALEFIELD_RELAY_URL туннель не запускается — агент работает в прежнем
прямом режиме (control-plane в той же docker-сети шлёт HTTP с X-Status-Token).
"""
from __future__ import annotations

import asyncio
import json
import logging
import socket

import httpx
import websockets

from app.config import settings

log = logging.getLogger("scalefield.tunnel")

AGENT_VERSION = "1.3.0"


def host_hostname() -> str:
    """Имя машины, а не контейнера: агент видит корень хоста в /host (compose).
    По нему панель называет сервер, добавленный одной кнопкой."""
    for path in ("/host/etc/hostname", "/host/proc/sys/kernel/hostname"):
        try:
            name = open(path, encoding="utf-8").read().strip()
        except OSError:
            continue
        if name:
            return name
    return socket.gethostname()
# Логи контейнеров и результаты задач могут быть большими — лимит relay такой же.
MAX_MESSAGE = 64 * 1024 * 1024
MAX_BACKOFF_S = 60.0

_task: asyncio.Task | None = None
_inflight: set[asyncio.Task] = set()


def start_tunnel(app) -> None:
    """Запустить фоновую задачу туннеля (зовётся на старте FastAPI)."""
    global _task
    # uvicorn настраивает только свои логгеры; без этого «подключён к relay»
    # (INFO) не видно, а видны одни предупреждения об обрывах.
    if not log.handlers and not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s: %(message)s")
    log.setLevel(logging.INFO)
    url = settings.SCALEFIELD_RELAY_URL
    if not url:
        log.info("SCALEFIELD_RELAY_URL не задан — туннель выключен, прямой режим")
        return
    _task = asyncio.create_task(_run(app, url, settings.agent_token), name="scalefield-tunnel")


async def stop_tunnel() -> None:
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass


async def _run(app, url: str, token: str) -> None:
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://agent", timeout=None)
    hello = json.dumps({"type": "hello", "version": AGENT_VERSION, "hostname": host_hostname()})
    backoff = 1.0
    while True:
        try:
            async with websockets.connect(
                url,
                additional_headers={"Authorization": f"Bearer {token}"},
                max_size=MAX_MESSAGE,
            ) as ws:
                log.info("подключён к relay %s", url)
                backoff = 1.0
                await ws.send(hello)
                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                    except ValueError:
                        continue
                    if isinstance(msg, dict) and msg.get("type") == "request":
                        t = asyncio.create_task(_serve(client, ws, msg))
                        _inflight.add(t)
                        t.add_done_callback(_inflight.discard)
        except asyncio.CancelledError:
            await client.aclose()
            raise
        except Exception as e:  # noqa: BLE001 — любой обрыв: переподключаемся
            log.warning("relay недоступен (%s) — повтор через %.0f с", e, backoff)
        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, MAX_BACKOFF_S)


async def _serve(client: httpx.AsyncClient, ws, msg: dict) -> None:
    rid = msg.get("id")
    try:
        method = str(msg.get("method", "GET")).upper()
        path = str(msg.get("path", "/"))
        body = msg.get("body")
        # Внутренние ручки защищены тем же токеном, что и прямой режим:
        # запрос из туннеля уже проверен relay, подставляем его сами.
        headers = {"X-Status-Token": settings.STATUS_API_TOKEN}
        content = None
        if body is not None:
            content = json.dumps(body).encode("utf-8")
            headers["content-type"] = "application/json"
        resp = await client.request(method, path, content=content, headers=headers)
        out = {"type": "response", "id": rid, "status": resp.status_code, "body": resp.text}
    except Exception as e:  # noqa: BLE001
        out = {"type": "response", "id": rid, "status": 500, "body": json.dumps({"detail": f"agent: {e}"})}
    try:
        await ws.send(json.dumps(out))
    except Exception:  # noqa: BLE001 — соединение ушло; relay уже отбил запрос
        pass
