import { NextRequest, NextResponse } from "next/server";
import { projectAllowed } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { getService, removeService, updateService, type ServiceInput } from "@/lib/services";
import { serviceError } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!(await projectAllowed(req, params))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  const service = await getService(project.id, id);
  return service ? NextResponse.json({ service }) : NextResponse.json({ error: "Unknown service" }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await projectAllowed(req, params))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  try {
    return NextResponse.json({ service: await updateService(project.id, id, (await req.json()) as ServiceInput) });
  } catch (e) {
    return serviceError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await projectAllowed(req, params))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  try {
    return NextResponse.json(await removeService(slug, project.id, id));
  } catch (e) {
    return serviceError(e);
  }
}
