import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, expectedToken } from "@/lib/session";

export const runtime = "nodejs";

// Небольшая задержка от брутфорса owner-пароля.
function slow(): Promise<void> {
  return new Promise((r) => setTimeout(r, 400));
}

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD не задан на сервере" },
      { status: 500 },
    );
  }

  await slow();
  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await expectedToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
