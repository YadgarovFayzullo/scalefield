import { NextRequest, NextResponse } from "next/server";
import { requestUser } from "@/lib/auth";
import { manifestFor } from "@/lib/github-app";
import { createState, setNonceCookie } from "@/lib/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Создание GitHub App платформы по манифесту: GitHub принимает манифест
 * только POST-формой из браузера, поэтому отдаём страницу, которая сама
 * отправляет форму на github.com. Только владелец платформы.
 */
export async function GET(req: NextRequest) {
  const user = await requestUser(req);
  if (!user?.isPlatformAdmin) return NextResponse.json({ error: "Only the platform owner can create the GitHub App" }, { status: 403 });
  const name = (req.nextUrl.searchParams.get("name") || "Scalefield").trim().slice(0, 34) || "Scalefield";
  const { state, nonce } = createState({ mode: "manifest" });
  const manifest = JSON.stringify(manifestFor(name));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Creating GitHub App…</title></head>
<body style="font-family:system-ui;padding:2rem">
<p>Redirecting to GitHub to create “${esc(name)}”…</p>
<form id="f" method="post" action="https://github.com/settings/apps/new?state=${encodeURIComponent(state)}">
<input type="hidden" name="manifest" value="${esc(manifest)}">
<noscript><button type="submit">Continue to GitHub</button></noscript>
</form>
<script>document.getElementById("f").submit()</script>
</body></html>`;
  const res = new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  setNonceCookie(res, nonce);
  return res;
}
