import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { buildSelect, getProjectDatabase } from "@/lib/project-db";
import { dbError } from "../../../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Экспорт таблицы в CSV потоком через COPY … TO STDOUT: строки не собираются
// в памяти, поэтому и 6 тыс. статей с аннотациями уходят без проблем.
// Фильтр и сортировка — те же query-параметры, что у страницы строк.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; schema: string; table: string }> },
) {
  if (!(await isValidSession(req.cookies.get(COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug, schema, table } = await params;
  const sp = req.nextUrl.searchParams;
  try {
    const { sql } = await getProjectDatabase(slug, sp.get("db") || undefined);
    const { query, params: values } = await buildSelect(sql, schema, table, {
      order: sp.get("order") || undefined,
      dir: sp.get("dir") === "desc" ? "desc" : "asc",
      filter: parseFilter(sp),
    });
    // COPY не принимает параметры — подставляем литералы через квотирование
    // драйвера-независимым способом (все значения — строки).
    const inlined = query.replace(/\$(\d+)::/g, (_, n) => `${literal(values[Number(n) - 1])}::`).replace(/\$(\d+)/g, (_, n) => literal(values[Number(n) - 1]));
    const stream = await sql.unsafe(`copy (${inlined}) to stdout with csv header`).readable();
    const filename = `${schema}.${table}.csv`;
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename.replace(/["\r\n]/g, "")}"`,
      },
    });
  } catch (e) {
    return dbError(e);
  }
}

function literal(v: unknown): string {
  const s = v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return "'" + s.replace(/'/g, "''") + "'";
}

function parseFilter(sp: URLSearchParams) {
  const column = sp.get("fcol");
  const op = sp.get("fop");
  if (!column || !op) return null;
  const ops = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "null", "notnull"] as const;
  if (!(ops as readonly string[]).includes(op)) return null;
  return { column, op: op as (typeof ops)[number], value: sp.get("fval") ?? "" };
}
