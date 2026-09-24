import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { buildService, getServiceForHook } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook GitHub (push) для сервиса: адрес `/api/hooks/github/<serviceId>`,
 * секрет — `webhookSecret` сервиса, подпись `X-Hub-Signature-256`. Без сессии,
 * поэтому proxy.ts пускает этот путь; без верной подписи — 401.
 * Push в ветку сервиса при включённом autoDeploy запускает сборку; ответ
 * уходит сразу (GitHub ждёт не дольше 10 с), сборка идёт у агента в фоне.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const found = await getServiceForHook(serviceId);
  if (!found) return NextResponse.json({ error: "Unknown hook" }, { status: 404 });
  const { service, project } = found;
  const secret = service.webhookSecret;
  if (!secret) return NextResponse.json({ error: "Unknown hook" }, { status: 404 });

  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256") || "";
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event") || "";
  if (event === "ping") return NextResponse.json({ ok: true, pong: true });
  if (event !== "push") return NextResponse.json({ ok: true, ignored: event });

  let payload: { ref?: string; after?: string; deleted?: boolean; pusher?: { name?: string }; head_commit?: { message?: string } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  const branch = (payload.ref || "").replace(/^refs\/heads\//, "");
  const wanted = service.branch || "main";
  if (payload.deleted || branch !== wanted) return NextResponse.json({ ok: true, ignored: `branch ${branch}` });
  if (!service.autoDeploy) return NextResponse.json({ ok: true, ignored: "autoDeploy is off" });

  try {
    const row = await buildService(project.slug, project.id, service.id, {
      ref: branch,
      sha: payload.after,
      actor: payload.pusher?.name || "github",
      event: "push",
      title: (payload.head_commit?.message || `push ${branch}`).split("\n")[0].slice(0, 200),
    });
    return NextResponse.json({ ok: true, deployment: row.externalId }, { status: 202 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
