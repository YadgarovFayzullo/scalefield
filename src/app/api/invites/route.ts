import { NextRequest, NextResponse } from "next/server";
import { requestUser } from "@/lib/auth";
import { createInvite, InviteError, listInvites } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function inviteError(e: unknown) {
  if (e instanceof InviteError) return NextResponse.json({ error: e.message }, { status: e.status });
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isPlatformAdmin) return NextResponse.json({ error: "Only the platform owner can see invites" }, { status: 403 });
  return NextResponse.json({ invites: await listInvites() });
}

/** Новое приглашение; токен в ответе — единственный раз, в базе только хеш. */
export async function POST(req: NextRequest) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; joinOrgId?: string | null; role?: string; note?: string };
    const { token, invite } = await createInvite(user, body);
    // За Traefik адрес приходит в x-forwarded-*; напрямую (dev) — из самого запроса.
    const host = req.headers.get("x-forwarded-host");
    const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
    const origin = host ? `${proto}://${host}` : req.nextUrl.origin;
    return NextResponse.json({ invite, link: `${origin}/signup?invite=${token}` }, { status: 201 });
  } catch (e) {
    return inviteError(e);
  }
}
