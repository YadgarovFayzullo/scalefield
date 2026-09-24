import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { getProject } from "@/lib/projects";
import { getService, serviceImages } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Успешно задеплоенные образы сервиса — список для отката.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  if (!(await isValidSession(req.cookies.get(COOKIE_NAME)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  const service = await getService(project.id, id);
  if (!service) return NextResponse.json({ error: "Unknown service" }, { status: 404 });
  return NextResponse.json({ current: service.image, images: await serviceImages(id) });
}
