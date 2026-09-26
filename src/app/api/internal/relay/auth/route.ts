import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashAgentToken } from "@/lib/agent-token";
import { relaySecretOk } from "@/lib/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Relay спрашивает, чей это токен агента, когда агент открывает WebSocket.
 * Relay в базу не ходит — control-plane единственный, кто знает серверы.
 * Доступ только по `x-relay-secret`; ответ — id и имя сервера.
 */
export async function POST(req: NextRequest) {
  if (!relaySecretOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.agentTokenHash, hashAgentToken(token)),
    columns: { id: true, name: true },
  });
  if (!server) return NextResponse.json({ error: "unknown agent token" }, { status: 401 });
  return NextResponse.json({ serverId: server.id, name: server.name });
}
