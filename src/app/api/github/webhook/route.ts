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
 *  - workflow_run completed/success → деплой сервисов, у которых задан
 *    `workflow` с этим именем: они ждут зелёного CI, а не сам push;
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
  workflow_run?: {
    name?: string;
    status?: string;
    conclusion?: string | null;
    event?: string;
    head_branch?: string;
    head_sha?: string;
    display_title?: string;
    actor?: { login?: string };
  };
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

  if (event !== "push" && event !== "workflow_run") return NextResponse.json({ ok: true, ignored: event });
  const run = payload.workflow_run;
  if (event === "workflow_run" && (payload.action !== "completed" || run?.conclusion !== "success" || run?.event !== "push")) {
    return NextResponse.json({ ok: true, ignored: `workflow_run ${payload.action}/${run?.conclusion}/${run?.event}` });
  }
  const repo = payload.repository?.full_name;
  const installationId = payload.installation?.id ? String(payload.installation.id) : null;
  const branch = event === "push" ? (payload.ref || "").replace(/^refs\/heads\//, "") : run?.head_branch || "";
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
    // Сервис с workflow деплоится по его успеху, а не по самому push — и наоборот.
    const waitsForCi = Boolean(service.workflow?.trim());
    if (event === "push" ? waitsForCi : !waitsForCi || service.workflow!.trim().toLowerCase() !== (run?.name || "").toLowerCase()) continue;
    try {
      const row = await buildService(project.slug, project.id, service.id, {
        ref: branch,
        sha: event === "push" ? payload.after : run?.head_sha,
        actor: (event === "push" ? payload.pusher?.name : run?.actor?.login) || "github",
        event: event === "push" ? "push" : `ci: ${run?.name}`,
        title: ((event === "push" ? payload.head_commit?.message : run?.display_title) || `push ${branch}`).split("\n")[0].slice(0, 200),
      });
      started.push(row.externalId);
    } catch (e) {
      errors.push(`${project.slug}/${service.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return NextResponse.json({ ok: errors.length === 0, started, errors }, { status: started.length ? 202 : 200 });
}
