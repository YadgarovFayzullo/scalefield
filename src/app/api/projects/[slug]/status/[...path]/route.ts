import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { getProjectAgent } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Серверный прокси к агенту проекта. Адрес и токен агента берутся из
// control-plane (таблица servers), токен в браузер не попадает — клиент ходит
// сюда под своей сессией.
//
// Только известные пути — чтобы прокси не стал SSRF. Query-параметры
// (limit/level/host/name/tail) пробрасываем как есть: их валидирует агент.
const ALLOWED = new Set(["summary", "server", "database", "api", "content", "logs", "container-logs"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, path } = await params;
  const key = path.join("/");
  if (!ALLOWED.has(key)) {
    return NextResponse.json({ error: "Unknown metric" }, { status: 404 });
  }

  let agent: Awaited<ReturnType<typeof getProjectAgent>>;
  try {
    agent = await getProjectAgent(slug);
  } catch (e) {
    return NextResponse.json({ error: "Control-plane недоступен", detail: String(e) }, { status: 502 });
  }
  if (!agent) {
    return NextResponse.json({ error: "Project has no server" }, { status: 404 });
  }
  if (key === "content" && !agent.project.settings.contentMetrics) {
    return NextResponse.json({ error: "Content metrics are disabled for this project" }, { status: 404 });
  }

  const qs = req.nextUrl.search;
  try {
    const upstream = await fetch(`${agent.agentUrl}/status/${key}${qs}`, {
      headers: { "X-Status-Token": agent.agentToken },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return NextResponse.json({ error: "Агент недоступен", detail: String(e) }, { status: 502 });
  }
}
