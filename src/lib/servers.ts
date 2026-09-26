import "server-only";
import { asc, eq } from "drizzle-orm";
import { Client, utils as sshUtils } from "ssh2";
import { db, schema } from "@/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { generateAgentToken, hashAgentToken } from "@/lib/agent-token";
import { relayOnline } from "@/lib/relay";
import { installScript } from "@/lib/agent-install";
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

export type ServerDetail = ServerView & { installLog: string | null };

const HOST_RE = /^[a-z0-9]([a-z0-9.-]{0,252}[a-z0-9])?$/i;
const PATH_RE = /^\/[A-Za-z0-9_./-]+$/;
const AGENT_ONLINE_WAIT_MS = 90_000;

function view(s: Server, online: Set<string>): ServerView {
  return {
    id: s.id,
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

export async function listServers(): Promise<ServerView[]> {
  const [rows, online] = await Promise.all([
    db.select().from(schema.servers).orderBy(asc(schema.servers.createdAt)),
    relayOnline(),
  ]);
  return rows.map((s) => view(s, new Set(online.keys())));
}

export async function getServer(id: string): Promise<ServerDetail | null> {
  const s = await db.query.servers.findFirst({ where: eq(schema.servers.id, id) });
  if (!s) return null;
  const online = await relayOnline();
  return { ...view(s, new Set(online.keys())), installLog: s.installLog };
}

// ---------- SSH-ключ организации ----------

async function firstOrg() {
  const org = await db.query.organizations.findFirst({ orderBy: [asc(schema.organizations.createdAt)] });
  if (!org) throw new ServerError("Control-plane has no organization yet", 409);
  return org;
}

/** Публичный ключ организации — показать в форме «ключ уже на сервере». Генерируется при первом обращении. */
export async function orgSshPublicKey(): Promise<string> {
  return (await orgSshKey()).publicKey;
}

async function orgSshKey(): Promise<{ orgId: string; publicKey: string; privateKey: string }> {
  const org = await firstOrg();
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
  host: string;
  sshPort?: number;
  sshUser?: string;
  password?: string; // пусто → ключ организации уже добавлен на сервер
  installTraefik?: boolean;
  acmeEmail?: string;
  databaseUrl?: string;
  provider?: string;
};

type InstallOptions = { password: string | null; installTraefik: boolean; acmeEmail: string; databaseUrl: string | null };

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

export async function createServer(input: CreateServerInput): Promise<ServerView> {
  const host = (input.host || "").trim();
  if (!HOST_RE.test(host)) throw new ServerError("Host must be an IP address or hostname");
  const sshPort = input.sshPort ?? 22;
  if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) throw new ServerError("SSH port is invalid");
  const sshUser = (input.sshUser || "root").trim();
  if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(sshUser)) throw new ServerError("SSH user is invalid");
  const acmeEmail = (input.acmeEmail || process.env.ACME_EMAIL || "").trim();
  const installTraefik = input.installTraefik ?? true;
  if (installTraefik && !/^[^\s@]+@[^\s@]+$/.test(acmeEmail)) {
    throw new ServerError("Let's Encrypt needs an email address to install Traefik");
  }
  const databaseUrl = (input.databaseUrl || "").trim() || null;
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) throw new ServerError("Database URL must be postgresql://…");
  installEnv(); // проверить окружение до записи в базу

  const { orgId } = await orgSshKey();
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

/** Переустановка агента ключом организации (пароль больше не нужен). */
export async function reinstallServer(id: string, opts?: { installTraefik?: boolean; acmeEmail?: string }): Promise<ServerDetail> {
  const s = await db.query.servers.findFirst({ where: eq(schema.servers.id, id) });
  if (!s) throw new ServerError("Unknown server", 404);
  if (s.status === "installing") throw new ServerError("Install is already running", 409);
  await db.update(schema.servers).set({ status: "installing", installLog: "", installError: null }).where(eq(schema.servers.id, id));
  startInstall(id, {
    password: null,
    installTraefik: opts?.installTraefik ?? false,
    acmeEmail: (opts?.acmeEmail || process.env.ACME_EMAIL || "").trim(),
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
  const key = await orgSshKey();
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
