"use client";

/**
 * Клиентский слой редактора таблиц. Типы повторяют `src/lib/project-db.ts`.
 * Все запросы идут в `/api/projects/<slug>/tables/...` под сессией панели.
 */

export type TableInfo = {
  schema: string;
  name: string;
  kind: "table" | "view" | "matview" | "partitioned";
  est_rows: number;
  size_bytes: number;
};

export type ColumnInfo = {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  is_pk: boolean;
  has_default: boolean;
};

export type RowsResult = {
  columns: ColumnInfo[];
  pk: string[];
  rows: Record<string, unknown>[];
  total: number;
  total_exact: boolean;
  limit: number;
  offset: number;
};

export type TablesResult = {
  database: { id: string; name: string; engine: string };
  tables: TableInfo[];
};

export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "null" | "notnull";
export const FILTER_OPS: { value: FilterOp; label: string; needsValue: boolean }[] = [
  { value: "eq", label: "=", needsValue: true },
  { value: "neq", label: "≠", needsValue: true },
  { value: "gt", label: ">", needsValue: true },
  { value: "gte", label: "≥", needsValue: true },
  { value: "lt", label: "<", needsValue: true },
  { value: "lte", label: "≤", needsValue: true },
  { value: "like", label: "contains", needsValue: true },
  { value: "null", label: "is null", needsValue: false },
  { value: "notnull", label: "is not null", needsValue: false },
];

export type CellValue = string | null;

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* не JSON — ниже уйдёт в ошибку */
  }
  if (!res.ok) {
    const msg = (json as { error?: string } | null)?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

/** Значение ячейки как строка для показа и для отправки в API. */
export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function pkValues(row: Record<string, unknown>, pk: string[]): Record<string, CellValue> {
  const out: Record<string, CellValue> = {};
  for (const c of pk) out[c] = row[c] == null ? null : cellToString(row[c]);
  return out;
}

export function rowKey(row: Record<string, unknown>, pk: string[]): string {
  return JSON.stringify(pk.map((c) => (row[c] == null ? null : cellToString(row[c]))));
}

/** Короткое имя типа для шапки колонки: `character varying(255)` → `varchar(255)`. */
export function shortType(t: string): string {
  return t
    .replace("character varying", "varchar")
    .replace("timestamp with time zone", "timestamptz")
    .replace("timestamp without time zone", "timestamp")
    .replace("double precision", "float8")
    .replace("boolean", "bool")
    .replace("integer", "int4")
    .replace("bigint", "int8");
}

// ---------- SQL-редактор и схема ----------

export type SqlColumn = { name: string; type: string };
export type SqlStatementResult = {
  command: string | null;
  columns: SqlColumn[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
};
export type SqlRunResult = { statements: SqlStatementResult[]; duration_ms: number; read_only: boolean };

export type IndexInfo = { name: string; definition: string; unique: boolean; primary: boolean; size_bytes: number };
export type NewColumn = { name: string; type: string; nullable?: boolean; default?: string | null; pk?: boolean };
export type SchemaResult = { columns: ColumnInfo[]; indexes: IndexInfo[] };

/** Частые типы для подсказки в формах колонок; любой другой тип тоже принимается. */
export const COMMON_TYPES = [
  "text",
  "varchar(255)",
  "integer",
  "bigint",
  "numeric",
  "boolean",
  "uuid",
  "timestamptz",
  "date",
  "jsonb",
  "text[]",
  "serial",
  "bigserial",
];

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

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
