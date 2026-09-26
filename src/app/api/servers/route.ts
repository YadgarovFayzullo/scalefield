import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import { createServer, listServers, orgSshPublicKey, ServerError, type CreateServerInput } from "@/lib/servers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function serverError(e: unknown) {
  if (e instanceof ServerError) return NextResponse.json({ error: e.message }, { status: e.status });
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

export async function GET(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(COOKIE_NAME)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [servers, sshPublicKey] = await Promise.all([listServers(), orgSshPublicKey()]);
    return NextResponse.json({ servers, sshPublicKey });
  } catch (e) {
    return serverError(e);
  }
}

/** «Добавить сервер»: запись + фоновая установка агента по SSH; пароль в базу не попадает. */
export async function POST(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(COOKIE_NAME)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const server = await createServer((await req.json()) as CreateServerInput);
    return NextResponse.json({ server }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
