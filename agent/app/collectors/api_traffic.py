"""Метрики HTTP-трафика из JSON access-лога фронт-прокси.

Поддерживаются оба формата, потому что прод переехал с Caddy на Traefik
(DigitalOcean, 2026-09-10), а имена полей у них разные:

* Caddy:   {ts: сек-эпоха float, request:{uri, method, host, remote_ip},
            status, size, duration: сек}
* Traefik: {time: RFC3339, RequestPath, RequestMethod, RequestHost, ClientHost,
            DownstreamStatus, DownstreamContentSize, Duration: НАНОсекунды,
            RouterName, request_User-Agent}

Формат определяется по самой строке, настройка не нужна. Traefik обязан писать
именно JSON (`--accesslog.format=json`): по умолчанию он пишет CLF, который
здесь молча отбрасывается и раздел показывает нули.

Мы читаем ХВОСТ файла (последние N байт), парсим строки в окне
API_WINDOW_HOURS и агрегируем. Если лог не задан — раздел помечается как
«не настроен».

Помимо агрегата отдаём `series` — почасовые корзины за окно (запросы, ошибки,
средняя латентность, байты): дашборду нужны графики, а не одно число. И
`_logs_sync` — последние записи как есть, для страницы логов.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from datetime import datetime

from app.config import settings


def _parse_ts(raw: object) -> float | None:
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return None
    return None


def _parse_record(rec: dict) -> dict | None:
    """Нормализованная запись лога любого из прокси или None, если строка не про запрос.

    Ключи: ts, status, dur_ms, method, path, host, client, size, ua, router.
    """
    if "DownstreamStatus" in rec:  # Traefik
        status = rec.get("DownstreamStatus")
        if not isinstance(status, int):
            return None
        dur = rec.get("Duration")
        # Duration у Traefik в наносекундах, у Caddy — в секундах.
        dur_ms = dur / 1_000_000.0 if isinstance(dur, (int, float)) else None
        size = rec.get("DownstreamContentSize")
        return {
            "ts": _parse_ts(rec.get("time") or rec.get("StartUTC")),
            "status": status,
            "dur_ms": dur_ms,
            "method": rec.get("RequestMethod") or "?",
            "path": rec.get("RequestPath") or "/",
            "host": rec.get("RequestHost") or "",
            "client": rec.get("ClientHost") or "",
            "size": size if isinstance(size, int) else 0,
            "ua": rec.get("request_User-Agent") or "",
            "router": rec.get("RouterName") or "",
            # Referer не включён в прод-конфиг Traefik (только User-Agent) —
            # ключа не будет в JSON вовсе, пока не добавят
            # --accesslog.fields.headers.names.Referer=keep. Отличаем «нет
            # заголовка» от «заголовок пуст», иначе аналитика источников
            # перехода выглядела бы как «весь трафик прямой».
            "referrer": rec.get("request_Referer") or None,
            "has_referrer_field": "request_Referer" in rec,
        }

    status = rec.get("status")  # Caddy
    if not isinstance(status, int):
        return None
    dur = rec.get("duration")
    dur_ms = dur * 1000.0 if isinstance(dur, (int, float)) else None
    req = rec.get("request", {}) or {}
    headers = req.get("headers", {}) or {}
    ua = headers.get("User-Agent") or []
    size = rec.get("size")
    referrer = headers.get("Referer")
    return {
        "ts": _parse_ts(rec.get("ts")),
        "status": status,
        "dur_ms": dur_ms,
        "method": req.get("method") or "?",
        "path": req.get("uri") or "/",
        "host": req.get("host") or "",
        "client": req.get("remote_ip") or "",
        "size": size if isinstance(size, int) else 0,
        "ua": ua[0] if isinstance(ua, list) and ua else "",
        "router": "",
        "referrer": (referrer[0] if isinstance(referrer, list) and referrer else referrer) or None,
        "has_referrer_field": "Referer" in headers,
    }


def _read_tail(path: str, max_bytes: int) -> list[str]:
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        if size > max_bytes:
            f.seek(size - max_bytes)
            f.readline()  # выкидываем возможную обрезанную первую строку
        data = f.read()
    return data.decode("utf-8", errors="ignore").splitlines()


def _iter_records(path: str, max_bytes: int):
    for line in _read_tail(path, max_bytes):
        line = line.strip()
        if not line or line[0] != "{":
            continue
        try:
            rec = json.loads(line)
        except ValueError:
            continue
        parsed = _parse_record(rec)
        if parsed is not None:
            yield parsed


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    k = (len(values) - 1) * p
    lo = int(k)
    hi = min(lo + 1, len(values) - 1)
    frac = k - lo
    return values[lo] * (1 - frac) + values[hi] * frac


def _traffic_sync() -> dict:
    path = settings.CADDY_ACCESS_LOG
    if not path or not os.path.exists(path):
        return {"configured": False}

    window_s = settings.API_WINDOW_HOURS * 3600
    now = time.time()
    cutoff = now - window_s
    bucket_s = 3600
    first_bucket = int(cutoff // bucket_s) * bucket_s

    total = 0
    durations: list[float] = []
    total_bytes = 0
    codes = {"2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0}
    endpoints: dict[str, dict] = {}
    hosts: dict[str, int] = {}
    errors: list[dict] = []
    buckets: dict[int, dict] = {}
    for b in range(first_bucket, int(now // bucket_s) * bucket_s + 1, bucket_s):
        buckets[b] = {"ts": b, "requests": 0, "e4xx": 0, "e5xx": 0, "bytes": 0, "durs": []}

    for r in _iter_records(path, settings.CADDY_LOG_TAIL_BYTES):
        ts = r["ts"]
        if ts is not None and ts < cutoff:
            continue
        status = r["status"]
        dur_ms = r["dur_ms"]

        total += 1
        bucket = f"{status // 100}xx"
        if bucket in codes:
            codes[bucket] += 1
        if dur_ms is not None:
            durations.append(dur_ms)
        total_bytes += r["size"]
        if r["host"]:
            hosts[r["host"]] = hosts.get(r["host"], 0) + 1

        b = buckets.get(int((ts if ts is not None else now) // bucket_s) * bucket_s)
        if b is not None:
            b["requests"] += 1
            if 400 <= status < 500:
                b["e4xx"] += 1
            elif status >= 500:
                b["e5xx"] += 1
            b["bytes"] += r["size"]
            if dur_ms is not None:
                b["durs"].append(dur_ms)

        uri = r["path"].split("?", 1)[0]
        key = f"{r['method']} {uri}"
        e = endpoints.setdefault(key, {"count": 0, "total_ms": 0.0, "errors": 0})
        e["count"] += 1
        if dur_ms is not None:
            e["total_ms"] += dur_ms
        if status >= 400:
            e["errors"] += 1
            errors.append({"path": key, "status": status, "ts": ts})
            if len(errors) > 50:
                del errors[0]

    top = sorted(endpoints.items(), key=lambda kv: kv[1]["count"], reverse=True)[:15]
    top_endpoints = [
        {
            "path": k,
            "count": v["count"],
            "avg_ms": round(v["total_ms"] / v["count"], 1) if v["count"] else 0,
            "errors": v["errors"],
        }
        for k, v in top
    ]

    series = []
    for b in sorted(buckets.values(), key=lambda x: x["ts"]):
        durs = b.pop("durs")
        b["avg_ms"] = round(sum(durs) / len(durs), 1) if durs else 0
        b["p95_ms"] = round(_percentile(durs, 0.95), 1)
        series.append(b)

    return {
        "configured": True,
        "window_hours": settings.API_WINDOW_HOURS,
        "total_requests": total,
        "rps": round(total / window_s, 3),
        "latency_ms": {
            "p50": round(_percentile(durations, 0.50), 1),
            "p95": round(_percentile(durations, 0.95), 1),
            "p99": round(_percentile(durations, 0.99), 1),
        },
        "status_codes": codes,
        "error_rate": round((codes["4xx"] + codes["5xx"]) / total, 4) if total else 0,
        "bytes_out": total_bytes,
        "by_host": sorted(
            ({"host": h, "count": n} for h, n in hosts.items()),
            key=lambda x: x["count"],
            reverse=True,
        )[:10],
        "series": series,
        "top_endpoints": top_endpoints,
        "recent_errors": errors[-20:],
    }


def _logs_sync(limit: int, level: str, host: str) -> dict:
    """Последние записи access-лога, новые первыми.

    level: all | error (5xx) | warn (4xx и 5xx). host — фильтр по RequestHost.
    """
    path = settings.CADDY_ACCESS_LOG
    if not path or not os.path.exists(path):
        return {"configured": False, "items": []}

    def keep(r: dict) -> bool:
        if level == "error" and r["status"] < 500:
            return False
        if level == "warn" and r["status"] < 400:
            return False
        if host and r["host"] != host:
            return False
        return True

    items = [r for r in _iter_records(path, settings.CADDY_LOG_TAIL_BYTES) if keep(r)]
    items = items[-limit:]
    items.reverse()
    for i, r in enumerate(items):
        r["id"] = f"{int(r['ts'] or 0)}-{i}"
        r["level"] = "error" if r["status"] >= 500 else "warn" if r["status"] >= 400 else "info"
    return {"configured": True, "items": items}


async def collect_api_traffic() -> dict:
    return await asyncio.to_thread(_traffic_sync)


async def collect_access_logs(limit: int = 200, level: str = "all", host: str = "") -> dict:
    return await asyncio.to_thread(_logs_sync, limit, level, host)
