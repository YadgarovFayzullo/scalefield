import { NextRequest, NextResponse } from "next/server";
import { requestUser, serverAllowed } from "@/lib/auth";
import { AgentError } from "@/lib/agent";
import { fixServerProxy, serverJob, serverProxyState } from "@/lib/servers";
import { serverError } from "../../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(e: unknown) {
  if (e instanceof AgentError) return NextResponse.json({ error: e.message }, { status: e.status });
  return serverError(e);
}

/** Кто держит 80/443 на сервере; `?job=<id>&since=N` — ход починки с логом. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await serverAllowed(req, params))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const job = req.nextUrl.searchParams.get("job");
  try {
    if (job) return NextResponse.json({ job: await serverJob(id, job, Number(req.nextUrl.searchParams.get("since")) || 0) });
    return NextResponse.json({ proxy: await serverProxyState(id) });
  } catch (e) {
    return fail(e);
  }
}

/** Починить: свой Traefik — в сеть edge, чужой прокси — заменить нашим Traefik (с откатом). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await serverAllowed(req, params))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const user = await requestUser(req);
  try {
    return NextResponse.json({ job: await fixServerProxy(id, user?.email) });
  } catch (e) {
    return fail(e);
  }
}
