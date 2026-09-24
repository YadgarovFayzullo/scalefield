import "server-only";
import type postgres from "postgres";
import { ProjectDbError, type ColumnInfo } from "@/lib/project-db";

/**
 * SQL-редактор: произвольный запрос к базе проекта.
 *
 * По умолчанию запрос идёт в транзакции `READ ONLY` — Postgres сам отвергает
 * любую запись, и это надёжнее любого разбора текста запроса. Режим записи
 * включается явно и коммитит транзакцию целиком. `statement_timeout`
 * ограничивает время, `maxRows` — объём ответа (в базе 6 тыс. статей с
 * эмбеддингами по 10 КБ — `select *` без лимита положил бы вкладку).
 */

type Sql = ReturnType<typeof postgres>;

export type SqlColumn = { name: string; type: string };
export type SqlStatementResult = {
  command: string | null;
  columns: SqlColumn[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
};
export type SqlRunResult = { statements: SqlStatementResult[]; duration_ms: number; read_only: boolean };

export const MAX_SQL_ROWS = 1000;
const TIMEOUT_MS = 30_000;
const MAX_QUERY_LEN = 100_000;

const typeCache = new WeakMap<object, Map<number, string>>();

async function typeNames(sql: Sql): Promise<Map<number, string>> {
  let m = typeCache.get(sql);
  if (m) return m;
  const rows = await sql.unsafe("select oid, typname from pg_type");
  m = new Map(rows.map((r) => [Number(r.oid), String(r.typname)]));
  typeCache.set(sql, m);
  return m;
}

function serialize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return "\\x" + v.toString("hex");
  if (Array.isArray(v)) return v.map(serialize);
  return v;
}

type RawResult = Record<string, unknown>[] & {
  columns?: { name: string; type: number }[];
  count?: number;
  command?: string;
};

export async function runSql(
  sql: Sql,
  query: string,
  opts: { readOnly: boolean; maxRows?: number },
): Promise<SqlRunResult> {
  const text = query.trim();
  if (!text) throw new ProjectDbError("Empty query");
  if (text.length > MAX_QUERY_LEN) throw new ProjectDbError("Query is too long");
  const maxRows = Math.min(Math.max(1, opts.maxRows ?? MAX_SQL_ROWS), MAX_SQL_ROWS);
  const types = await typeNames(sql);
  const started = Date.now();

  const raw = await sql.begin(opts.readOnly ? "read only" : "read write", async (tx) => {
    await tx.unsafe(`set local statement_timeout = ${TIMEOUT_MS}`);
    return (await tx.unsafe(text)) as unknown as RawResult | RawResult[];
  });

  // Несколько statements через `;` — драйвер отдаёт массив результатов.
  const list: RawResult[] =
    Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0]) ? (raw as RawResult[]) : [raw as RawResult];

  const statements: SqlStatementResult[] = list.map((res) => {
    const columns = (res.columns ?? []).map((c) => ({ name: c.name, type: types.get(c.type) ?? String(c.type) }));
    const rows = res.slice(0, maxRows).map((r) => {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(r)) out[k] = serialize(r[k]);
      return out;
    });
    return {
      command: res.command ?? null,
      columns,
      rows,
      row_count: typeof res.count === "number" ? res.count : res.length,
      truncated: res.length > maxRows,
    };
  });
  return { statements, duration_ms: Date.now() - started, read_only: opts.readOnly };
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
