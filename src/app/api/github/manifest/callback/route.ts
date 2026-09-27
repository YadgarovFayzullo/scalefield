import { NextRequest, NextResponse } from "next/server";
import { requestUser } from "@/lib/auth";
import { appUrl, saveFromManifest } from "@/lib/github-app";
import { clearNonceCookie, readState } from "@/lib/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GitHub вернул код манифеста → обмениваем на id, ключ и секреты приложения и сохраняем шифрованными. */
export async function GET(req: NextRequest) {
  const done = (params: Record<string, string>) => {
    const url = new URL("/settings/github", appUrl());
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = NextResponse.redirect(url);
    clearNonceCookie(res);
    return res;
  };
  const user = await requestUser(req);
  if (!user?.isPlatformAdmin) return done({ error: "Only the platform owner can create the GitHub App" });
  const state = readState(req, req.nextUrl.searchParams.get("state"));
  if (!state || state.mode !== "manifest") return done({ error: "The GitHub App setup link expired — try again" });
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return done({ error: "GitHub did not return a code" });
  try {
    const app = await saveFromManifest(code);
    return done({ created: app.slug });
  } catch (e) {
    return done({ error: e instanceof Error ? e.message : String(e) });
  }
}
