import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, primaryOrgId, requestUser, setSessionCookie, type SessionUser } from "@/lib/auth";
import { appUrl, exchangeUserCode, fetchGithubUser, getGithubApp, linkUserInstallations, type GithubUser } from "@/lib/github-app";
import { acceptInviteWithGithub, InviteError, registerWithGithub, signupOpen } from "@/lib/invites";
import { clearNonceCookie, readState } from "@/lib/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Возврат с GitHub для всех сценариев: вход, регистрация по приглашению,
 * привязка GitHub к аккаунту и установка приложения. Установка приходит
 * через OAuth (`request_oauth_on_install`) с `installation_id` — и
 * привязывается к команде, только если GitHub подтверждает токеном
 * пользователя, что эта установка ему доступна: подставить чужой id нельзя.
 */
function back(path: string, params: Record<string, string>): NextResponse {
  const url = new URL(path, appUrl());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  clearNonceCookie(res);
  return res;
}

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

async function signIn(req: NextRequest, userId: string, gh: GithubUser, to: string): Promise<NextResponse> {
  await db.update(schema.users).set({ githubLogin: gh.login, avatarUrl: gh.avatarUrl }).where(eq(schema.users.id, userId));
  const { token, expires } = await createSession(userId, req.headers.get("user-agent"));
  const res = back(to, {});
  setSessionCookie(res, token, expires);
  return res;
}

async function linkInstallations(user: SessionUser, orgId: string, userToken: string, onlyId: string | null): Promise<number> {
  const member = user.memberships.find((m) => m.orgId === orgId);
  if (!member || (member.role !== "owner" && member.role !== "admin")) throw new Error("Only team owners and admins can connect GitHub");
  return linkUserInstallations(orgId, user.id, userToken, onlyId);
}

/**
 * После входа/регистрации через GitHub: установки приложения, уже доступные
 * этому пользователю, сразу подключаются к его СОБСТВЕННОЙ команде (где он
 * owner) — как у Vercel, репозитории видны без лишнего шага. В чужую
 * команду, где он лишь участник, ничего не подключаем.
 */
async function autoLink(userId: string, userToken: string): Promise<void> {
  const own = await db
    .select({ orgId: schema.memberships.orgId })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.role, "owner")))
    .limit(1);
  if (!own[0]) return;
  try {
    await linkUserInstallations(own[0].orgId, userId, userToken);
  } catch {
    /* установок нет или GitHub не ответил — подключат вручную на /new */
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const installationId = sp.get("installation_id");
  let state = readState(req, sp.get("state"));
  const current = await requestUser(req);

  // GitHub не всегда возвращает state после установки — тогда это
  // установка для основной команды вошедшего пользователя (проверка доступа
  // ниже всё равно через его токен).
  if (!state && installationId && current) {
    const orgId = primaryOrgId(current);
    if (orgId) state = { mode: "install", orgId };
  }
  if (!state) return back("/login", { error: "The GitHub sign-in link expired — try again" });
  const onSettings = state.mode === "install" || state.mode === "link";
  if (!code) return back(onSettings ? "/settings/github" : "/login", { error: "GitHub did not complete the sign-in" });

  const app = await getGithubApp();
  if (!app) return back("/login", { error: "GitHub sign-in is not set up" });

  try {
    const userToken = await exchangeUserCode(app, code);
    const gh = await fetchGithubUser(userToken);

    if (state.mode === "install") {
      if (!current) return back("/login", { error: "Sign in to Scalefield first, then connect GitHub" });
      const n = await linkInstallations(current, state.orgId, userToken, installationId);
      return back(state.next === "/new" ? "/new" : "/settings/github", { connected: String(n) });
    }

    if (state.mode === "link") {
      if (!current) return back("/login", { error: "Sign in to Scalefield first" });
      const taken = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.githubId, gh.id)).limit(1);
      if (taken.length && taken[0].id !== current.id) return back("/settings/github", { error: `GitHub @${gh.login} is linked to another Scalefield account` });
      await db.update(schema.users).set({ githubId: gh.id, githubLogin: gh.login, avatarUrl: gh.avatarUrl }).where(eq(schema.users.id, current.id));
      return back("/settings/github", { linked: gh.login });
    }

    if (state.mode === "signup") {
      const userId = await acceptInviteWithGithub(state.invite, gh);
      await autoLink(userId, userToken);
      return signIn(req, userId, gh, "/new");
    }

    // Манифест приходит на свой callback (/api/github/manifest/callback), не сюда.
    if (state.mode === "manifest") return back("/settings/github", { error: "Unexpected GitHub response" });

    // Вход: по привязанному GitHub; иначе по совпадающему ПОДТВЕРЖДЁННОМУ
    // email (так владелец, заведённый с паролем, входит через GitHub сразу).
    const byGithub = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.githubId, gh.id)).limit(1);
    if (byGithub[0]) {
      await autoLink(byGithub[0].id, userToken);
      return signIn(req, byGithub[0].id, gh, safeNext(state.next));
    }
    if (gh.email) {
      const byEmail = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(sql`lower(${schema.users.email}) = ${gh.email}`, sql`${schema.users.githubId} is null`))
        .limit(1);
      if (byEmail[0]) {
        await db.update(schema.users).set({ githubId: gh.id }).where(eq(schema.users.id, byEmail[0].id));
        await autoLink(byEmail[0].id, userToken);
        return signIn(req, byEmail[0].id, gh, safeNext(state.next));
      }
    }
    // Открытая регистрация (SIGNUP_OPEN=true): аккаунта нет — создаём его со
    // своей командой прямо из GitHub и ведём импортировать репозиторий.
    if (signupOpen()) {
      const userId = await registerWithGithub(gh);
      await autoLink(userId, userToken);
      return signIn(req, userId, gh, "/new");
    }
    return back("/login", { error: `No Scalefield account for GitHub @${gh.login}. Scalefield is invite-only — open your invite link to sign up.` });
  } catch (e) {
    const msg = e instanceof InviteError || e instanceof Error ? e.message : String(e);
    return back(onSettings ? "/settings/github" : state.mode === "signup" ? "/signup" : "/login", { error: msg });
  }
}
