import "server-only";
import { ProjectDbError, type ColumnInfo } from "@/lib/project-db";
import type { ProjectSql, SqlColumn, StatementResult } from "@/lib/project-conn";

/**
 * SQL-редактор: произвольный запрос к базе проекта — через агента её сервера.
 *
 * По умолчанию запрос идёт в транзакции `READ ONLY` — Postgres сам отвергает
 * любую запись, и это надёжнее любого разбора текста запроса. Режим записи
 * включается явно и коммитит транзакцию целиком. `statement_timeout`
 * ограничивает время, `maxRows` — объём ответа (в базе 6 тыс. статей с
 * эмбеддингами по 10 КБ — `select *` без лимита положил бы вкладку).
 *
 * Несколько statements через `;` в одном тексте агент исполняет простым
 * протоколом: результат — статус, без строк. Чтобы увидеть строки, запрос
 * запускают по одному.
 */
export type { SqlColumn };
export type SqlStatementResult = StatementResult;
export type SqlRunResult = { statements: SqlStatementResult[]; duration_ms: number; read_only: boolean };

export const MAX_SQL_ROWS = 1000;
const TIMEOUT_MS = 30_000;
const MAX_QUERY_LEN = 100_000;

export async function runSql(
  sql: ProjectSql,
  query: string,
  opts: { readOnly: boolean; maxRows?: number },
): Promise<SqlRunResult> {
  const text = query.trim();
  if (!text) throw new ProjectDbError("Empty query");
  if (text.length > MAX_QUERY_LEN) throw new ProjectDbError("Query is too long");
  const maxRows = Math.min(Math.max(1, opts.maxRows ?? MAX_SQL_ROWS), MAX_SQL_ROWS);
  return sql.exec([{ sql: text }], { readOnly: opts.readOnly, timeoutMs: TIMEOUT_MS, maxRows });
}

/** CSV-строка для результата (экспорт из редактора и из таблицы). */
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [columns.map(esc).join(",")];
  for (const r of rows) lines.push(columns.map((c) => esc(r[c])).join(","));
  return lines.join("\n") + "\n";
}

export type { ColumnInfo };
