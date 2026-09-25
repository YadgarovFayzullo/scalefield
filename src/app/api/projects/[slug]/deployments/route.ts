import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { db, schema } from "@/db";
import { getProject, projectRepos } from "@/lib/projects";
import { deploymentToItem, syncDeployment } from "@/lib/services";
import type { Deployment, DeploymentsData } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Деплои проекта. Источник сегодня — прогоны GitHub Actions по репозиториям
 * сервисов проекта; они синхронизируются в таблицу `deployments`, и ответ
 * собирается из неё — так история переживает рестарты и не зависит от лимита
 * GitHub API (5000 запросов в час на токен). Синк не чаще раза в 30 с на
 * проект. Когда появится собственный билдер, он будет писать в ту же таблицу.
 */
const TOKEN = process.env.GITHUB_TOKEN || "";
const SYNC_MS = 30_000;
// Момент и ошибки последнего синка по проекту: ошибки показываем и между
// синками, иначе «репозиторий недоступен» мелькал бы раз в 30 с.
const lastSync = new Map<string, { at: number; errors: string[] }>();

type Run = {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  display_title: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  run_started_at?: string;
  html_url: string;
  actor?: { login?: string; avatar_url?: string };
  event: string;
};

async function fetchRuns(repo: string): Promise<Run[]> {
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=25`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${repo}: GitHub API ${res.status}`);
  const json = (await res.json()) as { workflow_runs: Run[] };
  return json.workflow_runs;
}

async function syncProject(projectId: string): Promise<string[]> {
  const repos = await projectRepos(projectId);
  const results = await Promise.allSettled(
    repos.map(async ({ repo, serviceId }) => {
      const runs = await fetchRuns(repo);
      if (runs.length === 0) return;
      const rows = runs.map((r) => {
        const started = new Date(r.run_started_at || r.created_at);
        const updated = new Date(r.updated_at);
        return {
          projectId,
          serviceId,
          source: "github_actions",
          externalId: `${repo}#${r.id}`,
          repo,
          workflow: r.name,
          branch: r.head_branch,
          sha: r.head_sha,
          title: r.display_title,
          event: r.event,
          status: r.status,
          conclusion: r.conclusion,
          actor: r.actor?.login || "",
          actorAvatar: r.actor?.avatar_url || "",
          url: r.html_url,
          startedAt: started,
          updatedAt: updated,
          durationS:
            r.status === "completed"
              ? Math.max(0, Math.round((updated.getTime() - started.getTime()) / 1000))
              : null,
        };
      });
      await db
        .insert(schema.deployments)
        .values(rows)
        .onConflictDoUpdate({
          target: [schema.deployments.source, schema.deployments.externalId],
          set: {
            status: sql`excluded.status`,
            conclusion: sql`excluded.conclusion`,
            updatedAt: sql`excluded.updated_at`,
            durationS: sql`excluded.duration_s`,
            title: sql`excluded.title`,
          },
        });
    }),
  );
  return results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => String(r.reason?.message || r.reason));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });

  const repos = await projectRepos(project.id);

  let state = lastSync.get(project.id);
  if (repos.length > 0 && (!state || Date.now() - state.at > SYNC_MS)) {
    state = { at: Date.now(), errors: [] };
    lastSync.set(project.id, state);
    state.errors = await syncProject(project.id);
  }
  const errors = state?.errors ?? [];

  const rows = await db
    .select()
    .from(schema.deployments)
    .where(eq(schema.deployments.projectId, project.id))
    .orderBy(desc(schema.deployments.startedAt))
    .limit(100);
  const serviceNames = new Map(project.services.map((s) => [s.id, s.name]));
  const serviceDomains = new Map(project.services.map((s) => [s.id, s.domains.map((d) => d.hostname)]));

  // Незавершённые задачи агента — подтянуть состояние, чтобы список был живым.
  const synced = await Promise.all(rows.map((r) => (r.source === "scalefield" && r.status !== "completed" ? syncDeployment(slug, r) : r)));
  const items: Deployment[] = synced.map((r) =>
    deploymentToItem(r, r.serviceId ? (serviceNames.get(r.serviceId) ?? null) : null, r.serviceId ? (serviceDomains.get(r.serviceId) ?? []) : []),
  );
  return NextResponse.json({ configured: true, items, errors } satisfies DeploymentsData);
}
