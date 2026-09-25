import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { agentRequest } from "@/lib/agent";
import { getProjectAgent } from "@/lib/projects";
import type { DeploymentRow, Domain, Service } from "@/db/schema";

/**
 * Сервисы проекта, деплой и сборка через агента.
 *
 * Сервис = контейнер: образ, порт, env, тома, домены. Деплой собирает из
 * этого описание для агента (`POST /jobs/deploy`), тот пишет compose-стек
 * `/opt/apps/<project>/docker-compose.yml` и делает `up -d --pull always`.
 * Сборка (`POST /jobs/build`) клонирует репозиторий на сервере, собирает
 * образ и деплоит его. Обе — фоновые задачи агента: строка в `deployments`
 * создаётся сразу со статусом in_progress, а `syncDeployment` подтягивает
 * лог и результат, пока клиент поллит.
 * Домены превращаются в лейблы Traefik (как у существующих стеков на сервере),
 * поэтому сервис с доменом попадает в сеть `edge`.
 */

export type ServiceView = Omit<Service, "envEnc" | "webhookSecretEnc" | "buildEnvEnc"> & {
  env: Record<string, string>;
  buildEnv: Record<string, string>;
  domains: string[];
  webhookSecret: string | null;
};

export class ServiceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;
const HOST_RE = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i;
// `owner/name` на GitHub или полный git-URL (GitLab, self-hosted, file:// для тестов).
const REPO_RE = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|(https?|ssh|git|file):\/\/\S+)$/;

function parseEnv(envEnc: string | null): Record<string, string> {
  if (!envEnc) return {};
  try {
    return JSON.parse(decryptSecret(envEnc)) as Record<string, string>;
  } catch {
    return {};
  }
}

function view(s: Service, domains: Domain[]): ServiceView {
  const { envEnc, webhookSecretEnc, buildEnvEnc, ...rest } = s;
  let webhookSecret: string | null = null;
  if (webhookSecretEnc) {
    try {
      webhookSecret = decryptSecret(webhookSecretEnc);
    } catch {
      webhookSecret = null;
    }
  }
  return {
    ...rest,
    env: parseEnv(envEnc),
    buildEnv: parseEnv(buildEnvEnc),
    domains: domains.filter((d) => d.serviceId === s.id).map((d) => d.hostname),
    webhookSecret,
  };
}

export async function listServices(projectId: string): Promise<ServiceView[]> {
  const rows = await db.select().from(schema.services).where(eq(schema.services.projectId, projectId)).orderBy(asc(schema.services.createdAt));
  const ids = rows.map((r) => r.id);
  const domains = ids.length ? await db.select().from(schema.domains).where(inArray(schema.domains.serviceId, ids)) : [];
  return rows.map((r) => view(r, domains));
}

export async function getService(projectId: string, id: string): Promise<ServiceView | null> {
  const rows = await db
    .select()
    .from(schema.services)
    .where(and(eq(schema.services.projectId, projectId), eq(schema.services.id, id)))
    .limit(1);
  if (!rows[0]) return null;
  const domains = await db.select().from(schema.domains).where(eq(schema.domains.serviceId, id));
  return view(rows[0], domains);
}

/** Для webhook: сервис по id вместе с проектом (без сессии — подпись проверяется секретом). */
export async function getServiceForHook(id: string): Promise<{ service: ServiceView; project: { id: string; slug: string } } | null> {
  const rows = await db.select().from(schema.services).where(eq(schema.services.id, id)).limit(1);
  if (!rows[0]) return null;
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, rows[0].projectId), columns: { id: true, slug: true } });
  if (!project) return null;
  const domains = await db.select().from(schema.domains).where(eq(schema.domains.serviceId, id));
  return { service: view(rows[0], domains), project };
}

export type ServiceInput = {
  name?: string;
  kind?: string;
  image?: string | null;
  port?: number | null;
  command?: string | null;
  repo?: string | null;
  container?: string | null;
  env?: Record<string, string>;
  buildEnv?: Record<string, string>;
  volumes?: string[];
  domains?: string[];
  branch?: string | null;
  dockerfile?: string | null;
  buildContext?: string | null;
  autoDeploy?: boolean;
  /** true — сгенерировать новый секрет webhook, false — удалить. */
  rotateWebhookSecret?: boolean;
};

function validate(input: ServiceInput) {
  if (input.name !== undefined && !NAME_RE.test(input.name)) throw new ServiceError("Service name: lowercase letters, digits, - and _");
  if (input.port !== undefined && input.port !== null && (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)) {
    throw new ServiceError("Port must be 1..65535");
  }
  if (input.repo && !REPO_RE.test(input.repo)) throw new ServiceError("Repository must be owner/name (GitHub) or a git URL");
  for (const d of input.domains ?? []) if (!HOST_RE.test(d)) throw new ServiceError(`Invalid domain: ${d}`);
  for (const v of input.volumes ?? []) if (!/^[^\s:]+:[^\s:]+(:(ro|rw))?$/.test(v)) throw new ServiceError(`Invalid volume: ${v}`);
  for (const k of Object.keys(input.env ?? {})) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) throw new ServiceError(`Invalid env name: ${k}`);
  for (const p of [input.dockerfile, input.buildContext]) {
    if (p && (p.includes("..") || p.startsWith("/"))) throw new ServiceError("Dockerfile/context must be a path inside the repository");
  }
}

export async function createService(projectId: string, input: ServiceInput): Promise<ServiceView> {
  if (!input.name) throw new ServiceError("Name is required");
  validate(input);
  const [row] = await db
    .insert(schema.services)
    .values({
      projectId,
      name: input.name,
      kind: input.kind || "web",
      image: input.image ?? null,
      container: input.container ?? null,
      port: input.port ?? null,
      command: input.command ?? null,
      repo: input.repo ?? null,
      envEnc: input.env && Object.keys(input.env).length ? encryptSecret(JSON.stringify(input.env)) : null,
      buildEnvEnc: input.buildEnv && Object.keys(input.buildEnv).length ? encryptSecret(JSON.stringify(input.buildEnv)) : null,
      volumes: input.volumes ?? [],
      branch: input.branch ?? null,
      dockerfile: input.dockerfile ?? null,
      buildContext: input.buildContext ?? null,
      autoDeploy: input.autoDeploy ?? false,
      webhookSecretEnc: input.rotateWebhookSecret ? encryptSecret(newSecret()) : null,
    })
    .returning();
  await setDomains(row.id, input.domains ?? []);
  return (await getService(projectId, row.id))!;
}

function newSecret(): string {
  return randomBytes(24).toString("hex");
}

export async function updateService(projectId: string, id: string, input: ServiceInput): Promise<ServiceView> {
  validate(input);
  const existing = await getService(projectId, id);
  if (!existing) throw new ServiceError("Unknown service", 404);
  const patch: Partial<typeof schema.services.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.image !== undefined) patch.image = input.image;
  if (input.port !== undefined) patch.port = input.port;
  if (input.command !== undefined) patch.command = input.command;
  if (input.repo !== undefined) patch.repo = input.repo;
  if (input.container !== undefined) patch.container = input.container;
  if (input.volumes !== undefined) patch.volumes = input.volumes;
  if (input.branch !== undefined) patch.branch = input.branch;
  if (input.dockerfile !== undefined) patch.dockerfile = input.dockerfile;
  if (input.buildContext !== undefined) patch.buildContext = input.buildContext;
  if (input.autoDeploy !== undefined) patch.autoDeploy = input.autoDeploy;
  if (input.rotateWebhookSecret === true) patch.webhookSecretEnc = encryptSecret(newSecret());
  if (input.rotateWebhookSecret === false) patch.webhookSecretEnc = null;
  if (input.env !== undefined) patch.envEnc = Object.keys(input.env).length ? encryptSecret(JSON.stringify(input.env)) : null;
  if (input.buildEnv !== undefined) patch.buildEnvEnc = Object.keys(input.buildEnv).length ? encryptSecret(JSON.stringify(input.buildEnv)) : null;
  if (Object.keys(patch).length) await db.update(schema.services).set(patch).where(eq(schema.services.id, id));
  if (input.domains !== undefined) await setDomains(id, input.domains);
  return (await getService(projectId, id))!;
}

async function setDomains(serviceId: string, hostnames: string[]) {
  const wanted = Array.from(new Set(hostnames.map((h) => h.trim().toLowerCase()).filter(Boolean)));
  const current = await db.select().from(schema.domains).where(eq(schema.domains.serviceId, serviceId));
  const stale = current.filter((d) => !wanted.includes(d.hostname)).map((d) => d.id);
  if (stale.length) await db.delete(schema.domains).where(inArray(schema.domains.id, stale));
  const fresh = wanted.filter((h) => !current.some((d) => d.hostname === h));
  if (fresh.length) await db.insert(schema.domains).values(fresh.map((hostname) => ({ serviceId, hostname })));
}

/** Лейблы Traefik для доменов сервиса — те же, что у стеков на сервере руками. */
function traefikLabels(project: string, service: string, domains: string[], port: number | null): Record<string, string> {
  if (domains.length === 0) return {};
  const router = `${project}-${service}`.replace(/[^a-z0-9-]/g, "-");
  const labels: Record<string, string> = {
    "traefik.enable": "true",
    "traefik.docker.network": "edge",
    [`traefik.http.routers.${router}.rule`]: domains.map((d) => `Host(\`${d}\`)`).join(" || "),
    [`traefik.http.routers.${router}.entrypoints`]: "websecure",
    [`traefik.http.routers.${router}.tls.certresolver`]: "le",
  };
  if (port) labels[`traefik.http.services.${router}.loadbalancer.server.port`] = String(port);
  return labels;
}

function deploySpec(projectSlug: string, service: ServiceView, image: string) {
  return {
    project: projectSlug,
    service: service.name,
    image,
    env: service.env,
    port: service.port,
    networks: service.domains.length ? ["edge"] : [],
    volumes: service.volumes,
    labels: traefikLabels(projectSlug, service.name, service.domains, service.port),
    command: service.command,
  };
}

type AgentJob = {
  id: string;
  kind: string;
  status: "queued" | "running" | "succeeded" | "failed";
  started_at: number;
  finished_at: number | null;
  result: { ok?: boolean; container?: { name: string } | null; image?: string; sha?: string; stage?: string } | null;
  error: string | null;
  lines: string[];
  line_count: number;
};

async function recordJob(
  projectId: string,
  service: ServiceView,
  job: AgentJob,
  opts: { image: string; actor: string; event: string; title: string; branch?: string | null; sha?: string | null },
): Promise<DeploymentRow> {
  const [row] = await db
    .insert(schema.deployments)
    .values({
      projectId,
      serviceId: service.id,
      source: "scalefield",
      externalId: job.id,
      repo: service.repo,
      workflow: job.kind,
      branch: opts.branch ?? null,
      sha: opts.sha ?? null,
      title: opts.title,
      event: opts.event,
      status: "in_progress",
      conclusion: null,
      actor: opts.actor,
      actorAvatar: "",
      url: null,
      startedAt: new Date(job.started_at * 1000),
      updatedAt: new Date(),
      durationS: null,
      log: job.lines.join("\n"),
      image: opts.image,
    })
    .returning();
  return row;
}

/** Деплой готового образа: задача агента + строка in_progress в deployments. */
export async function deployService(
  projectSlug: string,
  projectId: string,
  id: string,
  opts: { image?: string; actor?: string; event?: string },
): Promise<DeploymentRow> {
  const service = await getService(projectId, id);
  if (!service) throw new ServiceError("Unknown service", 404);
  const image = (opts.image ?? service.image ?? "").trim();
  if (!image) throw new ServiceError("Image is required");
  const agent = await getProjectAgent(projectSlug);
  if (!agent) throw new ServiceError("Project has no server/agent", 409);
  const job = await agentRequest<AgentJob>(agent, "/jobs/deploy", { method: "POST", body: deploySpec(projectSlug, service, image) });
  return recordJob(projectId, service, job, {
    image,
    actor: opts.actor ?? "owner",
    event: opts.event ?? "manual",
    title: `${service.name} ← ${image}`,
  });
}

/** Сборка из Git и деплой: образ `<project>/<service>:<ref>-<время>` остаётся на хосте. */
export async function buildService(
  projectSlug: string,
  projectId: string,
  id: string,
  opts: { ref?: string; sha?: string; actor?: string; event?: string; title?: string },
): Promise<DeploymentRow> {
  const service = await getService(projectId, id);
  if (!service) throw new ServiceError("Unknown service", 404);
  if (!service.repo) throw new ServiceError("Service has no repository");
  const agent = await getProjectAgent(projectSlug);
  if (!agent) throw new ServiceError("Project has no server/agent", 409);
  const ref = (opts.ref || service.branch || "main").trim();
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15).toLowerCase();
  const image = `${projectSlug}/${service.name}:${ref.replace(/[^a-z0-9._-]/gi, "-").toLowerCase()}-${stamp}`;
  const token = process.env.GITHUB_TOKEN;
  let repoUrl = service.repo.includes("://") ? service.repo : `https://github.com/${service.repo}.git`;
  // Приватные репозитории GitHub: токен в URL, агент его в лог не пишет.
  if (token && /^https:\/\/github\.com\//.test(repoUrl)) repoUrl = repoUrl.replace("https://github.com/", `https://x-access-token:${token}@github.com/`);
  const job = await agentRequest<AgentJob>(agent, "/jobs/build", {
    method: "POST",
    body: {
      repo_url: repoUrl,
      ref,
      dockerfile: service.dockerfile || "Dockerfile",
      context: service.buildContext || ".",
      build_env: service.buildEnv,
      deploy: deploySpec(projectSlug, service, image),
    },
  });
  return recordJob(projectId, service, job, {
    image,
    actor: opts.actor ?? "owner",
    event: opts.event ?? "manual",
    title: opts.title ?? `${service.name} ← build ${service.repo}@${ref}`,
    branch: ref,
    sha: opts.sha ?? null,
  });
}

/** Подтянуть состояние задачи агента в строку деплоя; завершённые не трогаем. */
export async function syncDeployment(projectSlug: string, row: DeploymentRow): Promise<DeploymentRow> {
  if (row.source !== "scalefield" || row.status === "completed") return row;
  const agent = await getProjectAgent(projectSlug);
  if (!agent) return row;
  let job: AgentJob;
  try {
    job = await agentRequest<AgentJob>(agent, `/jobs/${row.externalId}`);
  } catch (e) {
    // Агент перезапустился и задачу забыл — закрываем как сбой, чтобы не
    // висела «в процессе» вечно.
    const [updated] = await db
      .update(schema.deployments)
      .set({ status: "completed", conclusion: "failure", updatedAt: new Date(), log: `${row.log ?? ""}\nERROR: ${e instanceof Error ? e.message : String(e)}`.trim() })
      .where(eq(schema.deployments.id, row.id))
      .returning();
    return updated;
  }
  const done = job.status === "succeeded" || job.status === "failed";
  const patch: Partial<typeof schema.deployments.$inferInsert> = {
    log: job.lines.join("\n"),
    updatedAt: new Date(),
    sha: job.result?.sha ? job.result.sha : row.sha,
  };
  if (done) {
    patch.status = "completed";
    patch.conclusion = job.status === "succeeded" ? "success" : "failure";
    patch.durationS = job.finished_at ? Math.max(0, Math.round(job.finished_at - job.started_at)) : null;
  }
  const [updated] = await db.update(schema.deployments).set(patch).where(eq(schema.deployments.id, row.id)).returning();
  if (done && job.status === "succeeded" && row.serviceId) {
    await db
      .update(schema.services)
      .set({ image: job.result?.image ?? row.image ?? undefined, container: job.result?.container?.name ?? `${projectSlug}-${(row.title ?? "").split(" ")[0]}` })
      .where(eq(schema.services.id, row.serviceId));
  }
  return updated;
}

export async function getDeployment(projectSlug: string, projectId: string, externalId: string): Promise<DeploymentRow | null> {
  const rows = await db
    .select()
    .from(schema.deployments)
    .where(and(eq(schema.deployments.projectId, projectId), eq(schema.deployments.externalId, externalId)))
    .limit(1);
  if (!rows[0]) return null;
  return syncDeployment(projectSlug, rows[0]);
}

/** Образы, которые успешно деплоились у сервиса — для отката (свежие первыми, без повторов). */
export async function serviceImages(serviceId: string, limit = 10): Promise<{ image: string; at: string }[]> {
  const rows = await db
    .select({ image: schema.deployments.image, at: schema.deployments.startedAt })
    .from(schema.deployments)
    .where(and(eq(schema.deployments.serviceId, serviceId), eq(schema.deployments.conclusion, "success")))
    .orderBy(desc(schema.deployments.startedAt))
    .limit(100);
  const seen = new Set<string>();
  const out: { image: string; at: string }[] = [];
  for (const r of rows) {
    if (!r.image || seen.has(r.image)) continue;
    seen.add(r.image);
    out.push({ image: r.image, at: r.at.toISOString() });
    if (out.length >= limit) break;
  }
  return out;
}

export async function removeService(projectSlug: string, projectId: string, id: string): Promise<{ output: string }> {
  const service = await getService(projectId, id);
  if (!service) throw new ServiceError("Unknown service", 404);
  let output = "";
  if (service.container) {
    const agent = await getProjectAgent(projectSlug);
    if (agent) {
      const res = await agentRequest<{ ok: boolean; output: string }>(agent, "/deploy/remove", {
        method: "POST",
        body: { project: projectSlug, service: service.name },
        timeoutMs: 120_000,
      });
      output = res.output;
      if (!res.ok) throw new ServiceError(`Agent failed to remove container: ${res.output}`, 502);
    }
  }
  await db.delete(schema.services).where(eq(schema.services.id, id));
  return { output };
}

/** Строка deployments → формат панели (общий с прогонами GitHub Actions). */
export function deploymentToItem(r: DeploymentRow, serviceName: string | null) {
  return {
    id: r.externalId,
    source: r.source,
    service: serviceName,
    log: r.log,
    image: r.image,
    repo: r.repo || "",
    workflow: r.workflow || "",
    branch: r.branch || "",
    sha: (r.sha || "").slice(0, 7),
    title: r.title || "",
    status: r.status,
    conclusion: r.conclusion,
    event: r.event || "",
    created_at: r.startedAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    duration_s: r.durationS,
    url: r.url || "",
    actor: r.actor || "",
    actor_avatar: r.actorAvatar || "",
  };
}
