import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { verifyWebhook } from "@/lib/github-app";
import { buildService } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Единый webhook GitHub App (как у Vercel — не по webhook'у на сервис):
 *  - push → сборка сервисов с этим репозиторием, веткой и autoDeploy, но
 *    только в командах, к которым привязана установка, приславшая событие;
 *  - installation deleted → отвязываем установку от всех команд.
 * Подпись — webhook secret приложения. Ответ сразу, сборка у агента в фоне.
 */
type PushPayload = {
  ref?: string;
  after?: string;
  deleted?: boolean;
  repository?: { full_name?: string };
  installation?: { id?: number };
  pusher?: { name?: string };
  head_commit?: { message?: string };
};

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!(await verifyWebhook(raw, req.headers.get("x-hub-signature-256")))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  const event = req.headers.get("x-github-event") || "";
  let payload: PushPayload & { action?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  if (event === "ping") return NextResponse.json({ ok: true, pong: true });

  if (event === "installation" && payload.action === "deleted" && payload.installation?.id) {
    await db.delete(schema.githubInstallations).where(eq(schema.githubInstallations.installationId, String(payload.installation.id)));
    return NextResponse.json({ ok: true, removed: payload.installation.id });
  }

  if (event !== "push") return NextResponse.json({ ok: true, ignored: event });
  const repo = payload.repository?.full_name;
  const installationId = payload.installation?.id ? String(payload.installation.id) : null;
  const branch = (payload.ref || "").replace(/^refs\/heads\//, "");
  if (!repo || !installationId || payload.deleted) return NextResponse.json({ ok: true, ignored: "no repo/installation" });

  const targets = await db
    .select({ service: schema.services, project: schema.projects })
    .from(schema.services)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.services.projectId))
    .innerJoin(
      schema.githubInstallations,
      and(eq(schema.githubInstallations.orgId, schema.projects.orgId), eq(schema.githubInstallations.installationId, installationId)),
    )
    .where(and(sql`lower(${schema.services.repo}) = ${repo.toLowerCase()}`, eq(schema.services.autoDeploy, true)));

  const started: string[] = [];
  const errors: string[] = [];
  for (const { service, project } of targets) {
    if ((service.branch || "main") !== branch) continue;
    try {
      const row = await buildService(project.slug, project.id, service.id, {
        ref: branch,
        sha: payload.after,
        actor: payload.pusher?.name || "github",
        event: "push",
        title: (payload.head_commit?.message || `push ${branch}`).split("\n")[0].slice(0, 200),
      });
      started.push(row.externalId);
    } catch (e) {
      errors.push(`${project.slug}/${service.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return NextResponse.json({ ok: errors.length === 0, started, errors }, { status: started.length ? 202 : 200 });
}
