import { NextRequest, NextResponse } from "next/server";
import { primaryOrgId, requestUser } from "@/lib/auth";
import { createPendingServer, createServer, listServers, orgSshPublicKey, ServerError, type CreateServerInput } from "@/lib/servers";

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

/**
 * «Добавить сервер»: `{mode: "command"}` — запись `waiting` и команда установки
 * (основной путь), иначе — адрес и пароль, панель ставит агента сама по SSH.
 * Пароль в базу не попадает.
 */
export async function POST(req: NextRequest) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = primaryOrgId(user);
  if (!orgId) return NextResponse.json({ error: "You are not a member of any team" }, { status: 403 });
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CreateServerInput> & { mode?: string };
    // «Add server» одной кнопкой: без адреса — сервер ждёт команду установки.
    const server = body.mode === "command" ? await createPendingServer(orgId) : await createServer(body as CreateServerInput, orgId, user.email);
    return NextResponse.json({ server }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
