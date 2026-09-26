import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Связь control-plane с relay (relay/server.ts) — той точкой, к которой
 * подключаются агенты серверов. Обе стороны доверяют друг другу по общему
 * секрету RELAY_SECRET: control-plane шлёт его в `x-relay-secret`, когда
 * просит relay переслать запрос агенту, а relay — когда спрашивает
 * `/api/internal/relay/auth`, чей это токен, и сообщает о подключениях.
 */
export function relayUrl(): string {
  return (process.env.RELAY_URL || "http://localhost:3003").replace(/\/+$/, "");
}

export function relaySecret(): string {
  const s = process.env.RELAY_SECRET;
  if (!s) throw new Error("RELAY_SECRET is not set");
  return s;
}

/** Проверка `x-relay-secret` во внутренних ручках, которые зовёт relay. */
export function relaySecretOk(req: NextRequest): boolean {
  const given = req.headers.get("x-relay-secret");
  const expected = process.env.RELAY_SECRET;
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type RelayOnline = { serverId: string; name: string; version: string | null; hostname: string | null; connectedAt: number };

/** Кто сейчас подключён к relay. Relay недоступен → пустой список, не ошибка. */
export async function relayOnline(): Promise<Map<string, RelayOnline>> {
  const out = new Map<string, RelayOnline>();
  try {
    const res = await fetch(`${relayUrl()}/servers`, {
      headers: { "x-relay-secret": relaySecret() },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return out;
    const json = (await res.json()) as { online?: RelayOnline[] };
    for (const a of json.online ?? []) out.set(a.serverId, a);
  } catch {
    /* relay не поднят — все офлайн */
  }
  return out;
}
