import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, destroySession } from "@/lib/auth";

export const runtime = "nodejs";

/** Выход: сессия удаляется из базы (а не только cookie в браузере). */
export async function POST(req: NextRequest) {
  await destroySession(req.cookies.get(COOKIE_NAME)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
