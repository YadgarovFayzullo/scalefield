import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { getProjectDatabase } from "@/lib/project-db";
import { runSql } from "@/lib/project-sql";
import { dbError } from "../tables/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SQL-редактор: { query, read_only (по умолчанию true), max_rows }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isValidSession(req.cookies.get(COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  try {
    const body = (await req.json()) as { query?: string; read_only?: boolean; max_rows?: number; db?: string };
    const { sql } = await getProjectDatabase(slug, body.db);
    const result = await runSql(sql, String(body.query ?? ""), {
      readOnly: body.read_only !== false,
      maxRows: body.max_rows,
    });
    return NextResponse.json(result);
  } catch (e) {
    return dbError(e);
  }
}
