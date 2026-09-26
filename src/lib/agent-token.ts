import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Токен агента — секрет сервера, которым агент представляется relay.
 * В базе лежит и шифрованным (`agent_token_enc`, чтобы показать команду
 * установки повторно), и хешем (`agent_token_hash`, по нему relay ищет
 * сервер). Хеш — обычный sha256: токен случайный и длинный, соль не нужна.
 */
export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAgentToken(): string {
  return "sfa_" + randomBytes(24).toString("base64url");
}
