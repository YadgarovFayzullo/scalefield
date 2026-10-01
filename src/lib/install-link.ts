import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Ссылка установки агента для «Add server» в одну команду:
 *
 *   curl -fsSL https://scalefield.uz/api/install/<token> | sudo bash
 *
 * Токен — `<serverId>.<exp>.<подпись>`, подпись HMAC от ENCRYPTION_KEY, в базе
 * ничего не храним. Живёт сутки; повторный запуск той же команды безопасен
 * (скрипт идемпотентен). Сама ссылка секрета агента не содержит — скрипт с
 * токеном агента отдаёт /api/install/<token>, проверив подпись и срок.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  const raw = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  return createHmac("sha256", "scalefield:install:" + raw).update(payload).digest("base64url").slice(0, 32);
}

export function installToken(serverId: string, now = Date.now()): string {
  const payload = `${serverId}.${Math.floor((now + TTL_MS) / 1000).toString(36)}`;
  return `${payload}.${sign(payload)}`;
}

/** id сервера, если подпись верна и срок не истёк. */
export function verifyInstallToken(token: string, now = Date.now()): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [serverId, exp, sig] = parts;
  const expected = sign(`${serverId}.${exp}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (parseInt(exp, 36) * 1000 < now) return null;
  return serverId;
}

/** Публичный адрес панели: APP_URL, иначе origin запроса (dev). */
export function installCommand(serverId: string, origin: string): string {
  const base = (process.env.APP_URL || origin).replace(/\/+$/, "");
  return `curl -fsSL ${base}/api/install/${installToken(serverId)} | sudo bash`;
}
