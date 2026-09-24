"""Метрики хоста: CPU / память / диск / uptime / сеть + состояние Docker-контейнеров.

В контейнере psutil видит только контейнер. Чтобы показывать ХОСТ, монтируем
host /proc -> /host/proc и задаём PROC_ROOT (см. docker-compose). Диск считаем
по DISK_PATH (в контейнере — смонтированный корень хоста).
"""
from __future__ import annotations

import asyncio
import time

import psutil

from app.config import settings

if settings.PROC_ROOT:
    # Должно быть выставлено ДО первого обращения к psutil.
    psutil.PROCFS_PATH = settings.PROC_ROOT


def _server_sync() -> dict:
    # cpu_percent с коротким интервалом даёт мгновенный срез.
    cpu_pct = psutil.cpu_percent(interval=0.3)
    per_cpu = psutil.cpu_percent(interval=0.0, percpu=True)

    try:
        load1, load5, load15 = psutil.getloadavg()
    except (OSError, AttributeError):
        load1 = load5 = load15 = 0.0

    vm = psutil.virtual_memory()
    sm = psutil.swap_memory()
    disk = psutil.disk_usage(settings.DISK_PATH)
    net = psutil.net_io_counters()

    boot = psutil.boot_time()
    uptime_s = max(0, int(time.time() - boot))

    return {
        "cpu_pct": round(cpu_pct, 1),
        "cpu_count": psutil.cpu_count(logical=True),
        "per_cpu": [round(x, 1) for x in per_cpu],
        "load_avg": [round(load1, 2), round(load5, 2), round(load15, 2)],
        "mem": {
            "total": vm.total,
            "used": vm.used,
            "available": vm.available,
            "pct": round(vm.percent, 1),
        },
        "swap": {"total": sm.total, "used": sm.used, "pct": round(sm.percent, 1)},
        "disk": {
            "path": settings.DISK_PATH,
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "pct": round(disk.percent, 1),
        },
        "net": {"bytes_sent": net.bytes_sent, "bytes_recv": net.bytes_recv},
        "uptime_s": uptime_s,
        "boot_time": int(boot),
    }


def _containers_sync() -> list[dict]:
    if not settings.DOCKER_SOCKET:
        return []
    try:
        import docker  # локальный импорт: без сокета библиотека не нужна
    except Exception:
        return []

    try:
        client = docker.DockerClient(base_url=settings.DOCKER_SOCKET, timeout=5)
    except Exception:
        return []

    out: list[dict] = []
    try:
        for c in client.containers.list(all=True):
            info: dict = {
                "name": c.name,
                "status": c.status,  # running / exited / ...
                "image": (c.image.tags[0] if c.image.tags else c.image.short_id),
                "health": None,
                "cpu_pct": None,
                "mem_used": None,
                "mem_pct": None,
            }
            try:
                state = c.attrs.get("State", {})
                info["health"] = (state.get("Health") or {}).get("Status")
                info["started_at"] = state.get("StartedAt")
            except Exception:
                pass
            # stats только для запущенных — иначе зависает.
            if c.status == "running":
                try:
                    s = c.stats(stream=False)
                    info["cpu_pct"] = _docker_cpu_pct(s)
                    mem = s.get("memory_stats", {})
                    used = mem.get("usage")
                    limit = mem.get("limit")
                    info["mem_used"] = used
                    if used and limit:
                        info["mem_pct"] = round(used / limit * 100, 1)
                except Exception:
                    pass
            out.append(info)
    except Exception:
        return out
    finally:
        try:
            client.close()
        except Exception:
            pass
    return out


def _docker_cpu_pct(s: dict) -> float | None:
    try:
        cpu = s["cpu_stats"]
        pre = s["precpu_stats"]
        cpu_delta = cpu["cpu_usage"]["total_usage"] - pre["cpu_usage"]["total_usage"]
        sys_delta = cpu["system_cpu_usage"] - pre["system_cpu_usage"]
        ncpu = cpu.get("online_cpus") or len(
            cpu["cpu_usage"].get("percpu_usage") or [1]
        )
        if sys_delta > 0 and cpu_delta > 0:
            return round(cpu_delta / sys_delta * ncpu * 100, 1)
    except Exception:
        return None
    return 0.0


async def collect_server() -> dict:
    data = await asyncio.to_thread(_server_sync)
    data["containers"] = await asyncio.to_thread(_containers_sync)
    return data


def _container_logs_sync(name: str, tail: int) -> dict:
    """Хвост логов контейнера. Имя сверяем со списком — произвольные строки в
    docker SDK не отдаём."""
    if not settings.DOCKER_SOCKET:
        return {"configured": False, "lines": []}
    try:
        import docker
        client = docker.DockerClient(base_url=settings.DOCKER_SOCKET, timeout=10)
    except Exception:
        return {"configured": False, "lines": []}
    try:
        c = client.containers.get(name)
        raw = c.logs(tail=tail, timestamps=True, stdout=True, stderr=True)
        lines = []
        for i, line in enumerate(raw.decode("utf-8", errors="ignore").splitlines()):
            ts, _, msg = line.partition(" ")
            low = msg.lower()
            level = (
                "error"
                if ("error" in low or "traceback" in low or "exception" in low or "critical" in low)
                else "warn" if ("warn" in low) else "info"
            )
            lines.append({"id": f"{i}", "ts": ts, "message": msg, "level": level})
        lines.reverse()
        return {"configured": True, "container": name, "lines": lines}
    except Exception as e:  # noqa: BLE001
        return {"configured": True, "container": name, "lines": [], "error": str(e)}
    finally:
        try:
            client.close()
        except Exception:
            pass


async def collect_container_logs(name: str, tail: int = 200) -> dict:
    return await asyncio.to_thread(_container_logs_sync, name, tail)
