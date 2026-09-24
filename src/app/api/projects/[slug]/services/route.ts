import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { getProject } from "@/lib/projects";
import { createService, listServices, ServiceError, type ServiceInput } from "@/lib/services";
import { AgentError } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function serviceError(e: unknown) {
  if (e instanceof ServiceError || e instanceof AgentError) return NextResponse.json({ error: e.message }, { status: e.status });
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isValidSession(req.cookies.get(COOKIE_NAME)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  return NextResponse.json({ services: await listServices(project.id) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isValidSession(req.cookies.get(COOKIE_NAME)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  try {
    const service = await createService(project.id, (await req.json()) as ServiceInput);
    return NextResponse.json({ service }, { status: 201 });
  } catch (e) {
    return serviceError(e);
  }
}
