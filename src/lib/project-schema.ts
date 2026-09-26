import "server-only";
import { describeTable, ProjectDbError, qi, type ColumnInfo } from "@/lib/project-db";
import type { ProjectSql } from "@/lib/project-conn";

/**
 * Правка схемы из редактора таблиц: колонки, индексы, создание и удаление
 * таблиц. DDL нельзя параметризовать, поэтому:
 *  - имена проходят `validateIdent` и квотируются `qi()`;
 *  - тип проверяется через `::regtype` (несуществующий тип — ошибка Postgres
 *    до того, как он попадёт в DDL), typmod и `[]` — по строгой маске;
 *  - default — произвольное SQL-выражение. Это сознательно: владелец базы и
 *    так может выполнить любой SQL в редакторе, а `now()`/`gen_random_uuid()`
 *    без выражений не задать.
 */

type Sql = ProjectSql;

export type IndexInfo = { name: string; definition: string; unique: boolean; primary: boolean; size_bytes: number };
export type NewColumn = { name: string; type: string; nullable?: boolean; default?: string | null; pk?: boolean };

const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const TYPE = /^([a-z_][a-z0-9_ ]*?)\s*(\(\s*\d+\s*(,\s*\d+\s*)?\))?\s*(\[\])?$/i;

export function validateIdent(name: string, what = "name"): string {
  if (!IDENT.test(name)) throw new ProjectDbError(`Invalid ${what}: ${name}`);
  return name;
}

// serial/bigserial/smallserial — не типы, а сокращения DDL: `::regtype` их не
// знает, а в CREATE/ALTER они допустимы.
const SERIALS = new Set(["serial", "bigserial", "smallserial", "serial4", "serial8", "serial2"]);

export async function validateType(sql: Sql, type: string): Promise<string> {
  const m = TYPE.exec(type.trim());
  if (!m) throw new ProjectDbError(`Invalid type: ${type}`);
  const base = m[1].trim().toLowerCase();
  if (SERIALS.has(base) && !m[2] && !m[4]) return base;
  const rows = await sql.unsafe("select format_type(($1::text)::regtype, null) as t", [base]);
  const canonical = String(rows[0].t);
  return canonical + (m[2] ? m[2].replace(/\s+/g, "") : "") + (m[4] ? "[]" : "");
}

export async function listIndexes(sql: Sql, schemaName: string, table: string): Promise<IndexInfo[]> {
  const rows = await sql.unsafe(
    `select i.relname as name, pg_get_indexdef(i.oid) as definition, x.indisunique as "unique",
            x.indisprimary as "primary", pg_relation_size(i.oid)::bigint as size_bytes
     from pg_index x
     join pg_class c on c.oid = x.indrelid
     join pg_class i on i.oid = x.indexrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = $1 and c.relname = $2
     order by x.indisprimary desc, i.relname`,
    [schemaName, table],
  );
  return rows.map((r) => ({
    name: String(r.name),
    definition: String(r.definition),
    unique: Boolean(r.unique),
    primary: Boolean(r.primary),
    size_bytes: Number(r.size_bytes),
  }));
}

async function columnDef(sql: Sql, c: NewColumn): Promise<string> {
  validateIdent(c.name, "column name");
  const type = await validateType(sql, c.type);
  let def = `${qi(c.name)} ${type}`;
  if (c.nullable === false || c.pk) def += " NOT NULL";
  if (c.default != null && c.default.trim() !== "") def += ` DEFAULT ${c.default.trim()}`;
  return def;
}

export async function addColumn(sql: Sql, schemaName: string, table: string, c: NewColumn): Promise<void> {
  const def = await columnDef(sql, c);
  await sql.unsafe(`alter table ${qi(schemaName)}.${qi(table)} add column ${def}`);
}

export async function dropColumn(sql: Sql, schemaName: string, table: string, column: string): Promise<void> {
  validateIdent(column, "column name");
  await sql.unsafe(`alter table ${qi(schemaName)}.${qi(table)} drop column ${qi(column)}`);
}

export async function renameColumn(sql: Sql, schemaName: string, table: string, column: string, to: string): Promise<void> {
  validateIdent(column, "column name");
  validateIdent(to, "column name");
  await sql.unsafe(`alter table ${qi(schemaName)}.${qi(table)} rename column ${qi(column)} to ${qi(to)}`);
}

/** Тип / NOT NULL / default одной колонки; незаданные поля не трогаем. */
export async function alterColumn(
  sql: Sql,
  schemaName: string,
  table: string,
  column: string,
  change: { type?: string; nullable?: boolean; default?: string | null },
): Promise<void> {
  validateIdent(column, "column name");
  const rel = `${qi(schemaName)}.${qi(table)}`;
  const col = qi(column);
  const actions: string[] = [];
  if (change.type) {
    const type = await validateType(sql, change.type);
    actions.push(`alter column ${col} type ${type} using ${col}::${type}`);
  }
  if (change.nullable === true) actions.push(`alter column ${col} drop not null`);
  if (change.nullable === false) actions.push(`alter column ${col} set not null`);
  if (change.default !== undefined) {
    actions.push(
      change.default === null || change.default.trim() === ""
        ? `alter column ${col} drop default`
        : `alter column ${col} set default ${change.default.trim()}`,
    );
  }
  if (actions.length === 0) throw new ProjectDbError("Nothing to change");
  await sql.unsafe(`alter table ${rel} ${actions.join(", ")}`);
}

export async function addIndex(
  sql: Sql,
  schemaName: string,
  table: string,
  opts: { name?: string; columns: string[]; unique?: boolean },
): Promise<string> {
  if (!opts.columns.length) throw new ProjectDbError("Index needs at least one column");
  const existing = await describeTable(sql, schemaName, table);
  for (const c of opts.columns) {
    if (!existing.some((e) => e.name === c)) throw new ProjectDbError(`Unknown column: ${c}`);
  }
  const name = validateIdent(opts.name?.trim() || `${table}_${opts.columns.join("_")}_idx`.slice(0, 63), "index name");
  await sql.unsafe(
    `create ${opts.unique ? "unique " : ""}index ${qi(name)} on ${qi(schemaName)}.${qi(table)} (${opts.columns.map(qi).join(", ")})`,
  );
  return name;
}

export async function dropIndex(sql: Sql, schemaName: string, table: string, name: string): Promise<void> {
  validateIdent(name, "index name");
  const idx = (await listIndexes(sql, schemaName, table)).find((i) => i.name === name);
  if (!idx) throw new ProjectDbError("Unknown index", 404);
  if (idx.primary) throw new ProjectDbError("Primary key index cannot be dropped here", 409);
  await sql.unsafe(`drop index ${qi(schemaName)}.${qi(name)}`);
}

export async function createTable(
  sql: Sql,
  schemaName: string,
  name: string,
  columns: NewColumn[],
): Promise<void> {
  validateIdent(schemaName, "schema name");
  validateIdent(name, "table name");
  if (columns.length === 0) throw new ProjectDbError("Table needs at least one column");
  const defs: string[] = [];
  for (const c of columns) defs.push(await columnDef(sql, c));
  const pk = columns.filter((c) => c.pk).map((c) => qi(c.name));
  if (pk.length) defs.push(`primary key (${pk.join(", ")})`);
  await sql.unsafe(`create table ${qi(schemaName)}.${qi(name)} (${defs.join(", ")})`);
}

export async function dropTable(sql: Sql, schemaName: string, table: string): Promise<void> {
  validateIdent(schemaName, "schema name");
  validateIdent(table, "table name");
  await sql.unsafe(`drop table ${qi(schemaName)}.${qi(table)}`);
}

export type { ColumnInfo };
