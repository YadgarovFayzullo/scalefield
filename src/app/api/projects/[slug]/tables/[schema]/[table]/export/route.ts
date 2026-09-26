import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { buildSelect, getProjectDatabase } from "@/lib/project-db";
import { dbError } from "../../../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Экспорт таблицы в CSV: агент сервера базы гонит `COPY … TO STDOUT` и
// отдаёт файл целиком (через relay он идёт одним сообщением, поэтому агент
// ограничивает его 48 МБ — больше просят сузить фильтром). Фильтр и
// сортировка — те же query-параметры, что у страницы строк.
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
    const csv = await sql.exportCsv(query, values);
    const filename = `${schema}.${table}.csv`;
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename.replace(/["\r\n]/g, "")}"`,
      },
    });
  } catch (e) {
    return dbError(e);
  }
}

function parseFilter(sp: URLSearchParams) {
  const column = sp.get("fcol");
  const op = sp.get("fop");
  if (!column || !op) return null;
  const ops = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "null", "notnull"] as const;
  if (!(ops as readonly string[]).includes(op)) return null;
  return { column, op: op as (typeof ops)[number], value: sp.get("fval") ?? "" };
}
