/**
 * Relay Scalefield — точка, к которой подключаются агенты серверов.
 *
 * Агент стоит на сервере клиента (за NAT, за файрволом хостера, без публичного
 * порта), поэтому не control-plane ходит к агенту, а агент держит исходящий
 * WebSocket сюда. Control-plane шлёт запрос агенту через
 * `POST /servers/<id>/request`, relay пересылает его по сокету и ждёт ответ.
 * Так же работают Portainer Edge и self-hosted раннеры GitHub.
 *
 * Relay ничего не знает о проектах и не ходит в базу: подлинность токена
 * агента проверяет control-plane (`/api/internal/relay/auth`), туда же
 * уходят события подключения и heartbeat (`/api/internal/relay/servers/<id>`).
 * Обе стороны доверяют друг другу по общему секрету RELAY_SECRET.
 *
 * Протокол по сокету — JSON-сообщения:
 *   агент → relay:  {type:"hello", version, hostname}
 *                   {type:"response", id, status, body}   (body — текст)
 *   relay → агент:  {type:"welcome", serverId}
 *                   {type:"request", id, method, path, body}
 */
import http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket, type RawData } from "ws";

// В dev секрет и адрес control-plane берём из ../.env.local (запуск
// `npm run relay` из корня → cwd = relay/). В Docker их даёт compose.
if (!process.env.RELAY_SECRET) {
  try {
    process.loadEnvFile("../.env.local");
  } catch {
    /* файла нет — значит, окружение задано снаружи */
  }
}

const PORT = Number(process.env.PORT || 3003);
const CONTROL_URL = (process.env.CONTROL_URL || "http://localhost:3002").replace(/\/+$/, "");
const SECRET = process.env.RELAY_SECRET || "";
if (!SECRET) {
  console.error("[relay] RELAY_SECRET не задан");
  process.exit(1);
}

const PING_INTERVAL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 60_000;
const MAX_PAYLOAD = 64 * 1024 * 1024;
const MAX_REQUEST_BODY = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

type Pending = {
  resolve: (r: { status: number; body: string }) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
};

type Agent = {
  serverId: string;
  name: string;
  ws: WebSocket;
  version: string | null;
  hostname: string | null;
  connectedAt: number;
  alive: boolean;
  pending: Map<string, Pending>;
};

const agents = new Map<string, Agent>();

// ---------- control-plane ----------

async function control(path: string, body: unknown): Promise<Response> {
  return fetch(`${CONTROL_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-relay-secret": SECRET },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

async function authenticate(token: string): Promise<{ serverId: string; name: string } | null> {
  const res = await control("/api/internal/relay/auth", { token });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`control-plane ответил ${res.status}`);
  return (await res.json()) as { serverId: string; name: string };
}

async function report(agent: Agent, event: "connected" | "disconnected" | "heartbeat"): Promise<void> {
  try {
    await control(`/api/internal/relay/servers/${agent.serverId}`, {
      event,
      version: agent.version,
      hostname: agent.hostname,
    });
  } catch (e) {
    console.warn(`[relay] не удалось сообщить control-plane о ${event} ${agent.name}: ${e instanceof Error ? e.message : e}`);
  }
}

// ---------- сокеты агентов ----------

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });

function attach(ws: WebSocket, who: { serverId: string; name: string }): void {
  const previous = agents.get(who.serverId);
  if (previous) {
    // Агент переподключился раньше, чем мы заметили обрыв старого сокета —
    // старый гасим, его ожидающие запросы отбиваем.
    previous.ws.terminate();
    failPending(previous, "agent reconnected");
  }
  const agent: Agent = {
    serverId: who.serverId,
    name: who.name,
    ws,
    version: null,
    hostname: null,
    connectedAt: Date.now(),
    alive: true,
    pending: new Map(),
  };
  agents.set(who.serverId, agent);
  ws.send(JSON.stringify({ type: "welcome", serverId: who.serverId }));

  ws.on("pong", () => {
    agent.alive = true;
  });
  ws.on("message", (data: RawData) => onMessage(agent, data));
  ws.on("close", () => {
    failPending(agent, "agent disconnected");
    if (agents.get(agent.serverId) === agent) {
      agents.delete(agent.serverId);
      console.log(`[relay] отключился ${agent.name} (${agent.serverId})`);
      void report(agent, "disconnected");
    }
  });
  ws.on("error", (e) => console.warn(`[relay] сокет ${agent.name}: ${e.message}`));
}

function onMessage(agent: Agent, data: RawData): void {
  let msg: { type?: string; id?: string; status?: number; body?: string; version?: string; hostname?: string };
  try {
    msg = JSON.parse(data.toString("utf8"));
  } catch {
    return;
  }
  if (msg.type === "hello") {
    agent.version = typeof msg.version === "string" ? msg.version : null;
    agent.hostname = typeof msg.hostname === "string" ? msg.hostname : null;
    console.log(`[relay] подключился ${agent.name} (${agent.serverId}) v${agent.version ?? "?"}`);
    void report(agent, "connected");
    return;
  }
  if (msg.type === "response" && typeof msg.id === "string") {
    const p = agent.pending.get(msg.id);
    if (!p) return; // уже отбит по таймауту
    agent.pending.delete(msg.id);
    clearTimeout(p.timer);
    p.resolve({ status: typeof msg.status === "number" ? msg.status : 502, body: typeof msg.body === "string" ? msg.body : "" });
  }
}

function failPending(agent: Agent, reason: string): void {
  for (const p of agent.pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  }
  agent.pending.clear();
}

type ForwardResult =
  | { ok: true; status: number; body: string }
  | { ok: false; code: "offline" | "timeout" | "disconnected"; error: string };

async function forward(
  serverId: string,
  req: { method: string; path: string; body: unknown; timeoutMs: number },
): Promise<ForwardResult> {
  const agent = agents.get(serverId);
  if (!agent || agent.ws.readyState !== WebSocket.OPEN) {
    return { ok: false, code: "offline", error: "Агент сервера не подключён" };
  }
  const id = randomUUID();
  const answer = new Promise<{ status: number; body: string }>((resolve, reject) => {
    const timer = setTimeout(() => {
      agent.pending.delete(id);
      reject(new Error("timeout"));
    }, req.timeoutMs);
    agent.pending.set(id, { resolve, reject, timer });
  });
  agent.ws.send(JSON.stringify({ type: "request", id, method: req.method, path: req.path, body: req.body ?? null }));
  try {
    const r = await answer;
    return { ok: true, ...r };
  } catch (e) {
    const timeout = e instanceof Error && e.message === "timeout";
    return {
      ok: false,
      code: timeout ? "timeout" : "disconnected",
      error: timeout ? `Агент не ответил за ${req.timeoutMs} мс` : "Агент отключился во время запроса",
    };
  }
}

// Живость сокетов: ping каждые 30 с, без pong к следующему тику — обрыв.
setInterval(() => {
  for (const agent of agents.values()) {
    if (!agent.alive) {
      console.log(`[relay] ${agent.name} не отвечает на ping — закрываю`);
      agent.ws.terminate();
      continue;
    }
    agent.alive = false;
    agent.ws.ping();
  }
}, PING_INTERVAL_MS).unref();

setInterval(() => {
  for (const agent of agents.values()) void report(agent, "heartbeat");
}, HEARTBEAT_INTERVAL_MS).unref();

// ---------- HTTP для control-plane ----------

function secretOk(header: string | string[] | undefined): boolean {
  const given = Array.isArray(header) ? header[0] : header;
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) });
  res.end(text);
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_REQUEST_BODY) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

async function handleHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", "http://relay");
  if (url.pathname === "/healthz") {
    json(res, 200, { ok: true, agents: agents.size });
    return;
  }
  if (!secretOk(req.headers["x-relay-secret"])) {
    json(res, 401, { error: "unauthorized" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/servers") {
    json(res, 200, {
      online: [...agents.values()].map((a) => ({
        serverId: a.serverId,
        name: a.name,
        version: a.version,
        hostname: a.hostname,
        connectedAt: a.connectedAt,
      })),
    });
    return;
  }
  const m = url.pathname.match(/^\/servers\/([0-9a-f-]{36})\/request$/);
  if (req.method === "POST" && m) {
    let body: { method?: unknown; path?: unknown; body?: unknown; timeoutMs?: unknown };
    try {
      body = ((await readJson(req)) ?? {}) as typeof body;
    } catch (e) {
      json(res, 400, { error: `bad request: ${e instanceof Error ? e.message : e}` });
      return;
    }
    const method = typeof body.method === "string" ? body.method.toUpperCase() : "GET";
    const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path : null;
    if (!path || !["GET", "POST", "PUT", "DELETE"].includes(method)) {
      json(res, 400, { error: "method/path invalid" });
      return;
    }
    const timeoutMs = Math.min(600_000, Math.max(1_000, Number(body.timeoutMs) || DEFAULT_TIMEOUT_MS));
    json(res, 200, await forward(m[1], { method, path, body: body.body, timeoutMs }));
    return;
  }
  json(res, 404, { error: "not found" });
}

const server = http.createServer((req, res) => {
  handleHttp(req, res).catch((e) => {
    console.error("[relay] http:", e);
    if (!res.headersSent) json(res, 500, { error: "internal" });
  });
});

function rejectUpgrade(socket: import("node:stream").Duplex, status: number, text: string): void {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

server.on("upgrade", (req, socket, head) => {
  const pathname = (req.url || "").split("?")[0];
  if (pathname !== "/agent") {
    rejectUpgrade(socket, 404, "Not Found");
    return;
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    rejectUpgrade(socket, 401, "Unauthorized");
    return;
  }
  authenticate(token)
    .then((who) => {
      if (!who) {
        rejectUpgrade(socket, 401, "Unauthorized");
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => attach(ws, who));
    })
    .catch((e) => {
      console.error(`[relay] проверка токена не удалась: ${e instanceof Error ? e.message : e}`);
      rejectUpgrade(socket, 502, "Bad Gateway");
    });
});

server.listen(PORT, () => {
  console.log(`[relay] слушаю :${PORT}, control-plane ${CONTROL_URL}`);
});
