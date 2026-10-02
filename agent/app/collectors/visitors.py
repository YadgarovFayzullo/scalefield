"""Аналитика посетителей (в духе Vercel Analytics) поверх того же JSON
access-лога, что и `api_traffic.py`: уникальные визитеры, просмотры страниц,
bounce rate, топ страниц, источники перехода, устройства/браузеры/ОС.

Отличие от `api_traffic.py`: тот считает КАЖДЫЙ HTTP-запрос (ассеты, API,
PDF) в почасовых окнах до суток — годится для нагрузки и ошибок, но не для
«сколько у сайта посетителей». Здесь считаются только «просмотры страниц»
(GET, успешный ответ, HTML-роут, не бот) в окне до недели с посуточной
разбивкой и сравнением с предыдущим таким же окном.

`visitors` — число РАЗНЫХ IP с хотя бы одним просмотром страницы за окно.
Это не «уникальные люди» (NAT, мобильные операторы меняют IP), но тот же
компромисс делает Traefik-based Vercel Analytics и любая аналитика без
собственного JS-трекера — оговорено в UI, а не выдаётся за точное число.
"""
from __future__ import annotations

import asyncio
import os
import re
import time
from collections import defaultdict
from urllib.parse import urlparse

from app.collectors.api_traffic import _iter_records_since
from app.config import settings

_BOT_UA = re.compile(
    r"bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|"
    r"python-requests|curl/|wget/|go-http-client|okhttp|scrapy|headless|"
    r"phantomjs|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|libwww",
    re.I,
)
_STATIC_EXT = (
    ".js", ".css", ".map", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".json", ".xml", ".txt", ".webmanifest", ".avif",
)
_EXCLUDE_PREFIX = ("/api/", "/_next/", "/pdf/", "/favicon", "/robots.txt", "/sitemap", "/og.")


def _is_page_view(r: dict) -> bool:
    if r["method"] != "GET" or r["status"] >= 400:
        return False
    path = r["path"].split("?", 1)[0]
    if path.startswith(_EXCLUDE_PREFIX):
        return False
    if path.endswith(_STATIC_EXT):
        return False
    if _BOT_UA.search(r["ua"] or ""):
        return False
    return True


def _device_of(ua: str) -> tuple[str, str, str]:
    """(device, browser, os) — компактный классификатор без внешней
    зависимости: набор реальных UA-строк браузеров меняется редко, и таблица
    покрывает подавляющее большинство настоящих посетителей; экзотика
    попадает в "Other", а не портит цифры выдумкой."""
    ul = (ua or "").lower()

    if "ipad" in ul or "tablet" in ul:
        device = "Tablet"
    elif "mobi" in ul or "iphone" in ul or "android" in ul:
        device = "Mobile"
    else:
        device = "Desktop"

    if "edg/" in ul:
        browser = "Edge"
    elif "opr/" in ul or "opera" in ul:
        browser = "Opera"
    elif "yabrowser" in ul:
        browser = "Yandex Browser"
    elif "firefox" in ul:
        browser = "Firefox"
    elif "chrome" in ul or "crios" in ul:
        browser = "Chrome"
    elif "safari" in ul and "version" in ul:
        browser = "Safari"
    else:
        browser = "Other"

    if "windows" in ul:
        os_name = "Windows"
    elif "android" in ul:
        os_name = "Android"
    elif "iphone" in ul or "ipad" in ul or "ios" in ul:
        os_name = "iOS"
    elif "mac os" in ul or "macintosh" in ul:
        os_name = "macOS"
    elif "linux" in ul:
        os_name = "Linux"
    else:
        os_name = "Other"
    return device, browser, os_name


def _referrer_host(raw: str | None) -> str | None:
    if not raw:
        return None
    try:
        host = urlparse(raw).netloc
    except ValueError:
        return None
    return host.lower() or None


def _day_bucket(ts: float) -> int:
    return int(ts // 86400) * 86400


def _top(counter: dict[str, int], n: int = 10) -> list[dict]:
    return [
        {"name": k, "count": v}
        for k, v in sorted(counter.items(), key=lambda kv: kv[1], reverse=True)[:n]
    ]


def _aggregate(records: list[dict]) -> dict:
    visitor_views: dict[str, int] = defaultdict(int)
    pages: dict[str, dict] = defaultdict(lambda: {"views": 0, "visitors": set()})
    referrers: dict[str, int] = defaultdict(int)
    devices: dict[str, int] = defaultdict(int)
    browsers: dict[str, int] = defaultdict(int)
    oses: dict[str, int] = defaultdict(int)
    daily: dict[int, dict] = defaultdict(lambda: {"visitors": set(), "views": 0})
    total_views = 0

    for r in records:
        if not _is_page_view(r):
            continue
        total_views += 1
        client = r["client"] or "unknown"
        visitor_views[client] += 1
        path = r["path"].split("?", 1)[0]
        pages[path]["views"] += 1
        pages[path]["visitors"].add(client)
        device, browser, os_name = _device_of(r["ua"])
        devices[device] += 1
        browsers[browser] += 1
        oses[os_name] += 1
        ref_host = _referrer_host(r.get("referrer"))
        referrers[ref_host or "Direct"] += 1
        if r["ts"] is not None:
            d = daily[_day_bucket(r["ts"])]
            d["visitors"].add(client)
            d["views"] += 1

    visitors = len(visitor_views)
    bounces = sum(1 for v in visitor_views.values() if v == 1)
    bounce_rate = (bounces / visitors) if visitors else 0.0

    top_pages = sorted(
        ({"path": p, "views": v["views"], "visitors": len(v["visitors"])} for p, v in pages.items()),
        key=lambda x: x["views"],
        reverse=True,
    )[:15]
    top_referrers = sorted(
        ({"referrer": r, "count": c} for r, c in referrers.items()),
        key=lambda x: x["count"],
        reverse=True,
    )[:10]
    series = [
        {"day": day, "visitors": len(v["visitors"]), "views": v["views"]}
        for day, v in sorted(daily.items())
    ]

    return {
        "visitors": visitors,
        "page_views": total_views,
        "bounce_rate": round(bounce_rate, 4),
        "top_pages": top_pages,
        "referrers": top_referrers,
        "devices": _top(devices),
        "browsers": _top(browsers),
        "operating_systems": _top(oses),
        "series": series,
    }


def _pct_change(cur: float, prev: float) -> float | None:
    if prev <= 0:
        return None
    return round((cur - prev) / prev * 100, 1)


def _visitors_sync(days: int, hosts: tuple[str, ...] | None) -> dict:
    path = settings.CADDY_ACCESS_LOG
    if not path or not os.path.exists(path):
        return {"configured": False}

    now = time.time()
    window_s = days * 86400
    cutoff_current = now - window_s
    cutoff_previous = cutoff_current - window_s

    host_set = {h.lower() for h in hosts} if hosts else None
    current: list[dict] = []
    previous: list[dict] = []
    for r in _iter_records_since(path, cutoff_previous, settings.VISITORS_LOG_MAX_BYTES):
        ts = r["ts"]
        if ts is None or ts < cutoff_previous:
            continue
        if host_set is not None and (r["host"] or "").lower() not in host_set:
            continue
        if ts >= cutoff_current:
            current.append(r)
        else:
            previous.append(r)

    referrer_capture_available = any(r.get("has_referrer_field") for r in current)

    cur_agg = _aggregate(current)
    prev_agg = _aggregate(previous)

    return {
        "configured": True,
        "window_days": days,
        "visitors": cur_agg["visitors"],
        "page_views": cur_agg["page_views"],
        "bounce_rate": cur_agg["bounce_rate"],
        "changes": {
            "visitors": _pct_change(cur_agg["visitors"], prev_agg["visitors"]),
            "page_views": _pct_change(cur_agg["page_views"], prev_agg["page_views"]),
            "bounce_rate": _pct_change(cur_agg["bounce_rate"], prev_agg["bounce_rate"]),
        },
        "series": cur_agg["series"],
        "top_pages": cur_agg["top_pages"],
        "referrers": cur_agg["referrers"],
        "referrer_capture_available": referrer_capture_available,
        "devices": cur_agg["devices"],
        "browsers": cur_agg["browsers"],
        "operating_systems": cur_agg["operating_systems"],
    }


async def collect_visitors(days: int = 7, hosts: tuple[str, ...] | None = None) -> dict:
    return await asyncio.to_thread(_visitors_sync, days, hosts)
