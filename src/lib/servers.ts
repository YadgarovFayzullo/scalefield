import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { Client, utils as sshUtils } from "ssh2";
import { db, schema } from "@/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { generateAgentToken, hashAgentToken } from "@/lib/agent-token";
import { relayOnline } from "@/lib/relay";
import { installScript, traefikComposeYaml } from "@/lib/agent-install";
import { agentRef, agentRequest } from "@/lib/agent";
import { installCommand } from "@/lib/install-link";
import type { Server } from "@/db/schema";

/**
 * Серверы организации и установка агента на них по SSH («Добавить сервер»).
 *
 * Поток: панель создаёт запись со статусом `installing` и свежим токеном
 * агента → в фоне заходит на сервер по SSH (пароль root один раз, не
 * хранится; или уже лежащий там ключ организации), гонит скрипт установки
 * (src/lib/agent-install.ts) и пишет его вывод в `servers.install_log`
 * живьём → ждёт, пока агент подключится к relay → `ready`. Пароль после
 * установки не нужен: скрипт добавил в authorized_keys ключ организации, им
 * идёт переустановка.
 */
export class ServerError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type ServerView = {
  id: string;
  orgId: string;
  name: string;
  host: string;
  provider: string | null;
  status: string;
  sshPort: number;
  sshUser: string;
  agentVersion: string | null;
  agentHostname: string | null;
  lastSeenAt: string | null;
  installError: string | null;
  createdAt: string;
  online: boolean;
  transport: "relay" | "direct";
};

/** `installCommand` — только пока сервер ждёт первого подключения агента. */
export type ServerDetail = ServerView & { installLog: string | null; installCommand: string | null };

/** Имя сервера, пока агент не прислал свой hostname. */
export const PENDING_NAME = "New server";

const HOST_RE = /^[a-z0-9]([a-z0-9.-]{0,252}[a-z0-9])?$/i;
const PATH_RE = /^\/[A-Za-z0-9_./-]+$/;
const AGENT_ONLINE_WAIT_MS = 90_000;

function view(s: Server, online: Set<string>): ServerView {
  return {
    id: s.id,
    orgId: s.orgId,
    name: s.name,
    host: s.host,
    provider: s.provider,
    status: s.status,
    sshPort: s.sshPort,
    sshUser: s.sshUser,
    agentVersion: s.agentVersion,
    agentHostname: s.agentHostname,
    lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null,
    installError: s.installError,
    createdAt: s.createdAt.toISOString(),
    online: s.agentUrl ? true : online.has(s.id),
    transport: s.agentUrl ? "direct" : "relay",
  };
}

/** Серверы организаций пользователя. */
export async function listServers(orgIds: string[]): Promise<ServerView[]> {
  if (orgIds.length === 0) return [];
  const [rows, online] = await Promise.all([
    db.select().from(schema.servers).where(inArray(schema.servers.orgId, orgIds)).orderBy(asc(schema.servers.createdAt)),
    relayOnline(),
  ]);
  return rows.map((s) => view(s, new Set(online.keys())));
}

export async function getServer(id: string, origin = ""): Promise<ServerDetail | null> {
  const s = await db.query.servers.findFirst({ where: eq(schema.servers.id, id) });
  if (!s) return null;
  const online = await relayOnline();
  return {
    ...view(s, new Set(online.keys())),
    installLog: s.installLog,
    installCommand: s.status === "waiting" ? installCommand(s.id, origin) : null,
  };
}

// ---------- SSH-ключ организации ----------

/** Публичный ключ организации — показать в форме «ключ уже на сервере». Генерируется при первом обращении. */
export async function orgSshPublicKey(orgId: string): Promise<string> {
  return (await orgSshKey(orgId)).publicKey;
}

// Ключ — свой у каждой организации: сервер клиента доверяет только ключу
// своей команды, а не всей платформы.
async function orgSshKey(orgId: string): Promise<{ orgId: string; publicKey: string; privateKey: string }> {
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) throw new ServerError("Unknown organization", 404);
  if (org.sshPublicKey && org.sshPrivateKeyEnc) {
    return { orgId: org.id, publicKey: org.sshPublicKey, privateKey: decryptSecret(org.sshPrivateKeyEnc) };
  }
  const pair = sshUtils.generateKeyPairSync("ed25519", { comment: `scalefield-${org.slug}` });
  await db
    .update(schema.organizations)
    .set({ sshPublicKey: pair.public, sshPrivateKeyEnc: encryptSecret(pair.private) })
    .where(eq(schema.organizations.id, org.id));
  return { orgId: org.id, publicKey: pair.public, privateKey: pair.private };
}

// ---------- создание и установка ----------

export type CreateServerInput = {
  name?: string;
  /** IP или hostname; можно сразу `user@host:port`, как в ssh. */
  host: string;
  sshPort?: number;
  sshUser?: string;
  password?: string; // пусто → ключ организации уже добавлен на сервер
  /** Не задано — auto: ставим, только если 80/443 на сервере свободны. */
  installTraefik?: boolean;
  acmeEmail?: string;
  /** Не задано — установка сама найдёт Postgres-контейнер на сервере. */
  databaseUrl?: string;
  provider?: string;
};

type InstallOptions = {
  password: string | null;
  installTraefik: boolean | "auto";
  acmeEmail: string;
  databaseUrl: string | null;
};

/** `root@1.2.3.4:2222` → части; явные sshUser/sshPort из формы важнее. */
export function parseTarget(raw: string): { host: string; user?: string; port?: number } {
  let rest = raw.trim().replace(/^ssh:\/\//, "");
  let user: string | undefined;
  const at = rest.lastIndexOf("@");
  if (at > 0) {
    user = rest.slice(0, at);
    rest = rest.slice(at + 1);
  }
  let port: number | undefined;
  const m = rest.match(/^(.*):(\d{1,5})$/);
  if (m) {
    rest = m[1];
    port = Number(m[2]);
  }
  return { host: rest.replace(/\/+$/, ""), user, port };
}

function installEnv() {
  const relayUrl = process.env.RELAY_PUBLIC_URL;
  if (!relayUrl || !/^wss?:\/\//.test(relayUrl)) {
    throw new ServerError("RELAY_PUBLIC_URL is not set — the agent would have nowhere to connect", 500);
  }
  const installRoot = process.env.AGENT_INSTALL_ROOT || "/opt/scalefield";
  const appsRoot = process.env.AGENT_APPS_ROOT || "/opt/apps";
  for (const p of [installRoot, appsRoot]) if (!PATH_RE.test(p)) throw new ServerError(`Bad install path: ${p}`, 500);
  return {
    relayUrl,
    agentImage: process.env.AGENT_IMAGE || "ghcr.io/yadgarovfayzullo/scalefield-agent:latest",
    installRoot,
    appsRoot,
  };
}

/**
 * `fallbackEmail` — email того, кто добавляет сервер: им регистрируемся в
 * Let's Encrypt, если ACME_EMAIL не задан, чтобы не спрашивать в форме.
 */
export async function createServer(input: CreateServerInput, orgId: string, fallbackEmail = ""): Promise<ServerView> {
  const target = parseTarget(input.host || "");
  const host = target.host;
  if (!HOST_RE.test(host)) throw new ServerError("Host must be an IP address or hostname");
  const sshPort = input.sshPort ?? target.port ?? 22;
  if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) throw new ServerError("SSH port is invalid");
  const sshUser = (input.sshUser || target.user || "root").trim();
  if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(sshUser)) throw new ServerError("SSH user is invalid");
  const acmeEmail = (input.acmeEmail || process.env.ACME_EMAIL || fallbackEmail || "").trim();
  if (acmeEmail && !/^[^\s@]+@[^\s@]+$/.test(acmeEmail)) throw new ServerError("Let's Encrypt email is invalid");
  const installTraefik: boolean | "auto" = input.installTraefik ?? "auto";
  const databaseUrl = (input.databaseUrl || "").trim() || null;
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) throw new ServerError("Database URL must be postgresql://…");
  installEnv(); // проверить окружение до записи в базу

  await orgSshKey(orgId); // ключ организации — до записи сервера
  const token = generateAgentToken();
  const [server] = await db
    .insert(schema.servers)
    .values({
      orgId,
      name: (input.name || "").trim() || host,
      host,
      provider: input.provider?.trim() || null,
      sshPort,
      sshUser,
      agentTokenEnc: encryptSecret(token),
      agentTokenHash: hashAgentToken(token),
      status: "installing",
      installLog: "",
    })
    .returning();

  startInstall(server.id, { password: input.password || null, installTraefik, acmeEmail, databaseUrl });
  return view(server, new Set());
}

// ---------- «Add server» одной командой ----------

/**
 * Сервер без адреса и пароля: запись `waiting` с токеном агента. Человек
 * запускает на сервере команду из панели (src/lib/install-link.ts), агент
 * подключается к relay — и только тогда мы узнаём IP и hostname
 * (markAgentConnected). Как claim-токен у Netdata или Edge-агент Portainer.
 */
export async function createPendingServer(orgId: string): Promise<ServerView> {
  installEnv();
  await orgSshKey(orgId);
  const token = generateAgentToken();
  const [server] = await db
    .insert(schema.servers)
    .values({
      orgId,
      name: PENDING_NAME,
      host: "",
      agentTokenEnc: encryptSecret(token),
      agentTokenHash: hashAgentToken(token),
      status: "waiting",
    })
    .returning();
  return view(server, new Set());
}

/** Скрипт для `curl … | sudo bash`: всё определяется на месте (Traefik auto, Postgres сам). */
export async function pendingInstallScript(serverId: string): Promise<string | null> {
  const server = await db.query.servers.findFirst({ where: eq(schema.servers.id, serverId) });
  if (!server) return null;
  const key = await orgSshKey(server.orgId);
  return installScript({
    ...installEnv(),
    agentToken: decryptSecret(server.agentTokenEnc),
    sshPublicKey: key.publicKey,
    installTraefik: "auto",
    acmeEmail: (process.env.ACME_EMAIL || "").trim(),
    databaseUrl: null,
  });
}

/**
 * Агент подключился к relay. Для сервера, добавленного командой, это первое,
 * что мы о нём узнаём: адрес берём из подключения, имя — hostname машины.
 */
export async function markAgentConnected(serverId: string, info: { ip?: string; hostname?: string }): Promise<void> {
  const s = await db.query.servers.findFirst({ where: eq(schema.servers.id, serverId) });
  if (!s) return;
  const patch: Partial<typeof schema.servers.$inferInsert> = {};
  if (!s.host && info.ip && HOST_RE.test(info.ip)) patch.host = info.ip;
  if (s.name === PENDING_NAME && info.hostname) patch.name = info.hostname.slice(0, 63);
  // Агент на связи — значит, сервер рабочий, даже если прошлая установка
  // (например, переустановка по SSH без ключа) упала.
  if (s.status === "waiting" || s.status === "error") {
    patch.status = "ready";
    patch.installError = null;
  }
  if (Object.keys(patch).length > 0) await db.update(schema.servers).set(patch).where(eq(schema.servers.id, serverId));
}

/** Переустановка агента ключом организации (пароль больше не нужен). */
export async function reinstallServer(
  id: string,
  opts?: { installTraefik?: boolean; acmeEmail?: string; host?: string; password?: string },
  fallbackEmail = "",
): Promise<ServerDetail> {
  const s = await db.query.servers.findFirst({ where: eq(schema.servers.id, id) });
  if (!s) throw new ServerError("Unknown server", 404);
  if (s.status === "installing") throw new ServerError("Install is already running", 409);
  // Запасной путь со страницы ожидания: нет терминала — даём адрес и пароль,
  // и панель ставит агента сама по SSH.
  const patch: Partial<typeof schema.servers.$inferInsert> = { status: "installing", installLog: "", installError: null };
  if (opts?.host) {
    const t = parseTarget(opts.host);
    if (!HOST_RE.test(t.host)) throw new ServerError("Host must be an IP address or hostname");
    patch.host = t.host;
    if (t.user) patch.sshUser = t.user;
    if (t.port) patch.sshPort = t.port;
  } else if (!s.host) {
    throw new ServerError("Server address is required");
  }
  await db.update(schema.servers).set(patch).where(eq(schema.servers.id, id));
  startInstall(id, {
    password: opts?.password || null,
    installTraefik: opts?.installTraefik ?? "auto",
    acmeEmail: (opts?.acmeEmail || process.env.ACME_EMAIL || fallbackEmail || "").trim(),
    databaseUrl: null,
  });
  return (await getServer(id))!;
}

function startInstall(serverId: string, opts: InstallOptions): void {
  // Фоновая задача в процессе control-plane: страница сервера поллит
  // install_log. Падение фиксируется в статусе, а не теряется.
  void runInstall(serverId, opts).catch(async (e) => {
    await db
      .update(schema.servers)
      .set({ status: "error", installError: e instanceof Error ? e.message : String(e) })
      .where(eq(schema.servers.id, serverId));
  });
}

async function runInstall(serverId: string, opts: InstallOptions): Promise<void> {
  const server = await db.query.servers.findFirst({ where: eq(schema.servers.id, serverId) });
  if (!server) return;
  const key = await orgSshKey(server.orgId);
  const env = installEnv();

  let log = "";
  let flushing: Promise<unknown> | null = null;
  const append = (chunk: string) => {
    log += chunk;
    // Пишем в базу не чаще одного раза за проход event loop — вывод docker
    // приходит мелкими кусками.
    if (!flushing) {
      flushing = db
        .update(schema.servers)
        .set({ installLog: log })
        .where(eq(schema.servers.id, serverId))
        .finally(() => {
          flushing = null;
        });
    }
  };

  append(`Connecting to ${server.sshUser}@${server.host}:${server.sshPort} (${opts.password ? "password" : "organization key"})…\n`);
  const script = installScript({
    ...env,
    agentToken: decryptSecret(server.agentTokenEnc),
    sshPublicKey: key.publicKey,
    installTraefik: opts.installTraefik,
    acmeEmail: opts.acmeEmail,
    databaseUrl: opts.databaseUrl,
  });
  await sshRun(
    { host: server.host, port: server.sshPort, username: server.sshUser, password: opts.password, privateKey: key.privateKey },
    script,
    append,
  );

  const deadline = Date.now() + AGENT_ONLINE_WAIT_MS;
  while (Date.now() < deadline) {
    if ((await relayOnline()).has(serverId)) {
      append("==> Agent is online. Server is ready.\n");
      await flushing;
      await db.update(schema.servers).set({ status: "ready", installLog: log, installError: null }).where(eq(schema.servers.id, serverId));
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  append(`ERROR: the agent did not connect to the relay within ${AGENT_ONLINE_WAIT_MS / 1000}s. Check that ${env.relayUrl} is reachable from the server and that the relay is up.\n`);
  await flushing;
  await db
    .update(schema.servers)
    .set({ status: "error", installLog: log, installError: "Agent installed but never connected to the relay" })
    .where(eq(schema.servers.id, serverId));
}

function sshRun(
  conn: { host: string; port: number; username: string; password: string | null; privateKey: string },
  script: string,
  onData: (chunk: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    client
      .on("ready", () => {
        client.exec("bash -s", (err, stream) => {
          if (err) {
            client.end();
            reject(err);
            return;
          }
          stream.on("data", (d: Buffer) => onData(d.toString("utf8")));
          stream.stderr.on("data", (d: Buffer) => onData(d.toString("utf8")));
          stream.on("close", (code: number | null) => {
            client.end();
            if (code === 0) resolve();
            else reject(new Error(`Install script exited with code ${code ?? "?"}`));
          });
          stream.end(script);
        });
      })
      .on("error", (e) => reject(new Error(`SSH: ${e.message}`)))
      .connect({
        host: conn.host,
        port: conn.port,
        username: conn.username,
        ...(conn.password ? { password: conn.password } : { privateKey: conn.privateKey }),
        readyTimeout: 20_000,
      });
  });
}

// ---------- кто держит 80/443 (agent/app/proxy.py) ----------

export type ProxyHolder = { type: "container" | "host"; name: string; image?: string; networks?: string[] };
export type ProxyState = {
  ok: boolean;
  kind: "traefik" | "other" | "none";
  holder: ProxyHolder | null;
  /** Что сделает кнопка: подключить свой Traefik к edge, заменить чужой прокси, поставить Traefik; null — только руками. */
  action: "attach" | "replace" | "install" | null;
};
export type AgentJob = { id: string; status: "queued" | "running" | "succeeded" | "failed"; lines: string[]; line_count: number; error: string | null };

async function serverAgent(id: string) {
  const s = await db.query.servers.findFirst({ where: eq(schema.servers.id, id) });
  if (!s) throw new ServerError("Unknown server", 404);
  return agentRef(s);
}

export async function serverProxyState(id: string): Promise<ProxyState> {
  return agentRequest<ProxyState>(await serverAgent(id), "/proxy");
}

/** Починить 80/443 одной кнопкой; compose Traefik — тот же, что ставит установка. */
export async function fixServerProxy(id: string, fallbackEmail = ""): Promise<AgentJob> {
  const email = (process.env.ACME_EMAIL || fallbackEmail || "").trim();
  return agentRequest<AgentJob>(await serverAgent(id), "/jobs/proxy", {
    method: "POST",
    body: { traefik_compose: traefikComposeYaml(email) },
  });
}

export async function serverJob(id: string, jobId: string, since = 0): Promise<AgentJob> {
  if (!/^[0-9a-f]{32}$/.test(jobId)) throw new ServerError("Bad job id");
  return agentRequest<AgentJob>(await serverAgent(id), `/jobs/${jobId}?since=${since}`);
}

// ---------- удаление ----------

/**
 * Убрать сервер из панели. Пока на нём есть проекты или базы — отказ со
 * списком: сначала перенести или удалить их. Агент на машине не трогаем
 * (он может обслуживать живой прод) — он просто перестаёт проходить
 * проверку токена в relay; как снять его руками, панель подсказывает.
 */
export async function deleteServer(id: string): Promise<void> {
  const s = await db.query.servers.findFirst({ where: eq(schema.servers.id, id) });
  if (!s) throw new ServerError("Unknown server", 404);
  const [projects, databases] = await Promise.all([
    db.select({ name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.serverId, id)),
    db.select({ name: schema.databases.name }).from(schema.databases).where(eq(schema.databases.serverId, id)),
  ]);
  if (projects.length > 0) {
    throw new ServerError(`Projects still run on this server: ${projects.map((p) => p.name).join(", ")}. Delete or move them first.`, 409);
  }
  if (databases.length > 0) {
    throw new ServerError(`Databases still live on this server: ${databases.map((d) => d.name).join(", ")}. Remove them first.`, 409);
  }
  await db.delete(schema.servers).where(eq(schema.servers.id, id));
}
