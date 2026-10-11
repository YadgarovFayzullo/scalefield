import { NextRequest, NextResponse } from "next/server";
import { projectAllowed } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { hasTrackedViews, visitorsFromDb } from "@/lib/visitors-db";
import type { VisitorsData } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Посетители проекта — только из событий трекера (`page_views`, см.
 * public/script.js и src/app/api/collect), как у Vercel Web Analytics.
 *
 * Разбора access-лога прокси здесь больше нет: он привязывал аналитику к
 * Traefik и серверу, на котором стоит агент, и не видел SPA-переходов. Нет
 * событий — `configured: false`, и страница показывает строку установки
 * скрипта для этого проекта.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await projectAllowed(req, params))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const days = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 7));

  let project: Awaited<ReturnType<typeof getProject>>;
  try {
    project = await getProject(slug);
  } catch (e) {
    return NextResponse.json({ error: "Control-plane недоступен", detail: String(e) }, { status: 502 });
  }
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });

  if (!(await hasTrackedViews(project.id))) {
    return NextResponse.json({ configured: false, window_days: days } satisfies VisitorsData);
  }
  return NextResponse.json(await visitorsFromDb(project.id, days));
}
