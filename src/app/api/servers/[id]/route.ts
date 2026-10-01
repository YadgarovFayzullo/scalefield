import { NextRequest, NextResponse } from "next/server";
import { serverAllowed } from "@/lib/auth";
import { getServer, reinstallServer } from "@/lib/servers";
import { serverError } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Состояние сервера с логом установки — страница сервера поллит его, пока идёт установка. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await serverAllowed(req, params))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const server = await getServer(id, req.nextUrl.origin);
    if (!server) return NextResponse.json({ error: "Unknown server" }, { status: 404 });
    return NextResponse.json({ server });
  } catch (e) {
    return serverError(e);
  }
}

/** Переустановить агента ключом организации (без пароля). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await serverAllowed(req, params))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as { installTraefik?: boolean; acmeEmail?: string; host?: string; password?: string };
    return NextResponse.json({ server: await reinstallServer(id, body) });
  } catch (e) {
    return serverError(e);
  }
}
