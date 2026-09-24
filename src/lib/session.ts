// Сессия дашборда. Owner-only: один пароль (DASHBOARD_PASSWORD), после логина
// в httpOnly-cookie кладётся детерминированный токен = SHA-256(SESSION_SECRET).
// И proxy (edge), и route-handlers (node) сверяют cookie с этим значением
// через Web Crypto — работает в обоих рантаймах.

export const COOKIE_NAME = "scalefield_session";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET || "dev-insecure-secret";
  const data = new TextEncoder().encode("scalefield:v1:" + secret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await expectedToken();
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
