import { redirect } from "next/navigation";
import { PanelHeader } from "@/components/panel-header";
import { CreateGithubApp, DisconnectInstallation, ShareInstallation } from "@/components/dashboard/github-settings";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/auth";
import { appUrl, getGithubApp, listInstallations, syncAppInfo } from "@/lib/github-app";

export const dynamic = "force-dynamic";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="font-medium">{title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

const linkBtn =
  "inline-flex h-9 items-center justify-center rounded-md border border-border bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90";

/**
 * Settings → GitHub (как Git-интеграция у Vercel): GitHub App платформы
 * (создаёт владелец платформы), привязка GitHub к своему аккаунту и
 * аккаунты/организации GitHub, чьи репозитории команда может деплоить.
 */
export default async function GithubSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const [stored, installs] = await Promise.all([getGithubApp(), listInstallations(user.orgIds)]);
  // Переименование на GitHub меняет slug — подтягиваем актуальный.
  const app = stored ? await syncAppInfo(stored) : null;
  const orgRows = user.orgIds.length
    ? await db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations).where(inArray(schema.organizations.id, user.orgIds))
    : [];
  // Команды в порядке memberships (рабочая — с проектами — первой).
  const teams = user.memberships
    .map((m) => ({ id: m.orgId, name: orgRows.find((o) => o.id === m.orgId)?.name ?? "Team", canManage: m.role === "owner" || m.role === "admin" }))
    .filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i);

  const notice = sp.error
    ? { tone: "bad", text: sp.error }
    : sp.created
      ? { tone: "ok", text: `GitHub App “${sp.created}” created. Now install it on the accounts whose repos you deploy.` }
      : sp.connected
        ? { tone: "ok", text: Number(sp.connected) > 0 ? "GitHub connected to your team." : "Nothing new to connect." }
        : sp.linked
          ? { tone: "ok", text: `Signed in with GitHub @${sp.linked} from now on.` }
          : null;

  return (
    <div className="min-h-screen bg-background">
      <PanelHeader active="/settings" />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold">GitHub</h1>
          <p className="text-sm text-muted-foreground">Sign in with GitHub and deploy from your repositories — no personal tokens.</p>
        </div>

        {notice && (
          <div
            className={
              notice.tone === "bad"
                ? "rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                : "rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm"
            }
          >
            {notice.text}
          </div>
        )}

        <Section title="GitHub App" description="One app for the whole platform: sign-in, repository access and push webhooks.">
          {app ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{app.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  github.com/apps/{app.slug} · webhook {appUrl()}/api/github/webhook
                </p>
              </div>
              {user.isPlatformAdmin && app.htmlUrl && (
                <a href={app.htmlUrl} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">
                  Manage on GitHub
                </a>
              )}
            </div>
          ) : user.isPlatformAdmin ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                GitHub shows a pre-filled form — review it and click <span className="font-medium">Create GitHub App</span>. Keys are stored
                encrypted.
              </p>
              <CreateGithubApp />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not set up yet — the platform owner has to create it.</p>
          )}
        </Section>

        <Section title="Your GitHub account" description="Link it to sign in with GitHub instead of a password.">
          {user.githubLogin ? (
            <p className="text-sm">
              Linked to <span className="font-medium">@{user.githubLogin}</span>.
            </p>
          ) : app ? (
            <a href="/api/auth/github/start?mode=link" className={linkBtn}>
              Link GitHub account
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Available once the GitHub App is created.</p>
          )}
        </Section>

        {teams.map((team) => {
          const own = installs.filter((i) => i.orgId === team.id);
          const ownIds = new Set(own.map((i) => i.installationId));
          // Установки, которые вы подключили в других своих командах, — можно взять и сюда.
          const reusable = installs.filter((i) => i.orgId !== team.id && i.addedBy === user.id && !ownIds.has(i.installationId));
          const seen = new Set<string>();
          const reuse = reusable.filter((i) => (seen.has(i.installationId) ? false : (seen.add(i.installationId), true)));
          return (
            <Section
              key={team.id}
              title={teams.length > 1 ? `Repositories · ${team.name}` : "Repositories"}
              description="GitHub accounts and organizations whose repositories this team can deploy. Private repos, Actions runs and push-to-deploy work through them."
            >
              {own.length > 0 && (
                <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
                  {own.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-3">
                        {i.accountAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.accountAvatarUrl} alt="" className="h-7 w-7 rounded-full" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-muted" />
                        )}
                        <div>
                          <p className="text-sm font-medium">@{i.accountLogin}</p>
                          <p className="text-xs text-muted-foreground">{i.accountType === "Organization" ? "Organization" : "Personal account"}</p>
                        </div>
                      </div>
                      {team.canManage && <DisconnectInstallation id={i.id} login={i.accountLogin} />}
                    </li>
                  ))}
                </ul>
              )}
              {!app ? (
                <p className="text-sm text-muted-foreground">Available once the GitHub App is created.</p>
              ) : team.canManage ? (
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/api/auth/github/start?mode=install&org=${team.id}`} className={linkBtn}>
                    {own.length ? "Add or configure GitHub account" : "Install GitHub App"}
                  </a>
                  {reuse.map((i) => (
                    <ShareInstallation key={i.id} sourceId={i.id} orgId={team.id} login={i.accountLogin} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Only team owners and admins can connect GitHub.</p>
              )}
            </Section>
          );
        })}
      </main>
    </div>
  );
}
