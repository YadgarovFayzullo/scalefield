import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret } from "@/lib/secrets";
import type { Domain, Project, Server, Service } from "@/db/schema";

/**
 * Реестр проектов control-plane: то, что раньше жило в env
 * (STATUS_API_URL, GITHUB_REPOS), теперь читается из базы. Все функции
 * серверные; страницы получают slug из URL `/p/<slug>/...`.
 */

export type ProjectSummary = Project & {
  server: Pick<Server, "id" | "name" | "host" | "provider"> | null;
  services: (Service & { domains: Domain[] })[];
};

export async function listProjects(): Promise<ProjectSummary[]> {
  const rows = await db.query.projects.findMany({
    orderBy: [asc(schema.projects.createdAt)],
    with: {
      server: { columns: { id: true, name: true, host: true, provider: true } },
      services: { with: { domains: true } },
    },
  });
  return rows as ProjectSummary[];
}

export async function getProject(slug: string): Promise<ProjectSummary | null> {
  const row = await db.query.projects.findFirst({
    where: eq(schema.projects.slug, slug),
    with: {
      server: { columns: { id: true, name: true, host: true, provider: true } },
      services: { with: { domains: true } },
    },
  });
  return (row as ProjectSummary | undefined) ?? null;
}

/** Адрес и токен агента проекта — только для серверных прокси, в браузер не отдавать. */
export async function getProjectAgent(
  slug: string,
): Promise<{ project: Project; agentUrl: string; agentToken: string } | null> {
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.slug, slug) });
  if (!project || !project.serverId) return null;
  const server = await db.query.servers.findFirst({ where: eq(schema.servers.id, project.serverId) });
  if (!server) return null;
  return {
    project,
    agentUrl: server.agentUrl.replace(/\/+$/, ""),
    agentToken: decryptSecret(server.agentTokenEnc),
  };
}

/** Репозитории проекта, из которых собираются деплои (через сервисы). */
export async function projectRepos(projectId: string): Promise<{ repo: string; serviceId: string }[]> {
  const rows = await db
    .select({ repo: schema.services.repo, serviceId: schema.services.id })
    .from(schema.services)
    .where(and(eq(schema.services.projectId, projectId)));
  const seen = new Set<string>();
  const out: { repo: string; serviceId: string }[] = [];
  for (const r of rows) {
    if (r.repo && !seen.has(r.repo)) {
      seen.add(r.repo);
      out.push({ repo: r.repo, serviceId: r.serviceId });
    }
  }
  return out;
}
