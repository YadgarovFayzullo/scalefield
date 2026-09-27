import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requestUser } from "@/lib/auth";

export const runtime = "nodejs";

/** Отвязать установку GitHub от команды (на GitHub приложение остаётся — удалить его можно там). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await db.query.githubInstallations.findFirst({ where: eq(schema.githubInstallations.id, id) });
  const member = row ? user.memberships.find((m) => m.orgId === row.orgId) : null;
  if (!row || !member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (member.role !== "owner" && member.role !== "admin") return NextResponse.json({ error: "Only team owners and admins can disconnect GitHub" }, { status: 403 });
  await db.delete(schema.githubInstallations).where(and(eq(schema.githubInstallations.id, id), eq(schema.githubInstallations.orgId, row.orgId)));
  return NextResponse.json({ ok: true });
}
