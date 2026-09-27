import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/passwords";

export const runtime = "nodejs";

// Небольшая задержка от перебора паролей — одинаковая для «нет такого
// пользователя» и «неверный пароль», чтобы не выдавать, какие email есть.
function slow(): Promise<void> {
  return new Promise((r) => setTimeout(r, 400));
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  await slow();
  if (!email || !password) return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });

  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }
  const { token, expires } = await createSession(user.id, req.headers.get("user-agent"));
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, token, expires);
  return res;
}
