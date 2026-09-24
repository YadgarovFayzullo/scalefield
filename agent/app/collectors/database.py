"""Метрики Postgres через системные вьюхи (pg_stat_*). Только чтение."""
from __future__ import annotations

from app.db import get_pool

# Таблицы, которые считаем «своими» (для аккуратного тоталза строк).
_SLOW_Q_SQL = """
    SELECT query, calls, mean_exec_time, total_exec_time, rows
    FROM pg_stat_statements s
    JOIN pg_database d ON d.oid = s.dbid AND d.datname = current_database()
    ORDER BY mean_exec_time DESC
    LIMIT 10
"""


async def collect_database() -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        size = await conn.fetchval(
            "SELECT pg_database_size(current_database())"
        )
        size_pretty = await conn.fetchval(
            "SELECT pg_size_pretty(pg_database_size(current_database()))"
        )

        conn_rows = await conn.fetch(
            """
            SELECT state, count(*) AS n
            FROM pg_stat_activity
            WHERE datname = current_database()
            GROUP BY state
            """
        )
        by_state = {(r["state"] or "unknown"): r["n"] for r in conn_rows}
        total_conn = sum(by_state.values())
        max_conn = int(await conn.fetchval("SHOW max_connections"))

        cache_hit = await conn.fetchval(
            """
            SELECT CASE WHEN sum(blks_hit + blks_read) = 0 THEN 1
                        ELSE sum(blks_hit)::float / sum(blks_hit + blks_read) END
            FROM pg_stat_database
            WHERE datname = current_database()
            """
        )

        txn = await conn.fetchrow(
            """
            SELECT COALESCE(sum(xact_commit), 0) AS commits,
                   COALESCE(sum(xact_rollback), 0) AS rollbacks,
                   COALESCE(sum(tup_inserted), 0) AS inserts,
                   COALESCE(sum(tup_updated), 0) AS updates,
                   COALESCE(sum(tup_deleted), 0) AS deletes
            FROM pg_stat_database
            WHERE datname = current_database()
            """
        )

        tables = await conn.fetch(
            """
            SELECT relname AS name,
                   n_live_tup AS rows,
                   pg_total_relation_size(relid) AS total_bytes,
                   pg_size_pretty(pg_total_relation_size(relid)) AS total_pretty,
                   pg_relation_size(relid) AS table_bytes,
                   n_dead_tup AS dead_rows
            FROM pg_stat_user_tables
            ORDER BY pg_total_relation_size(relid) DESC
            LIMIT 20
            """
        )

        longest = await conn.fetch(
            """
            SELECT pid,
                   EXTRACT(EPOCH FROM (now() - query_start)) AS dur_s,
                   state,
                   left(query, 200) AS query
            FROM pg_stat_activity
            WHERE state <> 'idle'
              AND query NOT ILIKE '%pg_stat_activity%'
              AND datname = current_database()
              AND query_start IS NOT NULL
            ORDER BY dur_s DESC NULLS LAST
            LIMIT 5
            """
        )

        # pg_stat_statements может быть не установлен — не роняем весь эндпоинт.
        slow: list[dict] | None
        try:
            slow_rows = await conn.fetch(_SLOW_Q_SQL)
            slow = [
                {
                    "query": r["query"][:300],
                    "calls": r["calls"],
                    "mean_ms": round(r["mean_exec_time"], 2),
                    "total_ms": round(r["total_exec_time"], 2),
                    "rows": r["rows"],
                }
                for r in slow_rows
            ]
        except Exception:
            slow = None

        version = await conn.fetchval("SHOW server_version")

    return {
        "ok": True,
        "version": version,
        "size_bytes": size,
        "size_pretty": size_pretty,
        "connections": {
            "total": total_conn,
            "max": max_conn,
            "pct": round(total_conn / max_conn * 100, 1) if max_conn else 0,
            "by_state": by_state,
        },
        "cache_hit_ratio": round(float(cache_hit or 0), 4),
        "txn": {k: int(txn[k]) for k in txn.keys()},
        "tables": [dict(r) for r in tables],
        "longest_running": [
            {
                "pid": r["pid"],
                "dur_s": round(float(r["dur_s"] or 0), 1),
                "state": r["state"],
                "query": r["query"],
            }
            for r in longest
        ],
        "slow_queries": slow,
        "pg_stat_statements": slow is not None,
    }
