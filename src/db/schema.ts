/**
 * Схема control-plane Scalefield.
 *
 * Модель повторяет то, как устроены Vercel и Supabase, но в масштабе, который
 * нужен сейчас: организация владеет проектами; проект живёт на сервере, где
 * работает агент (коллектор метрик, он же в будущем исполнитель деплоев);
 * проект состоит из сервисов (контейнеров) с доменами, деплоев (пока —
 * прогоны GitHub Actions), баз данных и бакетов.
 *
 * Правило: секреты (токен агента, строки подключения) лежат ТОЛЬКО в полях
 * `*_enc` и шифруются `src/lib/secrets.ts`; в открытом виде в таблицах их
 * не хранить.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable("organizations", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // SSH-ключ организации: панель ставит агента на сервер по SSH («Добавить
  // сервер»), пароль root при этом не хранится — вместо него на сервер
  // кладётся этот ключ, им же делается переустановка. Генерируется при
  // первом использовании (src/lib/servers.ts).
  sshPublicKey: text("ssh_public_key"),
  sshPrivateKeyEnc: text("ssh_private_key_enc"),
  createdAt: createdAt(),
});

// Пользователи и членство. Вход — email+пароль (`password_hash`, scrypt) или
// GitHub (`github_id`); регистрация только по приглашению (`invites`).
// Доступ к проекту = членство в организации, которой он принадлежит.
// `is_platform_admin` — владелец платформы: выдаёт приглашения.
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  // Подтверждён ли email: владелец платформы, приглашение на этот адрес,
  // публичный (= подтверждённый) адрес GitHub. При открытой регистрации
  // адрес вводится руками и НЕ подтверждён — к такому аккаунту вход через
  // GitHub по совпадению email не привязывается (иначе чужой email, занятый
  // с паролем, перехватил бы вход настоящего владельца адреса).
  emailVerified: boolean("email_verified").notNull().default(false),
  githubId: text("github_id").unique(),
  githubLogin: text("github_login"),
  avatarUrl: text("avatar_url"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// Сессии входа: в cookie — случайный токен, в базе — только его sha256.
// Выход и отзыв = удаление строки (раньше cookie была детерминированной
// функцией секрета, и отозвать одну сессию было нельзя).
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

// GitHub App платформы (одна строка): создаётся владельцем по манифесту из
// /settings/github. Через неё — вход «Continue with GitHub» (client id/secret)
// и доступ к репозиториям команд (JWT приложения → токены установок). Секреты
// шифруются secrets.ts, как токены агентов.
export const githubApps = pgTable("github_apps", {
  id: id(),
  appId: text("app_id").notNull().unique(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  ownerLogin: text("owner_login"),
  htmlUrl: text("html_url"),
  clientId: text("client_id").notNull(),
  clientSecretEnc: text("client_secret_enc").notNull(),
  privateKeyEnc: text("private_key_enc").notNull(),
  webhookSecretEnc: text("webhook_secret_enc"),
  createdAt: createdAt(),
});

// Установки GitHub App, привязанные к команде: аккаунт/организация GitHub,
// чьи репозитории команда может деплоить. Привязка — только после проверки
// через токен пользователя, что установка ему действительно доступна.
export const githubInstallations = pgTable(
  "github_installations",
  {
    id: id(),
    installationId: text("installation_id").notNull(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type"), // User | Organization
    accountAvatarUrl: text("account_avatar_url"),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("github_installations_org_install").on(t.orgId, t.installationId)],
);

// Приглашения: регистрация закрыта, пока продукт сырой. Ссылка
// /signup?invite=<токен>, в базе — хеш токена. `email` задан — только на этот
// адрес; `org_id` задан — в эту команду с ролью `role`, иначе новая своя.
export const invites = pgTable("invites", {
  id: id(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email"),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: uuid("used_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // owner | admin | member
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

// Сервер = хост с Docker и агентом (agent/). Основной транспорт — обратный
// туннель: агент сам держит WebSocket к relay (relay/), входящих портов у него
// нет, поэтому сервер клиента может стоять за NAT и файрволом. Токен агента
// хранится дважды: `agentTokenEnc` (расшифровываемый — чтобы показать команду
// установки) и `agentTokenHash` (sha256 — по нему relay через
// /api/internal/relay/auth узнаёт, чей это агент). `agentUrl` — переходный
// прямой режим (control-plane в одной docker-сети с агентом); уйдёт.
export const servers = pgTable(
  "servers",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    host: text("host").notNull(), // IP или hostname для SSH/справки
    provider: text("provider"), // timeweb | digitalocean | hetzner | ...
    agentUrl: text("agent_url"),
    agentTokenEnc: text("agent_token_enc").notNull(),
    agentTokenHash: text("agent_token_hash"),
    agentVersion: text("agent_version"),
    agentHostname: text("agent_hostname"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    // Установка агента из панели по SSH: installing → ready | error;
    // лог установки хранится тут же, чтобы страница сервера показывала его
    // живьём (поллинг), как страница деплоя — лог задачи агента.
    status: text("status").notNull().default("ready"), // installing | ready | error
    sshPort: integer("ssh_port").notNull().default(22),
    sshUser: text("ssh_user").notNull().default("root"),
    installLog: text("install_log"),
    installError: text("install_error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("servers_agent_token_hash").on(t.agentTokenHash)],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    serverId: uuid("server_id").references(() => servers.id, { onDelete: "set null" }),
    // Свободные настройки проекта: какие разделы показывать, кастомные
    // метрики (например, `content` у researcher.uz) и т.п.
    settings: jsonb("settings").$type<ProjectSettings>().notNull().default({}),
    createdAt: createdAt(),
  },
  // Слаг уникален глобально, а не внутри команды: адрес проекта — `/p/<slug>`
  // без команды, и все ручки ищут проект по одному слагу. С уникальностью в
  // команде два `app` у разных команд путались бы — ручка взяла бы чужой.
  (t) => [uniqueIndex("projects_slug").on(t.slug)],
);

export type ProjectSettings = {
  /** Проект отдаёт доменные метрики контента (ручка /status/content агента). */
  contentMetrics?: boolean;
};

// Сервис = один контейнер/процесс проекта. `container` — имя контейнера на
// сервере (для логов и статуса), `repo`+`workflow` — откуда берутся деплои.
export const services = pgTable(
  "services",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("web"), // web | api | worker | database | proxy
    container: text("container"),
    repo: text("repo"), // owner/name на GitHub
    workflow: text("workflow"),
    port: integer("port"),
    // Деплой через агента: образ, команда, тома и переменные окружения
    // (зашифрованный JSON {KEY: value}).
    image: text("image"),
    command: text("command"),
    envEnc: text("env_enc"),
    volumes: jsonb("volumes").$type<string[]>().notNull().default([]),
    // Сборка из Git: ветка, Dockerfile и контекст в репозитории; webhook
    // GitHub подписывается секретом (шифрован), autoDeploy — деплоить ли по push.
    branch: text("branch"),
    dockerfile: text("dockerfile"),
    buildContext: text("build_context"),
    // Переменные, которые нужны САМОЙ сборке (Next.js инлайнит NEXT_PUBLIC_*
    // из .env.production на этапе `next build`), а не запущенному контейнеру —
    // отдельно от env_enc (рантайм). Пишутся агентом в .env.production
    // клонированного репозитория перед `docker build`.
    buildEnvEnc: text("build_env_enc"),
    autoDeploy: boolean("auto_deploy").notNull().default(false),
    webhookSecretEnc: text("webhook_secret_enc"),
    // Как деплоится сервис: image — Scalefield собирает образ и пишет свой
    // compose-сервис; script — у приложения свой стек, агент раскладывает код
    // коммита в /opt/apps/<app_dir> и запускает deploy_command (например
    // `bash scripts/deploy.sh`). `workflow` — имя CI-workflow GitHub: если
    // задано, автодеплой ждёт его успеха (workflow_run), а не push.
    deployMode: text("deploy_mode").notNull().default("image"), // image | script
    appDir: text("app_dir"),
    deployCommand: text("deploy_command"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("services_project_name").on(t.projectId, t.name)],
);

export const domains = pgTable("domains", {
  id: id(),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  hostname: text("hostname").notNull().unique(),
  tls: text("tls").notNull().default("letsencrypt"), // letsencrypt | custom | none
  createdAt: createdAt(),
});

// Деплой. Сейчас источник — прогоны GitHub Actions (source = github_actions,
// externalId = id прогона), которые /api/projects/<slug>/deployments
// синхронизирует в таблицу; когда появится собственный билдер, он будет
// писать сюда же с source = scalefield.
export const deployments = pgTable(
  "deployments",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    repo: text("repo"),
    workflow: text("workflow"),
    branch: text("branch"),
    sha: text("sha"),
    title: text("title"),
    event: text("event"),
    status: text("status").notNull(), // queued | in_progress | completed
    conclusion: text("conclusion"), // success | failure | cancelled | ...
    actor: text("actor"),
    actorAvatar: text("actor_avatar"),
    url: text("url"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    durationS: integer("duration_s"),
    // Вывод `docker compose up` для деплоев через агента (source = scalefield).
    log: text("log"),
    // Образ, который деплоился — для отката на предыдущий.
    image: text("image"),
  },
  (t) => [uniqueIndex("deployments_source_external").on(t.source, t.externalId)],
);

// Управляемая база проекта. Пока это регистрация уже существующего Postgres
// (для метрик и будущего SQL-редактора); провижининг новых баз — следующая
// фаза. Строка подключения зашифрована.
export const databases = pgTable("databases", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  serverId: uuid("server_id").references(() => servers.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  engine: text("engine").notNull().default("postgres"),
  container: text("container"),
  urlEnc: text("url_enc"),
  createdAt: createdAt(),
});

// Объектное хранилище проекта: бакет R2/S3 (у researcher.uz — researcher-files
// и researcher-backup). Ключи доступа — в `credentialsEnc`.
export const buckets = pgTable("buckets", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("r2"), // r2 | s3 | minio
  name: text("name").notNull(),
  endpoint: text("endpoint"),
  publicUrl: text("public_url"),
  purpose: text("purpose"), // files | backups | ...
  credentialsEnc: text("credentials_enc"),
  createdAt: createdAt(),
});

// События просмотра страницы от клиентского трекера (`<Analytics />`,
// см. scalefield-analytics.tsx) — POST /api/collect с сайта проекта. В
// отличие от разбора access-лога прокси (agent/status/visitors), ловит
// клиентские SPA-переходы и не требует доступа к логам прокси вообще:
// проект просто ставит компонент в layout. `visitorHash` — не IP, а его
// необратимый хеш (соль + IP + UA + сутки), чтобы считать уникальных
// посетителей, не храня ничего похожего на личные данные.
export const pageViews = pgTable(
  "page_views",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    referrer: text("referrer"),
    visitorHash: text("visitor_hash").notNull(),
    device: text("device"),
    browser: text("browser"),
    os: text("os"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("page_views_project_created").on(t.projectId, t.createdAt)],
);

export type Organization = typeof organizations.$inferSelect;
export type Server = typeof servers.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type DeploymentRow = typeof deployments.$inferSelect;
export type Database = typeof databases.$inferSelect;
export type Bucket = typeof buckets.$inferSelect;
export type PageView = typeof pageViews.$inferSelect;
