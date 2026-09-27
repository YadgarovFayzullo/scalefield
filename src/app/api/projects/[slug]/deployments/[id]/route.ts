import { NextRequest, NextResponse } from "next/server";
import { projectAllowed } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { deploymentToItem, getDeployment } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Один деплой с актуальным логом: пока задача агента идёт, лог подтягивается
// с агента при каждом запросе (панель поллит раз в 2 с).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  if (!(await projectAllowed(req, params))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  const row = await getDeployment(slug, project.id, id);
  if (!row) return NextResponse.json({ error: "Unknown deployment" }, { status: 404 });
  const service = row.serviceId ? project.services.find((s) => s.id === row.serviceId) : undefined;
  return NextResponse.json({ deployment: deploymentToItem(row, service?.name ?? null, service?.domains.map((d) => d.hostname) ?? []) });
}
