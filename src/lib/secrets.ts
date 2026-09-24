import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Шифрование секретов control-plane (токены агентов, строки подключения).
 * AES-256-GCM, ключ = SHA-256(ENCRYPTION_KEY). Формат: base64(iv | tag | ct)
 * с префиксом `v1:`, чтобы можно было сменить схему, не ломая старые записи.
 *
 * ENCRYPTION_KEY задаётся отдельно от SESSION_SECRET: ротация сессий не
 * должна делать нечитаемыми записи в базе. В dev без ключа берём
 * SESSION_SECRET, чтобы локальный запуск не требовал лишней настройки.
 */
function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  return createHash("sha256").update("scalefield:enc:" + raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "v1:" + Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith("v1:")) {
    throw new Error("Unknown secret format");
  }
  const buf = Buffer.from(stored.slice(3), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
