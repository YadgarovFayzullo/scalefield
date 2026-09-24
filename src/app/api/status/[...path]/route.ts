import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Серверный прокси к статус-API (researcher-uz-status/api). Токен
// STATUS_API_TOKEN живёт только на сервере и в браузер не попадает — клиент
// ходит на /api/status/... под своей сессией.
const STATUS_API_URL = process.env.STATUS_API_URL || "http://localhost:8001";
const STATUS_API_TOKEN = process.env.STATUS_API_TOKEN || "";

// Только известные пути — чтобы прокси не стал SSRF. Query-параметры
// (limit/level/host/name/tail) пробрасываем как есть: их валидирует сам API.
const ALLOWED = new Set([
  "summary",
  "server",
  "database",
  "api",
  "content",
  "logs",
  "container-logs",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const key = path.join("/");
  if (!ALLOWED.has(key)) {
    return NextResponse.json({ error: "Unknown metric" }, { status: 404 });
  }

  const qs = req.nextUrl.search;
  try {
    const upstream = await fetch(`${STATUS_API_URL}/status/${key}${qs}`, {
      headers: { "X-Status-Token": STATUS_API_TOKEN },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Статус-API недоступен", detail: String(e) },
      { status: 502 },
    );
  }
}
