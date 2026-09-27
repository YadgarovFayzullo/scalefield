import { NextRequest, NextResponse } from "next/server";
import { requestUser } from "@/lib/auth";
import { revokeInvite } from "@/lib/invites";
import { inviteError } from "../route";

export const runtime = "nodejs";

/** Отозвать неиспользованное приглашение. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await revokeInvite(user, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return inviteError(e);
  }
}
