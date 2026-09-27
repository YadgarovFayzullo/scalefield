import { NextRequest, NextResponse } from "next/server";
import { lookupInvite } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Публичная: страница регистрации проверяет ссылку до того, как показать форму. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const info = token.startsWith("sfi_") ? await lookupInvite(token) : null;
  if (!info) return NextResponse.json({ error: "This invite is invalid, expired or already used" }, { status: 410 });
  return NextResponse.json(info);
}
