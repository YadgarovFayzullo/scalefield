import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { getProjectDatabase, listTables, ProjectDbError } from "@/lib/project-db";

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

export function dbError(e: unknown) {
  if (e instanceof ProjectDbError) return NextResponse.json({ error: e.message }, { status: e.status });
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: 502 });
}
