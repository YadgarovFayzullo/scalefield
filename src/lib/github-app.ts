import "server-only";
import { createHmac, createSign, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

/**
 * GitHub App платформы — как у Vercel: одно приложение на всю платформу.
 *  - Вход «Continue with GitHub» — OAuth приложения (client id/secret).
 *  - Доступ к репозиториям — установки приложения на аккаунты/организации
 *    GitHub, привязанные к команде (`github_installations`); токен установки
 *    живёт час и выдаётся по JWT приложения (RS256 его приватным ключом).
 *  - Один webhook приложения на все установки (push → автодеплой).
 * Создаётся владельцем платформы по манифесту (`manifestFor` → GitHub →
 * `saveFromManifest`), ключи в базе шифрованы.
 */
export type GithubAppRow = typeof schema.githubApps.$inferSelect;

const API = "https://api.github.com";
const HEADERS = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Scalefield" };

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3002").replace(/\/+$/, "");
}

export async function getGithubApp(): Promise<GithubAppRow | null> {
  const rows = await db.select().from(schema.githubApps).limit(1);
  return rows[0] ?? null;
}

// ---------- манифест ----------

/** Манифест приложения: права — ровно то, что нужно деплою, не больше. */
export function manifestFor(name: string) {
  const base = appUrl();
  const publicUrl = base.startsWith("https://");
  return {
    name,
    url: base,
    description: "Deploy and run your projects on your own servers.",
    // Webhook с localhost GitHub не доставит — в dev он выключен.
    hook_attributes: { url: `${base}/api/github/webhook`, active: publicUrl },
    redirect_url: `${base}/api/github/manifest/callback`,
    callback_urls: [`${base}/api/auth/github/callback`],
    // После установки GitHub ведёт пользователя через OAuth на callback с
    // installation_id — так установку можно проверить токеном пользователя.
    request_oauth_on_install: true,
    setup_on_update: true,
    public: true,
    default_permissions: {
      metadata: "read",
      contents: "read", // клонировать репозиторий для сборки
      actions: "read", // прогоны GitHub Actions → Deployments
      // email_addresses сюда НЕЛЬЗЯ: это право аккаунта, манифест принимает
      // только права на репозитории/организации — GitHub отвечает «Default
      // permission records resource is not included in the list». Его можно
      // включить руками в настройках приложения (Account permissions →
      // Email addresses: Read), тогда вход сверяет и приватный email.
    },
    default_events: ["push", "workflow_run"],
  };
}

export async function saveFromManifest(code: string): Promise<GithubAppRow> {
  const res = await fetch(`${API}/app-manifests/${encodeURIComponent(code)}/conversions`, { method: "POST", headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub rejected the manifest code (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as {
    id: number;
    slug: string;
    name: string;
    owner?: { login?: string };
    html_url?: string;
    client_id: string;
    client_secret: string;
    webhook_secret?: string | null;
    pem: string;
  };
  await db.delete(schema.githubApps);
  const [row] = await db
    .insert(schema.githubApps)
    .values({
      appId: String(j.id),
      slug: j.slug,
      name: j.name,
      ownerLogin: j.owner?.login ?? null,
      htmlUrl: j.html_url ?? null,
      clientId: j.client_id,
      clientSecretEnc: encryptSecret(j.client_secret),
      privateKeyEnc: encryptSecret(j.pem),
      webhookSecretEnc: j.webhook_secret ? encryptSecret(j.webhook_secret) : null,
    })
    .returning();
  return row;
}

// ---------- JWT приложения и токены установок ----------

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function appJwt(app: GithubAppRow): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  // iat на минуту назад — на случай расхождения часов с GitHub; exp ≤ 10 мин.
  const body = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: app.appId }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${b64url(signer.sign(decryptSecret(app.privateKeyEnc)))}`;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function installationToken(installationId: string): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) return cached.token;
  const app = await getGithubApp();
  if (!app) throw new Error("GitHub App is not set up");
  const res = await fetch(`${API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { ...HEADERS, Authorization: `Bearer ${appJwt(app)}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub installation ${installationId}: ${res.status}`);
  const j = (await res.json()) as { token: string; expires_at: string };
  tokenCache.set(installationId, { token: j.token, expiresAt: new Date(j.expires_at).getTime() });
  return j.token;
}

/**
 * Токен для репозитория `owner/name` проекта команды `orgId`: установка
 * приложения на аккаунт `owner`, привязанная к этой команде; иначе —
 * переходный GITHUB_TOKEN из env; иначе null (публичный репозиторий без
 * токена). Чужие установки не используются: репозиторий, к которому у
 * команды нет установки, для неё приватный.
 */
export async function tokenForRepo(orgId: string, repo: string): Promise<string | null> {
  const owner = repo.includes("://") ? null : repo.split("/")[0];
  if (owner) {
    const rows = await db
      .select({ installationId: schema.githubInstallations.installationId })
      .from(schema.githubInstallations)
      .where(and(eq(schema.githubInstallations.orgId, orgId), sql`lower(${schema.githubInstallations.accountLogin}) = ${owner.toLowerCase()}`))
      .limit(1);
    if (rows[0]) {
      try {
        return await installationToken(rows[0].installationId);
      } catch {
        /* установка удалена на стороне GitHub — пробуем запасной путь */
      }
    }
  }
  return process.env.GITHUB_TOKEN || null;
}

export async function listInstallations(orgIds: string[]) {
  if (orgIds.length === 0) return [];
  return db.select().from(schema.githubInstallations).where(inArray(schema.githubInstallations.orgId, orgIds));
}

// ---------- OAuth пользователя ----------

export async function exchangeUserCode(app: GithubAppRow, code: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: app.clientId, client_secret: decryptSecret(app.clientSecretEnc), code }),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!j.access_token) throw new Error(j.error_description || "GitHub did not return a token");
  return j.access_token;
}

export type GithubUser = { id: string; login: string; name: string | null; avatarUrl: string | null; email: string | null };

/** Пользователь GitHub + его ПОДТВЕРЖДЁННЫЙ основной email (неподтверждённый не годится для привязки). */
export async function fetchGithubUser(userToken: string): Promise<GithubUser> {
  const h = { ...HEADERS, Authorization: `Bearer ${userToken}` };
  const u = await fetch(`${API}/user`, { headers: h, cache: "no-store" });
  if (!u.ok) throw new Error(`GitHub /user: ${u.status}`);
  const user = (await u.json()) as { id: number; login: string; name?: string | null; avatar_url?: string | null; email?: string | null };
  // Приватные адреса — только с правом Email addresses (включается в
  // настройках приложения); без него /user/emails отвечает 403, и берём
  // публичный email профиля: GitHub позволяет сделать публичным только
  // подтверждённый адрес.
  let email: string | null = user.email ? user.email.toLowerCase() : null;
  const e = await fetch(`${API}/user/emails`, { headers: h, cache: "no-store" });
  if (e.ok) {
    const list = (await e.json()) as { email: string; primary: boolean; verified: boolean }[];
    email = list.find((x) => x.primary && x.verified)?.email?.toLowerCase() ?? email;
  }
  return { id: String(user.id), login: user.login, name: user.name ?? null, avatarUrl: user.avatar_url ?? null, email };
}

export type UserInstallation = { id: string; login: string; type: string | null; avatarUrl: string | null };

/** Установки приложения, доступные этому пользователю GitHub. */
export async function userInstallations(userToken: string): Promise<UserInstallation[]> {
  const res = await fetch(`${API}/user/installations?per_page=100`, { headers: { ...HEADERS, Authorization: `Bearer ${userToken}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub /user/installations: ${res.status}`);
  const j = (await res.json()) as { installations: { id: number; account: { login: string; type?: string; avatar_url?: string } }[] };
  return j.installations.map((i) => ({ id: String(i.id), login: i.account.login, type: i.account.type ?? null, avatarUrl: i.account.avatar_url ?? null }));
}

// ---------- webhook ----------

export async function verifyWebhook(raw: string, signature: string | null): Promise<boolean> {
  const app = await getGithubApp();
  if (!app?.webhookSecretEnc || !signature) return false;
  const expected = "sha256=" + createHmac("sha256", decryptSecret(app.webhookSecretEnc)).update(raw).digest("hex");
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
