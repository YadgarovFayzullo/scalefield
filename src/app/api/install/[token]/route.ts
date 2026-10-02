import { NextRequest } from "next/server";
import { verifyInstallToken } from "@/lib/install-link";
import { pendingInstallScript } from "@/lib/servers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `curl -fsSL …/api/install/<token> | sudo bash` — скрипт установки агента для
 * сервера, добавленного одной кнопкой. Публичная ручка: доступ даёт подпись
 * токена (src/lib/install-link.ts). Ошибка — тоже bash, чтобы человек увидел
 * понятный текст в терминале, а не HTML.
 */
function bashError(message: string) {
  const quoted = `'Scalefield: ${message.replace(/'/g, `'\\''`)}'`;
  return new Response(`#!/usr/bin/env bash\nprintf '%s\\n' ${quoted} >&2\nexit 1\n`, {
    status: 200,
    headers: { "content-type": "text/x-shellscript; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const serverId = verifyInstallToken(token);
  if (!serverId) return bashError("this install link is invalid or expired. Open Servers in Scalefield and press Add server again.");
  try {
    const script = await pendingInstallScript(serverId);
    if (!script) return bashError("this server was removed from Scalefield. Press Add server again.");
    return new Response(script, {
      headers: { "content-type": "text/x-shellscript; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (e) {
    return bashError(`the panel could not prepare the install (${e instanceof Error ? e.message : String(e)}).`);
  }
}
