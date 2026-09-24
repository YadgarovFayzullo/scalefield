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
