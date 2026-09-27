import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { agentRef, type AgentRef } from "@/lib/agent";
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

/** Проекты организаций пользователя (`orgIds`) — чужие не попадают даже в переключатель. */
export async function listProjects(orgIds: string[]): Promise<ProjectSummary[]> {
  if (orgIds.length === 0) return [];
  const rows = await db.query.projects.findMany({
    where: inArray(schema.projects.orgId, orgIds),
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

/** Проект и ссылка на его агента (`AgentRef`) — только для серверного кода, в браузер не отдавать. */
export async function getProjectAgent(slug: string): Promise<({ project: Project } & AgentRef) | null> {
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.slug, slug) });
  if (!project || !project.serverId) return null;
  const server = await db.query.servers.findFirst({ where: eq(schema.servers.id, project.serverId) });
  if (!server) return null;
  return { project, ...agentRef(server) };
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

export class ProjectError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "project"
  );
}

/** Свободный слаг — глобально (адрес проекта `/p/<slug>` без команды). */
async function freeProjectSlug(base: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.slug, slug)).limit(1);
    if (!taken.length) return slug;
  }
  throw new ProjectError("Could not pick a free project name", 409);
}

/** Новый проект команды; сервер — только из этой же команды. */
export async function createProject(orgId: string, input: { name: string; serverId: string | null }): Promise<Project> {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new ProjectError("Project name is required");
  if (input.serverId) {
    const server = await db.query.servers.findFirst({ where: and(eq(schema.servers.id, input.serverId), eq(schema.servers.orgId, orgId)) });
    if (!server) throw new ProjectError("Unknown server", 404);
  }
  const slug = await freeProjectSlug(slugify(name));
  const [row] = await db.insert(schema.projects).values({ orgId, slug, name, serverId: input.serverId, settings: {} }).returning();
  return row;
}
