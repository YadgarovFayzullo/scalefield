import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { agentRequest } from "@/lib/agent";
import { getProjectAgent } from "@/lib/projects";
import type { Domain, Service } from "@/db/schema";

/**
 * Сервисы проекта и деплой через агента.
 *
 * Сервис = контейнер: образ, порт, env, тома, домены. Деплой собирает из
 * этого описание для агента (`POST /deploy`), тот пишет compose-стек
 * `/opt/apps/<project>/docker-compose.yml` и делает `up -d --pull always`.
 * Домены превращаются в лейблы Traefik (как у существующих стеков на сервере),
 * поэтому сервис с доменом попадает в сеть `edge`.
 */

export type ServiceView = Omit<Service, "envEnc"> & { env: Record<string, string>; domains: string[] };

export class ServiceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;
const HOST_RE = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i;

function parseEnv(envEnc: string | null): Record<string, string> {
  if (!envEnc) return {};
  try {
    return JSON.parse(decryptSecret(envEnc)) as Record<string, string>;
  } catch {
    return {};
  }
}

function view(s: Service, domains: Domain[]): ServiceView {
  const { envEnc, ...rest } = s;
  return { ...rest, env: parseEnv(envEnc), domains: domains.filter((d) => d.serviceId === s.id).map((d) => d.hostname) };
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

export type ServiceInput = {
  name?: string;
  kind?: string;
  image?: string | null;
  port?: number | null;
  command?: string | null;
  repo?: string | null;
  container?: string | null;
  env?: Record<string, string>;
  volumes?: string[];
  domains?: string[];
};

function validate(input: ServiceInput) {
  if (input.name !== undefined && !NAME_RE.test(input.name)) throw new ServiceError("Service name: lowercase letters, digits, - and _");
  if (input.port !== undefined && input.port !== null && (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)) {
    throw new ServiceError("Port must be 1..65535");
  }
  for (const d of input.domains ?? []) if (!HOST_RE.test(d)) throw new ServiceError(`Invalid domain: ${d}`);
  for (const v of input.volumes ?? []) if (!/^[^\s:]+:[^\s:]+(:(ro|rw))?$/.test(v)) throw new ServiceError(`Invalid volume: ${v}`);
  for (const k of Object.keys(input.env ?? {})) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) throw new ServiceError(`Invalid env name: ${k}`);
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
      port: input.port ?? null,
      command: input.command ?? null,
      repo: input.repo ?? null,
      envEnc: input.env && Object.keys(input.env).length ? encryptSecret(JSON.stringify(input.env)) : null,
      volumes: input.volumes ?? [],
    })
    .returning();
  await setDomains(row.id, input.domains ?? []);
  return (await getService(projectId, row.id))!;
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
  if (input.env !== undefined) patch.envEnc = Object.keys(input.env).length ? encryptSecret(JSON.stringify(input.env)) : null;
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

type AgentDeployResult = {
  ok: boolean;
  output: string;
  compose_path: string;
  container: { name: string; status: string; health: string | null; image: string; started_at?: string } | null;
};

export async function deployService(
  projectSlug: string,
  projectId: string,
  id: string,
  opts: { image?: string; actor?: string },
): Promise<{ deployment: typeof schema.deployments.$inferSelect; service: ServiceView; result: AgentDeployResult }> {
  const service = await getService(projectId, id);
  if (!service) throw new ServiceError("Unknown service", 404);
  const image = (opts.image ?? service.image ?? "").trim();
  if (!image) throw new ServiceError("Image is required");
  const agent = await getProjectAgent(projectSlug);
  if (!agent) throw new ServiceError("Project has no server/agent", 409);

  const startedAt = new Date();
  const spec = {
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

  let result: AgentDeployResult;
  try {
    result = await agentRequest<AgentDeployResult>(agent, "/deploy", { method: "POST", body: spec, timeoutMs: 620_000 });
  } catch (e) {
    result = { ok: false, output: e instanceof Error ? e.message : String(e), compose_path: "", container: null };
  }
  const finishedAt = new Date();

  const [deployment] = await db
    .insert(schema.deployments)
    .values({
      projectId,
      serviceId: id,
      source: "scalefield",
      externalId: crypto.randomUUID(),
      repo: service.repo,
      workflow: "deploy",
      branch: null,
      sha: null,
      title: `${service.name} ← ${image}`,
      event: "manual",
      status: "completed",
      conclusion: result.ok ? "success" : "failure",
      actor: opts.actor ?? "owner",
      actorAvatar: "",
      url: null,
      startedAt,
      updatedAt: finishedAt,
      durationS: Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
      log: result.output,
    })
    .returning();

  if (result.ok) {
    await db
      .update(schema.services)
      .set({ image, container: result.container?.name ?? `${projectSlug}-${service.name}` })
      .where(eq(schema.services.id, id));
  }
  return { deployment, service: (await getService(projectId, id))!, result };
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
