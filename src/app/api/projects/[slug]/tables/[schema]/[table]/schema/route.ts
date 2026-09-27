import { NextRequest, NextResponse } from "next/server";
import { projectAllowed } from "@/lib/auth";
import { describeTable, getProjectDatabase, ProjectDbError } from "@/lib/project-db";
import {
  addColumn,
  addIndex,
  alterColumn,
  dropColumn,
  dropIndex,
  dropTable,
  listIndexes,
  renameColumn,
  type NewColumn,
} from "@/lib/project-schema";
import { dbError } from "../../../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; schema: string; table: string }> };

// Схема таблицы: колонки и индексы.
export async function GET(req: NextRequest, { params }: Ctx) {
  if (!(await projectAllowed(req, params))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug, schema, table } = await params;
  try {
    const { sql } = await getProjectDatabase(slug, req.nextUrl.searchParams.get("db") || undefined);
    const [columns, indexes] = await Promise.all([describeTable(sql, schema, table), listIndexes(sql, schema, table)]);
    return NextResponse.json({ columns, indexes });
  } catch (e) {
    return dbError(e);
  }
}

type Action =
  | { action: "add_column"; column: NewColumn }
  | { action: "drop_column"; column: string }
  | { action: "rename_column"; column: string; to: string }
  | { action: "alter_column"; column: string; type?: string; nullable?: boolean; default?: string | null }
  | { action: "add_index"; name?: string; columns: string[]; unique?: boolean }
  | { action: "drop_index"; name: string }
  | { action: "drop_table" };

// DDL-операции над таблицей. Каждая — отдельный запрос, Postgres сам валидирует.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!(await projectAllowed(req, params))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug, schema, table } = await params;
  try {
    const body = (await req.json()) as Action & { db?: string };
    const { sql } = await getProjectDatabase(slug, body.db);
    switch (body.action) {
      case "add_column":
        await addColumn(sql, schema, table, body.column);
        break;
      case "drop_column":
        await dropColumn(sql, schema, table, body.column);
        break;
      case "rename_column":
        await renameColumn(sql, schema, table, body.column, body.to);
        break;
      case "alter_column":
        await alterColumn(sql, schema, table, body.column, { type: body.type, nullable: body.nullable, default: body.default });
        break;
      case "add_index":
        await addIndex(sql, schema, table, { name: body.name, columns: body.columns ?? [], unique: body.unique });
        break;
      case "drop_index":
        await dropIndex(sql, schema, table, body.name);
        break;
      case "drop_table":
        await dropTable(sql, schema, table);
        return NextResponse.json({ ok: true, dropped: true });
      default:
        throw new ProjectDbError("Unknown action");
    }
    const [columns, indexes] = await Promise.all([describeTable(sql, schema, table), listIndexes(sql, schema, table)]);
    return NextResponse.json({ ok: true, columns, indexes });
  } catch (e) {
    return dbError(e);
  }
}
