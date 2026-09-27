import { NextRequest, NextResponse } from "next/server";
import { projectAllowed } from "@/lib/auth";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getProject } from "@/lib/projects";
import { agentRef, AgentError } from "@/lib/agent";
import { agentSql } from "@/lib/project-conn";
import { encryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Подключение базы к проекту: строка postgresql://… проверяется ЧЕРЕЗ АГЕНТ
 * сервера проекта (так же, как потом пойдут все запросы — база клиента наружу
 * не смотрит), и только после удачного `select` сохраняется шифрованной.
 * Одна база на проект: повторный вызов заменяет строку.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await projectAllowed(req, params))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  if (!project.serverId) return NextResponse.json({ error: "Project has no server with an agent" }, { status: 409 });

  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!/^postgres(ql)?:\/\/.+/.test(url)) return NextResponse.json({ error: "Connection string must be postgresql://…" }, { status: 400 });

  const server = await db.query.servers.findFirst({ where: eq(schema.servers.id, project.serverId) });
  if (!server) return NextResponse.json({ error: "Project server not found" }, { status: 409 });

  let name: string;
  try {
    const rows = await agentSql(agentRef(server), url).unsafe("select current_database() as name");
    name = String(rows[0]?.name ?? "postgres");
  } catch (e) {
    const status = e instanceof AgentError && e.status < 500 ? 400 : 502;
    return NextResponse.json({ error: `Could not connect from the server: ${e instanceof Error ? e.message : String(e)}` }, { status });
  }

  const existing = await db
    .select({ id: schema.databases.id })
    .from(schema.databases)
    .where(eq(schema.databases.projectId, project.id))
    .orderBy(asc(schema.databases.createdAt))
    .limit(1);
  if (existing[0]) {
    await db
      .update(schema.databases)
      .set({ name, urlEnc: encryptSecret(url), serverId: server.id })
      .where(eq(schema.databases.id, existing[0].id));
  } else {
    await db.insert(schema.databases).values({ projectId: project.id, serverId: server.id, name, engine: "postgres", urlEnc: encryptSecret(url) });
  }
  return NextResponse.json({ ok: true, name });
}
