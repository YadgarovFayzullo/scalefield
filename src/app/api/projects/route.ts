import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { primaryOrgId, requestUser } from "@/lib/auth";
import { createProject, ProjectError } from "@/lib/projects";
import { buildService, createService, ServiceError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportBody = {
  name?: string;
  repo?: string;
  branch?: string;
  serverId?: string | null;
  port?: number | null;
  dockerfile?: string;
  domain?: string;
  deploy?: boolean;
};

/**
 * Импорт репозитория как в Vercel: проект + web-сервис из репозитория с
 * автодеплоем по push, и сразу первая сборка на выбранном сервере. Доступ к
 * репозиторию — через установку GitHub App команды (проверяется на сборке).
 */
export async function POST(req: NextRequest) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = primaryOrgId(user);
  const role = user.memberships.find((m) => m.orgId === orgId)?.role;
  if (!orgId || (role !== "owner" && role !== "admin")) return NextResponse.json({ error: "Only team owners and admins can create projects" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as ImportBody;
  const repo = (body.repo || "").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return NextResponse.json({ error: "Pick a repository" }, { status: 400 });
  const serviceName =
    repo
      .split("/")[1]
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^[-_]+/, "")
      .slice(0, 60) || "web";

  let projectId: string | null = null;
  try {
    const project = await createProject(orgId, { name: body.name || repo.split("/")[1], serverId: body.serverId || null });
    projectId = project.id;
    const service = await createService(project.id, {
      name: serviceName,
      kind: "web",
      repo,
      branch: (body.branch || "main").trim(),
      dockerfile: (body.dockerfile || "Dockerfile").trim(),
      port: body.port ?? 3000,
      domains: body.domain ? [body.domain.trim().toLowerCase()] : [],
      autoDeploy: true,
    });

    // Первая сборка — если сервер выбран; её ошибка не отменяет импорт
    // (проект создан, сборку можно повторить со страницы сервиса).
    let deployError: string | null = null;
    if (body.deploy !== false && project.serverId) {
      try {
        await buildService(project.slug, project.id, service.id, {
          ref: service.branch || "main",
          actor: user.githubLogin || user.email,
          event: "import",
          title: `Import ${repo}`,
        });
      } catch (e) {
        deployError = e instanceof Error ? e.message : String(e);
      }
    }
    return NextResponse.json({ project: { slug: project.slug, name: project.name }, deployError }, { status: 201 });
  } catch (e) {
    // Сервис не создался — не оставляем пустой проект-сироту.
    if (projectId) await db.delete(schema.projects).where(eq(schema.projects.id, projectId));
    if (e instanceof ProjectError || e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
