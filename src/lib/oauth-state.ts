import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

/**
 * `state` для редиректов на GitHub (вход, установка приложения, манифест):
 * подписанный JSON + одноразовый nonce в httpOnly-cookie браузера. Подпись
 * не даёт подделать режим/приглашение/команду, cookie — подсунуть чужой
 * `state` (CSRF при входе). Живёт 15 минут.
 */
const NONCE_COOKIE = "sf_gh_nonce";
const TTL_MS = 15 * 60 * 1000;

export type OAuthState =
  | { mode: "login"; next?: string }
  | { mode: "signup"; invite: string }
  | { mode: "link"; next?: string }
  | { mode: "install"; orgId: string; next?: string }
  | { mode: "manifest" };

function key(): string {
  const k = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY;
  if (!k) throw new Error("SESSION_SECRET is not set");
  return "scalefield:oauth-state:" + k;
}

function sign(body: string): string {
  return createHmac("sha256", key()).update(body).digest("base64url");
}

/** Новый state + nonce; nonce нужно положить в cookie ответа (`setNonceCookie`). */
export function createState(state: OAuthState): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...state, nonce, exp: Date.now() + TTL_MS })).toString("base64url");
  return { state: `${body}.${sign(body)}`, nonce };
}

export function setNonceCookie(res: NextResponse, nonce: string): void {
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export function clearNonceCookie(res: NextResponse): void {
  res.cookies.set(NONCE_COOKIE, "", { path: "/", maxAge: 0 });
}

/** Проверяет подпись, срок и совпадение nonce с cookie этого браузера. */
export function readState(req: NextRequest, raw: string | null): OAuthState | null {
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let parsed: OAuthState & { nonce?: string; exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed.exp || parsed.exp < Date.now()) return null;
  const cookie = req.cookies.get(NONCE_COOKIE)?.value;
  if (!cookie || !parsed.nonce || cookie !== parsed.nonce) return null;
  const { nonce: _n, exp: _e, ...state } = parsed;
  void _n;
  void _e;
  return state as OAuthState;
}
