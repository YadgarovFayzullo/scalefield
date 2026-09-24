import "server-only";

/** Вызов агента проекта (FastAPI на сервере). Токен — только на сервере. */
export class AgentError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export async function agentRequest<T>(
  agent: { agentUrl: string; agentToken: string },
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${agent.agentUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: { "X-Status-Token": agent.agentToken, "content-type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(init?.timeoutMs ?? 20_000),
    });
  } catch (e) {
    throw new AgentError(`Агент недоступен: ${e instanceof Error ? e.message : String(e)}`);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* не JSON */
  }
  if (!res.ok) {
    const detail = (json as { detail?: unknown } | null)?.detail;
    throw new AgentError(typeof detail === "string" ? detail : `Агент ответил ${res.status}`, res.status);
  }
  return json as T;
}
