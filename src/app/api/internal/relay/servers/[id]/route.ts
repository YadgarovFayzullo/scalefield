import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { relaySecretOk } from "@/lib/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENTS = new Set(["connected", "heartbeat", "disconnected"]);

/**
 * Relay сообщает о жизни агента: подключился, heartbeat раз в минуту,
 * отключился. Всё, что нужно control-plane, — `last_seen_at` и версия агента
 * («сервер недоступен» в списке решается по давности отметки, live-статус
 * спрашивается у relay напрямую — `relayOnline()`).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!relaySecretOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { event?: unknown; version?: unknown; hostname?: unknown } | null;
  const event = typeof body?.event === "string" ? body.event : "";
  if (!EVENTS.has(event)) return NextResponse.json({ error: "unknown event" }, { status: 400 });

  const patch: Partial<typeof schema.servers.$inferInsert> = { lastSeenAt: new Date() };
  if (typeof body?.version === "string") patch.agentVersion = body.version;
  if (typeof body?.hostname === "string") patch.agentHostname = body.hostname;
  const updated = await db.update(schema.servers).set(patch).where(eq(schema.servers.id, id)).returning({ id: schema.servers.id });
  if (updated.length === 0) return NextResponse.json({ error: "unknown server" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
