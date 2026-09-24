"""Бизнес-метрики контента: статьи, журналы, издатели, юзеры, взаимодействия.

Схема — researcher.uz (см. модели бэкенда). Всё через один пул-коннекшн,
последовательно (asyncpg не даёт параллелить запросы на одном соединении).

Демо-журналы (`journals.metadata.demo = true` — стенды для показа клиентам) из
всех цифр вычтены: их статистику набивает `scripts/seed_demo_stats.py` в
бэкенд-репозитории, и без фильтра сотни выдуманных просмотров вылезали бы в
«топ статей» и в сумму взаимодействий как настоящие. Сырой размер базы это не
искажает — строки и таблицы считает коллектор `database.py` по pg_stat, там всё
как есть.
"""
from __future__ import annotations

from app.db import get_pool

# --- демо-контент -----------------------------------------------------------
# Журнал помечен флагом в metadata; значение сверяем текстом, чтобы строковое
# "true" из ручной правки тоже считалось демо (так же делает бэкенд).
_DEMO_JOURNALS = (
    "SELECT id FROM journals WHERE coalesce(metadata->>'demo', 'false') = 'true'"
)
_DEMO_ISSUES = f"SELECT id FROM issues WHERE journal_id IN ({_DEMO_JOURNALS})"
_REAL_JOURNAL = "coalesce(metadata->>'demo', 'false') <> 'true'"
_REAL_ISSUE = f"journal_id NOT IN ({_DEMO_JOURNALS})"


def _real_article(alias: str = "") -> str:
    """Условие «статья не из демо-журнала».

    `issue_id IS NULL` пропускаем явно: у самостоятельных изданий выпуска нет, а
    `NULL NOT IN (...)` дал бы NULL и вырезал бы их целиком.
    """
    col = f"{alias}.issue_id" if alias else "issue_id"
    return f"({col} IS NULL OR {col} NOT IN ({_DEMO_ISSUES}))"


async def collect_content() -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        articles_total = await conn.fetchval(
            f"SELECT count(*) FROM articles WHERE {_real_article()}"
        )
        articles_published = await conn.fetchval(
            f"SELECT count(*) FROM articles "
            f"WHERE published IS TRUE AND {_real_article()}"
        )
        by_type = {
            r["publication_type"]: r["n"]
            for r in await conn.fetch(
                f"""
                SELECT publication_type, count(*) AS n
                FROM articles
                WHERE {_real_article()}
                GROUP BY publication_type
                ORDER BY n DESC
                """
            )
        }

        journals_by_type = {
            r["type"]: r["n"]
            for r in await conn.fetch(
                f"SELECT type, count(*) AS n FROM journals "
                f"WHERE {_REAL_JOURNAL} GROUP BY type"
            )
        }
        journals_total = sum(journals_by_type.values())

        issues_total = await conn.fetchval(
            f"SELECT count(*) FROM issues WHERE {_REAL_ISSUE}"
        )
        publishers_total = await conn.fetchval("SELECT count(*) FROM publishers")
        sections_total = await conn.fetchval(
            f"SELECT count(*) FROM conference_sections "
            f"WHERE issue_id NOT IN ({_DEMO_ISSUES})"
        )
        users_total = await conn.fetchval("SELECT count(*) FROM users")

        roles = {
            (r["role"] or "unknown"): r["n"]
            for r in await conn.fetch(
                "SELECT role, count(*) AS n FROM profiles GROUP BY role ORDER BY n DESC"
            )
        }

        inter = await conn.fetchrow(
            f"""
            SELECT COALESCE(sum(i.view), 0) AS views,
                   COALESCE(sum(i.download), 0) AS downloads,
                   COALESCE(sum(i."like"), 0) AS likes
            FROM article_interactions i
            JOIN articles a ON a.id = i.article_id
            WHERE {_real_article("a")}
            """
        )

        # DOI-покрытие — доля статей с проставленным DOI.
        with_doi = await conn.fetchval(
            f"SELECT count(*) FROM articles "
            f"WHERE doi IS NOT NULL AND doi <> '' AND {_real_article()}"
        )

        # Внешние цитирования (OpenAlex).
        citations = await conn.fetchval(
            f"""
            SELECT COALESCE(sum(e.cited_by_count), 0)
            FROM external_citations e
            JOIN articles a ON a.id = e.article_id
            WHERE {_real_article("a")}
            """
        )

        top_articles = await conn.fetch(
            f"""
            SELECT a.id,
                   left(COALESCE(a.title, a.title_foreign, '—'), 120) AS title,
                   COALESCE(sum(i.view), 0) AS views,
                   COALESCE(sum(i.download), 0) AS downloads
            FROM articles a
            LEFT JOIN article_interactions i ON i.article_id = a.id
            WHERE {_real_article("a")}
            GROUP BY a.id, a.title, a.title_foreign
            ORDER BY views DESC
            LIMIT 10
            """
        )

        # Рост: новые статьи по дням за 30 дней (по created_at).
        growth = await conn.fetch(
            f"""
            SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
                   COALESCE(c.n, 0) AS count
            FROM generate_series(
                     (CURRENT_DATE - INTERVAL '29 days'),
                     CURRENT_DATE,
                     INTERVAL '1 day'
                 ) AS d(day)
            LEFT JOIN (
                SELECT date_trunc('day', created_at)::date AS day, count(*) AS n
                FROM articles
                WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
                  AND {_real_article()}
                GROUP BY 1
            ) c ON c.day = d.day::date
            ORDER BY d.day
            """
        )

        latest = await conn.fetch(
            f"""
            SELECT id,
                   left(COALESCE(title, title_foreign, '—'), 120) AS title,
                   publication_type,
                   to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
            FROM articles
            WHERE {_real_article()}
            ORDER BY created_at DESC
            LIMIT 8
            """
        )

    return {
        "articles": {
            "total": articles_total,
            "published": articles_published,
            "with_doi": with_doi,
            "by_type": by_type,
        },
        "journals": {"total": journals_total, "by_type": journals_by_type},
        "issues": issues_total,
        "publishers": publishers_total,
        "sections": sections_total,
        "users": users_total,
        "roles": roles,
        "interactions": {
            "views": int(inter["views"]),
            "downloads": int(inter["downloads"]),
            "likes": int(inter["likes"]),
        },
        "citations": int(citations),
        # asyncpg отдаёт sum() как Decimal, а JSON превращает его в строку —
        # фронт получал "570" вместо 570.
        "top_articles": [
            {"id": r["id"], "title": r["title"], "views": int(r["views"]), "downloads": int(r["downloads"])}
            for r in top_articles
        ],
        "growth": [{"date": r["date"], "count": int(r["count"])} for r in growth],
        "latest": [dict(r) for r in latest],
    }
