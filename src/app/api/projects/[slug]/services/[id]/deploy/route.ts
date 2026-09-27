import { NextRequest, NextResponse } from "next/server";
import { projectAllowed } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { deployService, deploymentToItem, getService } from "@/lib/services";
import { serviceError } from "../../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Запускает деплой как задачу агента и сразу возвращает строку деплоя
// (status = in_progress); лог и результат — через GET /deployments/<id>.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  if (!(await projectAllowed(req, params))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  try {
    const body = (await req.json().catch(() => ({}))) as { image?: string };
    const row = await deployService(slug, project.id, id, { image: body.image });
    const service = await getService(project.id, id);
    return NextResponse.json({ deployment: deploymentToItem(row, service?.name ?? null) }, { status: 202 });
  } catch (e) {
    return serviceError(e);
  }
}
