import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret } from "@/lib/secrets";
import { agentRef } from "@/lib/agent";
import { agentSql, type ProjectSql, type SqlParam } from "@/lib/project-conn";

/**
 * Доступ к базе проекта для редактора таблиц (аналог Table Editor в Supabase).
 *
 * Запросы исполняет агент сервера, на котором стоит база (`/db/exec`,
 * src/lib/project-conn.ts): у клиента Postgres наружу не смотрит. Строка
 * подключения — из `databases.url_enc`, уезжает агенту в запросе.
 * Все запросы параметризованы; идентификаторы (схема, таблица, колонка)
 * берутся ТОЛЬКО из каталога и квотируются `qi()`, а значения приводятся к
 * типу колонки явным `($n::text)::type` из `format_type` — параметры едут
 * строками, и Postgres сам разбирает их в integer/jsonb/uuid.
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
  /** identity / serial / default — при вставке колонку можно не заполнять. */
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

export type RowFilter = { column: string; op: FilterOp; value: string };
export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "null" | "notnull";
const OPS: Record<FilterOp, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "ILIKE",
  null: "IS NULL",
  notnull: "IS NOT NULL",
};

export const MAX_LIMIT = 200;
/** До этого числа строк count(*) считаем точно, дальше — оценка планировщика. */
const EXACT_COUNT_MAX = 200_000;

export function qi(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

export class ProjectDbError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function getProjectDatabase(slug: string, dbId?: string) {
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.slug, slug) });
  if (!project) throw new ProjectDbError("Unknown project", 404);
  const rows = await db
    .select()
    .from(schema.databases)
    .where(
      dbId
        ? and(eq(schema.databases.projectId, project.id), eq(schema.databases.id, dbId))
        : eq(schema.databases.projectId, project.id),
    )
    .orderBy(asc(schema.databases.createdAt))
    .limit(1);
  const database = rows[0];
  if (!database) throw new ProjectDbError("Project has no database registered", 404);
  if (!database.urlEnc) throw new ProjectDbError("Database has no connection string", 409);
  // Агент — сервера базы, а если у базы он не указан, сервера проекта.
  const serverId = database.serverId ?? project.serverId;
  if (!serverId) throw new ProjectDbError("Database has no server with an agent", 409);
  const server = await db.query.servers.findFirst({ where: eq(schema.servers.id, serverId) });
  if (!server) throw new ProjectDbError("Database server not found", 409);
  const sql = agentSql(agentRef(server), decryptSecret(database.urlEnc));
  return { project, database, sql };
}

type Sql = ProjectSql;
type Params = SqlParam[];
type Param = SqlParam;

/** Каст параметра к типу колонки: параметр едет строкой, разбирает его Postgres. */
function cast(n: number, type: string): string {
  return `($${n}::text)::${type}`;
}

/** Значение для параметра, привязанного к `($n::text)::<type>` — всегда строка; JSON проверяем заранее. */
function paramFor(col: ColumnInfo, value: string): Param {
  if (col.type === "json" || col.type === "jsonb") {
    try {
      JSON.parse(value);
    } catch {
      throw new ProjectDbError(`Column ${col.name}: invalid JSON`);
    }
  }
  return value;
}

export async function listTables(sql: Sql): Promise<TableInfo[]> {
  const rows = await sql.unsafe(`
    select n.nspname as schema, c.relname as name, c.relkind as relkind,
           greatest(c.reltuples, 0)::bigint as est_rows,
           pg_total_relation_size(c.oid)::bigint as size_bytes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p', 'v', 'm')
      and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
      and n.nspname not like 'pg\\_%'
    order by n.nspname, c.relname
  `);
  const kinds: Record<string, TableInfo["kind"]> = { r: "table", p: "partitioned", v: "view", m: "matview" };
  return rows.map((r) => ({
    schema: String(r.schema),
    name: String(r.name),
    kind: kinds[String(r.relkind)] ?? "table",
    est_rows: Number(r.est_rows),
    size_bytes: Number(r.size_bytes),
  }));
}

/** Проверяет, что таблица есть в каталоге; возвращает её relkind. */
async function resolveTable(sql: Sql, schemaName: string, table: string): Promise<{ kind: string; estRows: number }> {
  const rows = await sql.unsafe(
    `select c.relkind, greatest(c.reltuples, 0)::bigint as est_rows
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = $1 and c.relname = $2 and c.relkind in ('r','p','v','m')`,
    [schemaName, table],
  );
  if (rows.length === 0) throw new ProjectDbError("Unknown table", 404);
  return { kind: String(rows[0].relkind), estRows: Number(rows[0].est_rows) };
}

export async function describeTable(sql: Sql, schemaName: string, table: string): Promise<ColumnInfo[]> {
  const rows = await sql.unsafe(
    `select a.attname as name,
            format_type(a.atttypid, a.atttypmod) as type,
            not a.attnotnull as nullable,
            pg_get_expr(d.adbin, d.adrelid) as "default",
            coalesce(a.attnum = any(i.indkey::int2[]), false) as is_pk,
            (a.attidentity <> '' or a.attgenerated <> '' or d.adbin is not null) as has_default
     from pg_attribute a
     left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
     left join pg_index i on i.indrelid = a.attrelid and i.indisprimary
     where a.attrelid = ($1::text)::regclass and a.attnum > 0 and not a.attisdropped
     order by a.attnum`,
    [qi(schemaName) + "." + qi(table)],
  );
  return rows.map((r) => ({
    name: String(r.name),
    type: String(r.type),
    nullable: Boolean(r.nullable),
    default: r.default == null ? null : String(r.default),
    is_pk: Boolean(r.is_pk),
    has_default: Boolean(r.has_default),
  }));
}

function serialize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return "\\x" + v.toString("hex");
  if (Array.isArray(v)) return v.map(serialize);
  return v;
}

function serializeRow(row: Record<string, unknown>, columns: ColumnInfo[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    let v = serialize(row[k]);
    // postgres.js в `unsafe` с параметрами (update/insert … returning) отдаёт
    // json/jsonb строкой, а в select — объектом. Выравниваем к объекту, иначе
    // после правки ячейка показывала бы значение в кавычках.
    const col = columns.find((c) => c.name === k);
    if (col && (col.type === "jsonb" || col.type === "json") && typeof v === "string") {
      try {
        v = JSON.parse(v);
      } catch {
        /* оставляем строкой */
      }
    }
    out[k] = v;
  }
  return out;
}

function columnByName(columns: ColumnInfo[], name: string): ColumnInfo {
  const col = columns.find((c) => c.name === name);
  if (!col) throw new ProjectDbError(`Unknown column: ${name}`);
  return col;
}

function buildWhere(
  columns: ColumnInfo[],
  filter: RowFilter | null,
  params: Params,
): string {
  if (!filter) return "";
  const col = columnByName(columns, filter.column);
  const op = OPS[filter.op];
  if (!op) throw new ProjectDbError("Unknown filter operator");
  if (filter.op === "null" || filter.op === "notnull") return ` where ${qi(col.name)} ${op}`;
  if (filter.op === "like") {
    params.push(`%${filter.value}%`);
    return ` where ${qi(col.name)}::text ILIKE $${params.length}`;
  }
  params.push(paramFor(col, filter.value));
  return ` where ${qi(col.name)} ${op} ${cast(params.length, col.type)}`;
}

/** SELECT для страницы строк и для экспорта: WHERE/ORDER BY без LIMIT. */
export async function buildSelect(
  sql: Sql,
  schemaName: string,
  table: string,
  opts: { order?: string; dir?: "asc" | "desc"; filter: RowFilter | null },
): Promise<{ query: string; params: Params; columns: ColumnInfo[]; pk: string[]; estRows: number; where: string }> {
  const { estRows } = await resolveTable(sql, schemaName, table);
  const columns = await describeTable(sql, schemaName, table);
  const pk = columns.filter((c) => c.is_pk).map((c) => c.name);
  const rel = qi(schemaName) + "." + qi(table);
  const params: Params = [];
  const where = buildWhere(columns, opts.filter, params);
  // Без сортировки Postgres отдаёт строки в произвольном порядке, и страницы
  // бы «прыгали»; по умолчанию сортируем по первичному ключу.
  const orderCols = opts.order ? [columnByName(columns, opts.order).name] : pk;
  const dir = opts.dir === "desc" ? "DESC" : "ASC";
  const orderBy = orderCols.length ? ` order by ${orderCols.map((c) => `${qi(c)} ${dir}`).join(", ")}` : "";
  return { query: `select * from ${rel}${where}${orderBy}`, params, columns, pk, estRows, where };
}

export async function fetchRows(
  sql: Sql,
  schemaName: string,
  table: string,
  opts: { limit: number; offset: number; order?: string; dir?: "asc" | "desc"; filter: RowFilter | null },
): Promise<RowsResult> {
  const { query, params, columns, pk, estRows, where } = await buildSelect(sql, schemaName, table, opts);
  const limit = Math.min(Math.max(1, opts.limit), MAX_LIMIT);
  const offset = Math.max(0, opts.offset);
  const rel = qi(schemaName) + "." + qi(table);

  const rows = await sql.unsafe(`${query} limit ${limit} offset ${offset}`, params);

  let total: number;
  let totalExact: boolean;
  if (opts.filter || estRows <= EXACT_COUNT_MAX) {
    const cnt = await sql.unsafe(`select count(*)::bigint as n from ${rel}${where}`, params);
    total = Number(cnt[0].n);
    totalExact = true;
  } else {
    total = estRows;
    totalExact = false;
  }

  return {
    columns,
    pk,
    rows: rows.map((r) => serializeRow(r as Record<string, unknown>, columns)),
    total,
    total_exact: totalExact,
    limit,
    offset,
  };
}

/** Значение из UI: строка или null. Пустая строка — это пустая строка, не NULL. */
export type CellValue = string | null;

function pkPredicate(columns: ColumnInfo[], pkValues: Record<string, CellValue>, params: Params): string {
  const pk = columns.filter((c) => c.is_pk);
  if (pk.length === 0) throw new ProjectDbError("Table has no primary key — read-only", 409);
  const parts = pk.map((c) => {
    if (!(c.name in pkValues)) throw new ProjectDbError(`Missing primary key value: ${c.name}`);
    const v = pkValues[c.name];
    if (v === null) return `${qi(c.name)} IS NULL`;
    params.push(paramFor(c, v));
    return `${qi(c.name)} = ${cast(params.length, c.type)}`;
  });
  return parts.join(" AND ");
}

export async function updateRow(
  sql: Sql,
  schemaName: string,
  table: string,
  pkValues: Record<string, CellValue>,
  set: Record<string, CellValue>,
): Promise<Record<string, unknown>> {
  await resolveTable(sql, schemaName, table);
  const columns = await describeTable(sql, schemaName, table);
  const names = Object.keys(set);
  if (names.length === 0) throw new ProjectDbError("Nothing to update");
  const params: Params = [];
  const assignments = names.map((n) => {
    const col = columnByName(columns, n);
    const v = set[n];
    if (v === null) return `${qi(col.name)} = NULL`;
    params.push(paramFor(col, v));
    return `${qi(col.name)} = ${cast(params.length, col.type)}`;
  });
  const where = pkPredicate(columns, pkValues, params);
  const rows = await sql.unsafe(
    `update ${qi(schemaName)}.${qi(table)} set ${assignments.join(", ")} where ${where} returning *`,
    params,
  );
  if (rows.length === 0) throw new ProjectDbError("Row not found", 404);
  if (rows.length > 1) throw new ProjectDbError("Primary key matched several rows", 409);
  return serializeRow(rows[0] as Record<string, unknown>, columns);
}

export async function insertRow(
  sql: Sql,
  schemaName: string,
  table: string,
  values: Record<string, CellValue>,
): Promise<Record<string, unknown>> {
  await resolveTable(sql, schemaName, table);
  const columns = await describeTable(sql, schemaName, table);
  const names = Object.keys(values);
  const params: Params = [];
  const rel = `${qi(schemaName)}.${qi(table)}`;
  let query: string;
  if (names.length === 0) {
    query = `insert into ${rel} default values returning *`;
  } else {
    const cols = names.map((n) => qi(columnByName(columns, n).name));
    const vals = names.map((n) => {
      const col = columnByName(columns, n);
      const v = values[n];
      if (v === null) return "NULL";
      params.push(paramFor(col, v));
      return cast(params.length, col.type);
    });
    query = `insert into ${rel} (${cols.join(", ")}) values (${vals.join(", ")}) returning *`;
  }
  const rows = await sql.unsafe(query, params);
  return serializeRow(rows[0] as Record<string, unknown>, columns);
}

export async function deleteRows(
  sql: Sql,
  schemaName: string,
  table: string,
  keys: Record<string, CellValue>[],
): Promise<number> {
  if (keys.length === 0) return 0;
  if (keys.length > 500) throw new ProjectDbError("Too many rows at once (max 500)");
  await resolveTable(sql, schemaName, table);
  const columns = await describeTable(sql, schemaName, table);
  const rel = `${qi(schemaName)}.${qi(table)}`;
  // Все удаления — одной транзакцией на агенте: либо все, либо ни одного.
  const statements = keys.map((k) => {
    const params: Params = [];
    const where = pkPredicate(columns, k, params);
    return { sql: `delete from ${rel} where ${where}`, params };
  });
  const res = await sql.exec(statements);
  return res.statements.reduce((n, s) => n + s.row_count, 0);
}
