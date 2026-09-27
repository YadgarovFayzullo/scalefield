import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken, type SessionUser } from "@/lib/auth";
import { hashPassword, passwordProblem } from "@/lib/passwords";

/**
 * Регистрация по приглашению. Приглашение выдаёт владелец платформы
 * (`users.is_platform_admin`): ссылка /signup?invite=<токен> показывается
 * один раз, в базе — хеш. По приглашению без `org_id` человек получает
 * свою команду (как Hobby-аккаунт у Vercel), с `org_id` — входит в эту
 * команду с ролью `role`.
 */
export class InviteError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_DAYS = 14;

export type InviteView = {
  id: string;
  email: string | null;
  orgName: string | null;
  role: string;
  note: string | null;
  expiresAt: string;
  usedAt: string | null;
  usedByEmail: string | null;
  createdAt: string;
};

export async function listInvites(): Promise<InviteView[]> {
  const rows = await db
    .select({ invite: schema.invites, orgName: schema.organizations.name, usedByEmail: schema.users.email })
    .from(schema.invites)
    .leftJoin(schema.organizations, eq(schema.organizations.id, schema.invites.orgId))
    .leftJoin(schema.users, eq(schema.users.id, schema.invites.usedBy))
    .orderBy(desc(schema.invites.createdAt))
    .limit(200);
  return rows.map(({ invite: i, orgName, usedByEmail }) => ({
    id: i.id,
    email: i.email,
    orgName: orgName ?? null,
    role: i.role,
    note: i.note,
    expiresAt: i.expiresAt.toISOString(),
    usedAt: i.usedAt ? i.usedAt.toISOString() : null,
    usedByEmail: usedByEmail ?? null,
    createdAt: i.createdAt.toISOString(),
  }));
}

export async function createInvite(
  by: SessionUser,
  input: { email?: string; joinOrgId?: string | null; role?: string; note?: string },
): Promise<{ token: string; invite: InviteView }> {
  if (!by.isPlatformAdmin) throw new InviteError("Only the platform owner can invite", 403);
  const email = (input.email || "").trim().toLowerCase() || null;
  if (email && !EMAIL_RE.test(email)) throw new InviteError("Email is invalid");
  if (email) {
    const taken = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (taken.length) throw new InviteError("A user with this email already exists", 409);
  }
  const orgId = input.joinOrgId || null;
  if (orgId && !by.orgIds.includes(orgId)) throw new InviteError("You are not a member of that team", 403);
  const role = orgId ? (input.role === "admin" ? "admin" : "member") : "owner";
  const token = "sfi_" + randomBytes(24).toString("base64url");
  const [row] = await db
    .insert(schema.invites)
    .values({
      tokenHash: hashToken(token),
      email,
      orgId,
      role,
      note: input.note?.trim().slice(0, 200) || null,
      createdBy: by.id,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 3600 * 1000),
    })
    .returning();
  const invite = (await listInvites()).find((i) => i.id === row.id)!;
  return { token, invite };
}

export async function revokeInvite(by: SessionUser, id: string): Promise<void> {
  if (!by.isPlatformAdmin) throw new InviteError("Only the platform owner can revoke invites", 403);
  await db.delete(schema.invites).where(and(eq(schema.invites.id, id), isNull(schema.invites.usedAt)));
}

async function findUsable(token: string) {
  const rows = await db
    .select()
    .from(schema.invites)
    .where(and(eq(schema.invites.tokenHash, hashToken(token)), isNull(schema.invites.usedAt), gt(schema.invites.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

/** Для страницы регистрации: действительно ли приглашение и на какой email/команду. */
export async function lookupInvite(token: string): Promise<{ email: string | null; orgName: string | null } | null> {
  const inv = await findUsable(token);
  if (!inv) return null;
  let orgName: string | null = null;
  if (inv.orgId) {
    const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, inv.orgId) });
    orgName = org?.name ?? null;
  }
  return { email: inv.email, orgName };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "team"
  );
}

async function freeOrgSlug(base: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await db.select({ id: schema.organizations.id }).from(schema.organizations).where(eq(schema.organizations.slug, slug)).limit(1);
    if (!taken.length) return slug;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/** Регистрация: пользователь + команда (своя или из приглашения); приглашение гасится в той же транзакции. */
export async function acceptInvite(input: { token: string; name: string; email: string; password: string }): Promise<string> {
  const problem = passwordProblem(input.password);
  if (problem) throw new InviteError(problem);
  return registerFromInvite({ token: input.token, name: input.name, email: input.email, passwordHash: await hashPassword(input.password), github: null });
}

/** Регистрация по приглашению через GitHub: email — подтверждённый основной адрес GitHub, пароля нет. */
export async function acceptInviteWithGithub(
  token: string,
  gh: { id: string; login: string; name: string | null; avatarUrl: string | null; email: string | null },
): Promise<string> {
  const linked = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.githubId, gh.id)).limit(1);
  if (linked.length) throw new InviteError("This GitHub account is already linked to a Scalefield user — sign in instead", 409);
  // Без публичного email на GitHub берём адрес из приглашения: ссылка и так
  // даёт право зарегистрироваться на него (как при регистрации с паролем).
  let email = gh.email;
  if (!email) {
    const inv = await findUsable(token);
    email = inv?.email ?? null;
  }
  if (!email) throw new InviteError("Your GitHub profile has no public email — sign up with email and password, then link GitHub in Settings");
  return registerFromInvite({ token, name: gh.name || gh.login, email, passwordHash: null, github: gh });
}

async function registerFromInvite(input: {
  token: string;
  name: string;
  email: string;
  passwordHash: string | null;
  github: { id: string; login: string; avatarUrl: string | null } | null;
}): Promise<string> {
  const name = input.name.trim().slice(0, 100);
  const email = input.email.trim().toLowerCase();
  if (!name) throw new InviteError("Name is required");
  if (!EMAIL_RE.test(email)) throw new InviteError("Email is invalid");

  const inv = await findUsable(input.token);
  if (!inv) throw new InviteError("This invite is invalid, expired or already used", 410);
  if (inv.email && inv.email !== email) throw new InviteError("This invite is for a different email address", 403);
  const taken = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (taken.length) throw new InviteError("A user with this email already exists — sign in instead", 409);

  const orgSlug = inv.orgId ? null : await freeOrgSlug(slugify(name));
  return db.transaction(async (tx) => {
    // Гасим приглашение первым: параллельная вторая регистрация по той же
    // ссылке упрётся в `used_at is null` и ничего не создаст.
    const claimed = await tx
      .update(schema.invites)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.invites.id, inv.id), isNull(schema.invites.usedAt)))
      .returning({ id: schema.invites.id });
    if (!claimed.length) throw new InviteError("This invite was just used", 410);
    const [user] = await tx
      .insert(schema.users)
      .values({
        email,
        name,
        passwordHash: input.passwordHash,
        githubId: input.github?.id ?? null,
        githubLogin: input.github?.login ?? null,
        avatarUrl: input.github?.avatarUrl ?? null,
      })
      .returning();
    let orgId = inv.orgId;
    if (!orgId) {
      const [org] = await tx.insert(schema.organizations).values({ slug: orgSlug!, name: `${name}'s team` }).returning();
      orgId = org.id;
    }
    await tx.insert(schema.memberships).values({ orgId, userId: user.id, role: inv.role });
    await tx.update(schema.invites).set({ usedBy: user.id }).where(eq(schema.invites.id, inv.id));
    return user.id;
  });
}
