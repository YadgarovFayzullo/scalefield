import "server-only";
import { eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { hashAgentToken } from "@/lib/agent-token";

/**
 * Первичное заполнение control-plane из env, чтобы существующая установка
 * (один сервер, один проект) поднялась без ручного SQL. Идемпотентно: если
 * организация уже есть — ничего не делает. Дальше проекты правятся в базе.
 *
 * Читает: STATUS_API_TOKEN (токен агента; STATUS_API_URL — только для
 * переходного прямого режима, без него сервер ждёт агента через relay),
 * GITHUB_REPOS (сервисы), BOOTSTRAP_ORG, BOOTSTRAP_PROJECT_SLUG / _NAME,
 * BOOTSTRAP_SERVER_HOST.
 */
export async function bootstrapFromEnv(): Promise<void> {
  const existing = await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1);
  if (existing.length > 0) {
    await ensureAgentTokenHashes();
    await ensureDatabaseFromEnv();
    return;
  }

  const agentUrl = process.env.STATUS_API_URL || null;
  const agentToken = process.env.STATUS_API_TOKEN;
  if (!agentToken) {
    console.warn("[scalefield] control-plane пустой, а STATUS_API_TOKEN не задан — бутстрап пропущен");
    return;
  }

  const orgSlug = process.env.BOOTSTRAP_ORG || "scalefield";
  const projectSlug = process.env.BOOTSTRAP_PROJECT_SLUG || "researcher-uz";
  const projectName = process.env.BOOTSTRAP_PROJECT_NAME || "researcher.uz";
  const serverHost = process.env.BOOTSTRAP_SERVER_HOST || "localhost";
  const repos = (process.env.GITHUB_REPOS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(schema.organizations)
      .values({ slug: orgSlug, name: orgSlug })
      .returning();
    const [server] = await tx
      .insert(schema.servers)
      .values({
        orgId: org.id,
        name: serverHost,
        host: serverHost,
        agentUrl,
        agentTokenEnc: encryptSecret(agentToken),
        agentTokenHash: hashAgentToken(agentToken),
      })
      .returning();
    const [project] = await tx
      .insert(schema.projects)
      .values({
        orgId: org.id,
        slug: projectSlug,
        name: projectName,
        serverId: server.id,
        settings: { contentMetrics: true },
      })
      .returning();
    if (repos.length > 0) {
      await tx.insert(schema.services).values(
        repos.map((repo) => ({
          projectId: project.id,
          name: repo.split("/").pop() || repo,
          kind: "web",
          repo,
        })),
      );
    }
  });
  console.log(`[scalefield] control-plane инициализирован: org=${orgSlug} project=${projectSlug}`);
  await ensureDatabaseFromEnv();
}

/**
 * Серверы, заведённые до появления `agent_token_hash`, получают хеш из
 * расшифрованного токена — иначе relay не узнает их агента. Идемпотентно.
 */
async function ensureAgentTokenHashes(): Promise<void> {
  const rows = await db
    .select({ id: schema.servers.id, enc: schema.servers.agentTokenEnc })
    .from(schema.servers)
    .where(isNull(schema.servers.agentTokenHash));
  for (const r of rows) {
    await db
      .update(schema.servers)
      .set({ agentTokenHash: hashAgentToken(decryptSecret(r.enc)) })
      .where(eq(schema.servers.id, r.id));
  }
  if (rows.length > 0) console.log(`[scalefield] хеш токена агента проставлен ${rows.length} серверам`);
}

/**
 * Регистрирует базу проекта из BOOTSTRAP_DATABASE_URL, если у проекта ещё нет
 * ни одной: редактору таблиц нужна строка подключения, а она появилась позже
 * первого бутстрапа. Идемпотентно.
 */
async function ensureDatabaseFromEnv(): Promise<void> {
  const url = process.env.BOOTSTRAP_DATABASE_URL;
  if (!url) return;
  const projectSlug = process.env.BOOTSTRAP_PROJECT_SLUG || "researcher-uz";
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.slug, projectSlug) });
  if (!project) return;
  const has = await db
    .select({ id: schema.databases.id })
    .from(schema.databases)
    .where(eq(schema.databases.projectId, project.id))
    .limit(1);
  if (has.length > 0) return;
  let name = "postgres";
  try {
    name = new URL(url).pathname.replace(/^\//, "") || name;
  } catch {
    /* оставляем имя по умолчанию */
  }
  await db.insert(schema.databases).values({
    projectId: project.id,
    serverId: project.serverId,
    name,
    engine: "postgres",
    urlEnc: encryptSecret(url),
  });
  console.log(`[scalefield] база ${name} зарегистрирована у проекта ${projectSlug}`);
}

export async function projectExists(slug: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.slug, slug))
    .limit(1);
  return rows.length > 0;
}
