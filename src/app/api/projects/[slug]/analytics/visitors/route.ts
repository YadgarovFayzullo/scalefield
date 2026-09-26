import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { getProjectAgent } from "@/lib/projects";
import { hasTrackedViews, visitorsFromDb } from "@/lib/visitors-db";
import { listServices } from "@/lib/services";
import type { VisitorsData } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Посетители проекта: предпочитает реальные события клиентского трекера
 * (`page_views`, см. src/app/api/collect) — они точнее и ловят SPA-переходы;
 * если трекер ещё не стоит на сайте, честно падает на разбор лога прокси
 * агента (`/status/visitors`), который работал и раньше. Источник помечен
 * в ответе (`source`), чтобы страница показала подсказку «поставь трекер»
 * только когда это действительно так, а не всегда.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isValidSession(req.cookies.get(COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const days = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 7));

  let agent: Awaited<ReturnType<typeof getProjectAgent>>;
  try {
    agent = await getProjectAgent(slug);
  } catch (e) {
    return NextResponse.json({ error: "Control-plane недоступен", detail: String(e) }, { status: 502 });
  }
  if (!agent) return NextResponse.json({ error: "Unknown project" }, { status: 404 });

  if (await hasTrackedViews(agent.project.id)) {
    const data = await visitorsFromDb(agent.project.id, days);
    return NextResponse.json({ ...data, source: "script" });
  }

  // На общем сервере трафик режем по доменам проекта — тот же принцип, что
  // у общего прокси /status/[...path] для этого же ключа.
  const domains = (await listServices(agent.project.id)).flatMap((s) => s.domains);
  const hostsQs = domains.length > 0 ? `&hosts=${encodeURIComponent(domains.join(","))}` : "";
  try {
    const upstream = await fetch(`${agent.agentUrl}/status/visitors?days=${days}${hostsQs}`, {
      headers: { "X-Status-Token": agent.agentToken },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const body = (await upstream.json()) as VisitorsData;
    return NextResponse.json({ ...body, source: "logs" });
  } catch (e) {
    return NextResponse.json({ error: "Агент недоступен", detail: String(e) }, { status: 502 });
  }
}
