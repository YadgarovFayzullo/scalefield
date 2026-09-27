import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { getProjectAgent } from "@/lib/projects";
import { AgentError, agentRaw, type AgentRawResponse } from "@/lib/agent";
import { listServices } from "@/lib/services";
import { projectContainerFilter } from "@/lib/container-scope";
import { getProjectDatabaseTarget, NO_DATABASE } from "@/lib/project-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Серверный прокси к агенту проекта. Адрес и токен агента берутся из
// control-plane (таблица servers), токен в браузер не попадает — клиент ходит
// сюда под своей сессией.
//
// Только известные пути — чтобы прокси не стал SSRF. И главное правило:
// каждый ответ — про ЭТОТ проект, а не про весь сервер. Агент один на
// сервер и знает всё, что на нём есть (контейнеры, лог прокси, базы), поэтому
// срез делаем здесь:
//  - summary/server — контейнеры только проекта (container-scope);
//  - database/summary — база проекта из `databases`, а не та, что прописана
//    агенту; нет базы — «не подключена», а не чужие цифры;
//  - api/logs/visitors — только запросы к доменам проекта; нет доменов —
//    «не настроено» (трафик на сервере различается только по домену);
//  - container-logs — только контейнер проекта.
const ALLOWED = new Set(["summary", "server", "database", "api", "content", "logs", "container-logs", "visitors"]);

// Ключи, под которыми в ответе агента лежит список контейнеров хоста —
// их нужно обрезать до контейнеров ЭТОГО проекта перед отдачей в браузер.
const CONTAINER_LIST_PATHS: Record<string, string[]> = {
  summary: ["server", "containers"],
  server: ["containers"],
};

// Разделы, которые на общем сервере различаются только по домену запроса.
const BY_DOMAIN = new Set(["api", "logs", "visitors"]);

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

  const needsServices = key in CONTAINER_LIST_PATHS || key === "container-logs" || BY_DOMAIN.has(key);
  const services = needsServices ? await listServices(agent.project.id) : [];
  const belongs = key in CONTAINER_LIST_PATHS || key === "container-logs" ? projectContainerFilter(slug, services) : null;

  if (key === "container-logs") {
    const name = req.nextUrl.searchParams.get("name") || "";
    if (!belongs!(name)) {
      return NextResponse.json({ error: "Unknown container for this project" }, { status: 404 });
    }
  }

  const qsParams = new URLSearchParams(req.nextUrl.search);
  if (BY_DOMAIN.has(key)) {
    const domains = services.flatMap((s) => s.domains);
    if (domains.length === 0) {
      return NextResponse.json(
        { error: "Project has no domains — traffic on a shared server is matched by the project's domains. Add one in Services." },
        { status: 404 },
      );
    }
    qsParams.set("hosts", domains.join(","));
    // Фильтр по одному хосту из UI — только среди доменов проекта.
    const host = qsParams.get("host");
    if (host && !domains.includes(host)) qsParams.delete("host");
  }
  const qs = qsParams.toString() ? `?${qsParams.toString()}` : "";

  try {
    let upstream: AgentRawResponse;
    if (key === "database" || key === "summary") {
      const target = await getProjectDatabaseTarget(slug);
      if (key === "database" && !target) {
        return NextResponse.json({ error: NO_DATABASE }, { status: 404 });
      }
      upstream = await agentRaw(agent, `/status/${key}`, { method: "POST", body: { url: target?.url ?? null }, timeoutMs: 20000 });
    } else {
      upstream = await agentRaw(agent, `/status/${key}${qs}`, { timeoutMs: 20000 });
    }
    let body = upstream.text;
    if (upstream.status === 200 && belongs && key in CONTAINER_LIST_PATHS) {
      try {
        const json = filterContainers(JSON.parse(body), CONTAINER_LIST_PATHS[key], belongs);
        body = JSON.stringify(json);
      } catch {
        // Ответ не JSON или неожиданной формы — отдаём как есть, лучше
        // показать чужое один раз, чем сломать раздел полностью.
      }
    }
    if (upstream.status !== 200) {
      // Ошибка агента — в поле error, которое читает useMetric.
      try {
        const detail = (JSON.parse(body) as { detail?: unknown }).detail;
        if (typeof detail === "string") body = JSON.stringify({ error: detail });
      } catch {
        /* оставляем как есть */
      }
    }
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const status = e instanceof AgentError ? e.status : 502;
    return NextResponse.json({ error: "Агент недоступен", detail: e instanceof Error ? e.message : String(e) }, { status });
  }
}
