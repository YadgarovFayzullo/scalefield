import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import {
  deleteRows,
  fetchRows,
  getProjectDatabase,
  insertRow,
  updateRow,
  type CellValue,
  type FilterOp,
  type RowFilter,
} from "@/lib/project-db";
import { dbError } from "../../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; schema: string; table: string }> };

async function authed(req: NextRequest): Promise<boolean> {
  return isValidSession(req.cookies.get(COOKIE_NAME)?.value);
}

const FILTER_OPS: FilterOp[] = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "null", "notnull"];

function parseFilter(sp: URLSearchParams): RowFilter | null {
  const column = sp.get("fcol");
  const op = sp.get("fop") as FilterOp | null;
  if (!column || !op) return null;
  if (!FILTER_OPS.includes(op)) return null;
  return { column, op, value: sp.get("fval") ?? "" };
}

/** Значения из UI: строки, null или числа/булевы (приводим к строке; типизирует SQL-каст). */
function cells(input: unknown): Record<string, CellValue> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, CellValue> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (v === null || v === undefined) out[k] = null;
    else if (typeof v === "object") out[k] = JSON.stringify(v);
    else out[k] = String(v);
  }
  return out;
}

// Страница строк с колонками, PK и счётчиком.
export async function GET(req: NextRequest, { params }: Ctx) {
  if (!(await authed(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, schema, table } = await params;
  const sp = req.nextUrl.searchParams;
  try {
    const { sql } = await getProjectDatabase(slug, sp.get("db") || undefined);
    const data = await fetchRows(sql, schema, table, {
      limit: Number(sp.get("limit") || 50),
      offset: Number(sp.get("offset") || 0),
      order: sp.get("order") || undefined,
      dir: sp.get("dir") === "desc" ? "desc" : "asc",
      filter: parseFilter(sp),
    });
    return NextResponse.json(data);
  } catch (e) {
    return dbError(e);
  }
}

// Правка одной строки: { pk: {...}, set: {...} }.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await authed(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, schema, table } = await params;
  try {
    const body = (await req.json()) as { pk?: unknown; set?: unknown; db?: string };
    const { sql } = await getProjectDatabase(slug, body.db);
    const row = await updateRow(sql, schema, table, cells(body.pk), cells(body.set));
    return NextResponse.json({ row });
  } catch (e) {
    return dbError(e);
  }
}

// Вставка: { values: {...} } — незаполненные колонки берут default.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!(await authed(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, schema, table } = await params;
  try {
    const body = (await req.json()) as { values?: unknown; db?: string };
    const { sql } = await getProjectDatabase(slug, body.db);
    const row = await insertRow(sql, schema, table, cells(body.values));
    return NextResponse.json({ row }, { status: 201 });
  } catch (e) {
    return dbError(e);
  }
}

// Удаление: { keys: [{pk...}, ...] }.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await authed(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, schema, table } = await params;
  try {
    const body = (await req.json()) as { keys?: unknown[]; db?: string };
    const { sql } = await getProjectDatabase(slug, body.db);
    const keys = Array.isArray(body.keys) ? body.keys.map(cells) : [];
    const deleted = await deleteRows(sql, schema, table, keys);
    return NextResponse.json({ deleted });
  } catch (e) {
    return dbError(e);
  }
}
