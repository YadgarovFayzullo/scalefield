import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { getProjectDatabase, listTables, ProjectDbError } from "@/lib/project-db";
import { createTable, type NewColumn } from "@/lib/project-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Список таблиц и представлений базы проекта (для левой колонки редактора).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  try {
    const { database, sql } = await getProjectDatabase(slug, req.nextUrl.searchParams.get("db") || undefined);
    const tables = await listTables(sql);
    return NextResponse.json({ database: { id: database.id, name: database.name, engine: database.engine }, tables });
  } catch (e) {
    return dbError(e);
  }
}

// Создание таблицы: { schema, name, columns: [{ name, type, nullable, default, pk }] }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  try {
    const body = (await req.json()) as { schema?: string; name?: string; columns?: NewColumn[]; db?: string };
    const { sql } = await getProjectDatabase(slug, body.db);
    await createTable(sql, body.schema || "public", String(body.name ?? ""), Array.isArray(body.columns) ? body.columns : []);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return dbError(e);
  }
}

export function dbError(e: unknown) {
  if (e instanceof ProjectDbError) return NextResponse.json({ error: e.message }, { status: e.status });
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: 502 });
}
