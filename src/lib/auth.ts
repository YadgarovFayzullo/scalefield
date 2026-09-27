import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";

/**
 * Аккаунты панели: сессии в базе, членство в организациях, доступ к
 * проекту и серверу. Правило доступа одно на всю панель — объект виден
 * только участникам организации, которой он принадлежит; проверяет его
 * `src/proxy.ts` для всех путей `/p/<slug>`, `/api/projects/<slug>`,
 * `/servers/<id>`, `/api/servers/<id>`, а списки (проекты, серверы)
 * фильтруются по `orgIds` пользователя.
 */
export const COOKIE_NAME = "scalefield_session";
const SESSION_DAYS = 30;
const TOUCH_EVERY_MS = 10 * 60 * 1000;

export type Membership = { orgId: string; role: string };
export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  githubLogin: string | null;
  isPlatformAdmin: boolean;
  memberships: Membership[];
  orgIds: string[];
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent: string | null): Promise<{ token: string; expires: Date }> {
  const token = "sfs_" + randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db.insert(schema.sessions).values({ tokenHash: hashToken(token), userId, userAgent: userAgent?.slice(0, 300) ?? null, expiresAt: expires });
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId));
  return { token, expires };
}

export function setSessionCookie(res: NextResponse, token: string, expires: Date): void {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashToken(token)));
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token || !token.startsWith("sfs_")) return null;
  const rows = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const memberships = await db
    .select({ orgId: schema.memberships.orgId, role: schema.memberships.role })
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, row.user.id));
  if (Date.now() - row.session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    void db.update(schema.sessions).set({ lastSeenAt: new Date() }).where(eq(schema.sessions.id, row.session.id)).catch(() => {});
  }
  return {
    id: row.user.id,
    email: row.user.email,
    name: row.user.name,
    avatarUrl: row.user.avatarUrl,
    githubLogin: row.user.githubLogin,
    isPlatformAdmin: row.user.isPlatformAdmin,
    memberships,
    orgIds: memberships.map((m) => m.orgId),
  };
}

/** Пользователь запроса в route handler'е. */
export function requestUser(req: NextRequest): Promise<SessionUser | null> {
  return getSessionUser(req.cookies.get(COOKIE_NAME)?.value);
}

/** Пользователь в серверном компоненте (страницы, layout). */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return getSessionUser(jar.get(COOKIE_NAME)?.value);
}

/** Организация, в которую пользователь создаёт серверы: где он owner/admin, иначе первая. */
export function primaryOrgId(user: SessionUser): string | null {
  const managed = user.memberships.find((m) => m.role === "owner" || m.role === "admin");
  return (managed ?? user.memberships[0])?.orgId ?? null;
}

export async function canAccessProject(user: SessionUser, slug: string): Promise<boolean> {
  if (user.orgIds.length === 0) return false;
  const rows = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.slug, slug), inArray(schema.projects.orgId, user.orgIds)))
    .limit(1);
  return rows.length > 0;
}

export async function canAccessServer(user: SessionUser, id: string): Promise<boolean> {
  if (user.orgIds.length === 0) return false;
  const rows = await db
    .select({ id: schema.servers.id })
    .from(schema.servers)
    .where(and(eq(schema.servers.id, id), inArray(schema.servers.orgId, user.orgIds)))
    .limit(1);
  return rows.length > 0;
}
