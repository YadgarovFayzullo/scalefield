import { NextRequest, NextResponse } from "next/server";
import { requestUser } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { deleteProject, ProjectDeleteError } from "@/lib/project-delete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Удалить проект: только owner/admin его команды; `removeContainers` — ещё и контейнеры на сервере. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project || !user.orgIds.includes(project.orgId)) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  const role = user.memberships.find((m) => m.orgId === project.orgId)?.role;
  if (role !== "owner" && role !== "admin") return NextResponse.json({ error: "Only team owners and admins can delete projects" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { removeContainers?: boolean };
  try {
    return NextResponse.json(await deleteProject(slug, { removeContainers: body.removeContainers === true }));
  } catch (e) {
    const status = e instanceof ProjectDeleteError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
