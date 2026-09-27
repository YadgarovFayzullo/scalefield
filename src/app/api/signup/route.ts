import { NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth";
import { acceptInvite, InviteError } from "@/lib/invites";

export const runtime = "nodejs";

/** Регистрация по приглашению → сразу вход. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  try {
    const userId = await acceptInvite({ token: str("invite"), name: str("name"), email: str("email"), password: str("password") });
    const { token, expires } = await createSession(userId, req.headers.get("user-agent"));
    const res = NextResponse.json({ ok: true }, { status: 201 });
    setSessionCookie(res, token, expires);
    return res;
  } catch (e) {
    if (e instanceof InviteError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
