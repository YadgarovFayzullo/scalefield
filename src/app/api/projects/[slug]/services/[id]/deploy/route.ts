import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { getProject } from "@/lib/projects";
import { deployService } from "@/lib/services";
import { serviceError } from "../../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Деплой ждёт `docker compose up` (pull образа может идти минуты).
export const maxDuration = 660;

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  if (!(await isValidSession(req.cookies.get(COOKIE_NAME)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  try {
    const body = (await req.json().catch(() => ({}))) as { image?: string };
    const { deployment, service, result } = await deployService(slug, project.id, id, { image: body.image });
    return NextResponse.json(
      { ok: result.ok, output: result.output, container: result.container, service, deployment_id: deployment.externalId },
      { status: result.ok ? 200 : 502 },
    );
  } catch (e) {
    return serviceError(e);
  }
}
