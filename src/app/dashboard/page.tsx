import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { GlobalIcon, Layers01Icon, ServerStack01Icon, Time01Icon } from "@hugeicons/core-free-icons";
import { listProjects } from "@/lib/projects";
import { latestDeployments, deploymentToItem } from "@/lib/services";
import { listServersUsage } from "@/lib/servers-usage";
import { UsageCard } from "@/components/dashboard/usage-card";
import type { Domain } from "@/db/schema";
import { PanelHeader } from "@/components/panel-header";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { fmtAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const AVATAR_COLORS = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
];

function avatarColor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function primaryDomain(services: { domains: Domain[] }[]): string | null {
  for (const s of services) if (s.domains.length > 0) return s.domains[0].hostname;
  return null;
}

/**
 * Список проектов — точка входа после логина, по образцу Vercel/Supabase:
 * карточка на проект с доменом и последним деплоем, а не голая таблица.
 */
export default async function ProjectsPage() {
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let latest: Awaited<ReturnType<typeof latestDeployments>> = new Map();
  let servers: Awaited<ReturnType<typeof listServersUsage>> = [];
  let error: string | null = null;
  const user = await currentUser();
  if (!user) redirect("/login");
  try {
    projects = await listProjects(user.orgIds);
    [latest, servers] = await Promise.all([latestDeployments(projects.map((p) => p.id)), listServersUsage(user.orgIds)]);
  } catch (e) {
    error = String(e);
  }

  return (
    <div className="min-h-screen bg-background">
      <PanelHeader active="/dashboard" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Projects</h1>
            <p className="text-sm text-muted-foreground">Everything Scalefield runs and watches for you.</p>
          </div>
          <Link href="/new" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
            New project
          </Link>
        </div>
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            Control-plane database is unreachable: <span className="font-mono">{error}</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
            No projects yet. <Link href="/new" className="underline underline-offset-4">Import a Git repository</Link> — or first add a server on the <Link href="/servers" className="underline underline-offset-4">Servers</Link> page.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="lg:sticky lg:top-6 lg:self-start">
              <UsageCard servers={servers} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((p) => {
              const domain = primaryDomain(p.services);
              const deploy = latest.get(p.id);
              const item = deploy ? deploymentToItem(deploy, null) : null;
              const dot =
                !item ? "bg-muted-foreground/40" : item.conclusion === "success" ? "bg-emerald-500" : item.conclusion === "failure" ? "bg-destructive" : "bg-amber-500 animate-pulse";
              return (
                <Link key={p.id} href={`/p/${p.slug}`} className="group">
                  <div className="h-full rounded-xl border border-border p-4 transition-colors group-hover:border-foreground/30 group-hover:bg-muted/30">
                    <div className="mb-3 flex items-center gap-3">
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold", avatarColor(p.slug))}>
                        {p.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{p.name}</span>
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} title={item?.conclusion ?? "no deploys yet"} />
                        </div>
                        {domain ? (
                          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <HugeiconsIcon icon={GlobalIcon} className="h-3 w-3 shrink-0" />
                            {domain}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{p.slug}</span>
                        )}
                      </div>
                    </div>
                    {item ? (
                      <p className="mb-3 truncate text-sm text-muted-foreground" title={item.title}>
                        {item.title || "(no message)"}
                      </p>
                    ) : (
                      <p className="mb-3 text-sm text-muted-foreground">No deployments yet</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <HugeiconsIcon icon={ServerStack01Icon} className="h-3.5 w-3.5" />
                        {p.server ? p.server.name : "no server"}
                      </span>
                      <span className="flex items-center gap-1">
                        <HugeiconsIcon icon={Layers01Icon} className="h-3.5 w-3.5" />
                        {p.services.length} service{p.services.length === 1 ? "" : "s"}
                      </span>
                      {item && (
                        <span className="flex items-center gap-1">
                          <HugeiconsIcon icon={Time01Icon} className="h-3.5 w-3.5" />
                          {fmtAgo(item.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
