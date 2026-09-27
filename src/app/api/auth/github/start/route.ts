import { NextRequest, NextResponse } from "next/server";
import { appUrl, getGithubApp } from "@/lib/github-app";
import { createState, setNonceCookie, type OAuthState } from "@/lib/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Уход на GitHub: `mode=login|signup|link` — OAuth приложения (вход,
 * регистрация по приглашению, привязка GitHub к текущему аккаунту);
 * `mode=install` — установка приложения на аккаунт/организацию GitHub для
 * команды `org`. Возврат — /api/auth/github/callback.
 */
export async function GET(req: NextRequest) {
  const app = await getGithubApp();
  if (!app) return NextResponse.redirect(new URL("/login?error=GitHub%20sign-in%20is%20not%20set%20up%20yet", appUrl()));
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode") || "login";
  const next = sp.get("next") || undefined;

  let state: OAuthState;
  if (mode === "signup") state = { mode: "signup", invite: sp.get("invite") || "" };
  else if (mode === "link") state = { mode: "link", next };
  else if (mode === "install") state = { mode: "install", orgId: sp.get("org") || "", next };
  else state = { mode: "login", next };

  const { state: s, nonce } = createState(state);
  const target =
    state.mode === "install"
      ? `https://github.com/apps/${app.slug}/installations/new?state=${encodeURIComponent(s)}`
      : `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(app.clientId)}&redirect_uri=${encodeURIComponent(
          `${appUrl()}/api/auth/github/callback`,
        )}&state=${encodeURIComponent(s)}`;
  const res = NextResponse.redirect(target);
  setNonceCookie(res, nonce);
  return res;
}
