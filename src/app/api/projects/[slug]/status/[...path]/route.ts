import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { getProjectAgent } from "@/lib/projects";
import { listServices } from "@/lib/services";
import { projectContainerFilter } from "@/lib/container-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Серверный прокси к агенту проекта. Адрес и токен агента берутся из
// control-plane (таблица servers), токен в браузер не попадает — клиент ходит
// сюда под своей сессией.
//
// Только известные пути — чтобы прокси не стал SSRF. Query-параметры
// (limit/level/host/name/tail) пробрасываем как есть: их валидирует агент,
// но `name` у container-logs проверяем сами (см. ниже) — иначе один проект
// на общем сервере читал бы логи чужого контейнера.
const ALLOWED = new Set(["summary", "server", "database", "api", "content", "logs", "container-logs"]);

// Ключи, под которыми в ответе агента лежит список контейнеров хоста —
// их нужно обрезать до контейнеров ЭТОГО проекта перед отдачей в браузер.
const CONTAINER_LIST_PATHS: Record<string, string[]> = {
  summary: ["server", "containers"],
  server: ["containers"],
};

function filterContainers(body: unknown, path: string[], belongs: (name: string) => boolean): unknown {
  if (body == null || typeof body !== "object") return body;
  if (path.length === 0) return body;
  const [head, ...rest] = path;
  const obj = body as Record<string, unknown>;
  if (!(head in obj)) return body;
  if (rest.length === 0) {
    const list = obj[head];
    if (!Array.isArray(list)) return body;
    return { ...obj, [head]: list.filter((c) => typeof c?.name === "string" && belongs(c.name)) };
  }
  return { ...obj, [head]: filterContainers(obj[head], rest, belongs) };
}

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

  // Только для путей, которым нужна принадлежность контейнера — не тянуть
  // сервисы проекта на каждый опрос трафика/БД/логов зря.
  const needsScope = key in CONTAINER_LIST_PATHS || key === "container-logs";
  const belongs = needsScope ? projectContainerFilter(slug, await listServices(agent.project.id)) : null;

  if (key === "container-logs") {
    const name = req.nextUrl.searchParams.get("name") || "";
    if (!belongs!(name)) {
      return NextResponse.json({ error: "Unknown container for this project" }, { status: 404 });
    }
  }

  const qs = req.nextUrl.search;
  try {
    const upstream = await fetch(`${agent.agentUrl}/status/${key}${qs}`, {
      headers: { "X-Status-Token": agent.agentToken },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    let body = await upstream.text();
    if (upstream.ok && belongs && key in CONTAINER_LIST_PATHS) {
      try {
        const json = filterContainers(JSON.parse(body), CONTAINER_LIST_PATHS[key], belongs);
        body = JSON.stringify(json);
      } catch {
        // Ответ не JSON или неожиданной формы — отдаём как есть, лучше
        // показать чужое один раз, чем сломать раздел полностью.
      }
    }
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return NextResponse.json({ error: "Агент недоступен", detail: String(e) }, { status: 502 });
  }
}
