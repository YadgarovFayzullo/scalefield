import "server-only";
import type { Server } from "@/db/schema";
import { decryptSecret } from "@/lib/secrets";
import { relaySecret, relayUrl } from "@/lib/relay";

/**
 * Вызов агента сервера. Единственное место, которое знает, КАК до агента
 * достучаться; всё остальное (сервисы, деплои, прокси метрик) зовёт
 * `agentRequest`/`agentRaw` и не различает транспорт.
 *
 * Два режима:
 * - relay (основной): `POST <RELAY_URL>/servers/<id>/request` — relay
 *   пересылает запрос по WebSocket, который агент сам держит к нему
 *   (relay/server.ts, agent/app/tunnel.py). Входящих портов у агента нет.
 * - прямой (переходный): `agentUrl` задан → HTTP на порт агента с
 *   X-Status-Token. Только когда control-plane и агент в одной docker-сети.
 */
export type AgentRef = { serverId: string; agentUrl: string | null; agentToken: string };

export function agentRef(server: Pick<Server, "id" | "agentUrl" | "agentTokenEnc">): AgentRef {
  return {
    serverId: server.id,
    agentUrl: server.agentUrl ? server.agentUrl.replace(/\/+$/, "") : null,
    agentToken: decryptSecret(server.agentTokenEnc),
  };
}

export class AgentError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export type AgentInit = { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number };
export type AgentRawResponse = { status: number; text: string };

const DEFAULT_TIMEOUT_MS = 20_000;

/** Сырой ответ агента (статус + тело текстом) — для прокси, отдающих его как есть. */
export async function agentRaw(agent: AgentRef, path: string, init?: AgentInit): Promise<AgentRawResponse> {
  return agent.agentUrl ? direct(agent, path, init) : viaRelay(agent, path, init);
}

async function direct(agent: AgentRef, path: string, init?: AgentInit): Promise<AgentRawResponse> {
  let res: Response;
  try {
    res = await fetch(`${agent.agentUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: { "X-Status-Token": agent.agentToken, "content-type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(init?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (e) {
    throw new AgentError(`Агент недоступен: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { status: res.status, text: await res.text() };
}

type RelayEnvelope =
  | { ok: true; status: number; body: string }
  | { ok: false; code: "offline" | "timeout" | "disconnected"; error: string };

async function viaRelay(agent: AgentRef, path: string, init?: AgentInit): Promise<AgentRawResponse> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let res: Response;
  try {
    res = await fetch(`${relayUrl()}/servers/${agent.serverId}/request`, {
      method: "POST",
      headers: { "x-relay-secret": relaySecret(), "content-type": "application/json" },
      body: JSON.stringify({ method: init?.method ?? "GET", path, body: init?.body ?? null, timeoutMs }),
      cache: "no-store",
      // Relay сам отбивает по таймауту агента; запас — на сеть до relay.
      signal: AbortSignal.timeout(timeoutMs + 5_000),
    });
  } catch (e) {
    throw new AgentError(`Relay недоступен: ${e instanceof Error ? e.message : String(e)}`, 502);
  }
  if (!res.ok) throw new AgentError(`Relay ответил ${res.status}`, 502);
  const env = (await res.json()) as RelayEnvelope;
  if (!env.ok) throw new AgentError(env.error, env.code === "timeout" ? 504 : 503);
  return { status: env.status, text: env.body };
}

/** JSON-ответ агента; не-2xx → AgentError с `detail` агента. */
export async function agentRequest<T>(agent: AgentRef, path: string, init?: AgentInit): Promise<T> {
  const { status, text } = await agentRaw(agent, path, init);
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* не JSON */
  }
  if (status < 200 || status >= 300) {
    const detail = (json as { detail?: unknown } | null)?.detail;
    throw new AgentError(typeof detail === "string" ? detail : `Агент ответил ${status}`, status);
  }
  return json as T;
}
