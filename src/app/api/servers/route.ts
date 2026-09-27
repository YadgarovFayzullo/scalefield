import { NextRequest, NextResponse } from "next/server";
import { primaryOrgId, requestUser } from "@/lib/auth";
import { createServer, listServers, orgSshPublicKey, ServerError, type CreateServerInput } from "@/lib/servers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function serverError(e: unknown) {
  if (e instanceof ServerError) return NextResponse.json({ error: e.message }, { status: e.status });
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = primaryOrgId(user);
  try {
    const [servers, sshPublicKey] = await Promise.all([listServers(user.orgIds), orgId ? orgSshPublicKey(orgId) : Promise.resolve("")]);
    return NextResponse.json({ servers, sshPublicKey });
  } catch (e) {
    return serverError(e);
  }
}

/** «Добавить сервер» в команду пользователя: запись + фоновая установка агента по SSH; пароль в базу не попадает. */
export async function POST(req: NextRequest) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = primaryOrgId(user);
  if (!orgId) return NextResponse.json({ error: "You are not a member of any team" }, { status: 403 });
  try {
    const server = await createServer((await req.json()) as CreateServerInput, orgId);
    return NextResponse.json({ server }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
