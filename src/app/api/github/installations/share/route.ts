import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requestUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Та же установка GitHub — в ещё одну свою команду, без повторного круга
 * через GitHub. Можно только установку, которую подключил сам пользователь
 * (её доступ уже подтвердил GitHub его токеном), и только в команду, где он
 * owner/admin.
 */
export async function POST(req: NextRequest) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { sourceId?: string; orgId?: string };
  const target = user.memberships.find((m) => m.orgId === body.orgId);
  if (!target || (target.role !== "owner" && target.role !== "admin")) {
    return NextResponse.json({ error: "Only team owners and admins can connect GitHub" }, { status: 403 });
  }
  const src = body.sourceId ? await db.query.githubInstallations.findFirst({ where: eq(schema.githubInstallations.id, body.sourceId) }) : null;
  if (!src || src.addedBy !== user.id || !user.orgIds.includes(src.orgId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db
    .insert(schema.githubInstallations)
    .values({
      installationId: src.installationId,
      orgId: target.orgId,
      accountLogin: src.accountLogin,
      accountType: src.accountType,
      accountAvatarUrl: src.accountAvatarUrl,
      addedBy: user.id,
    })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true });
}
