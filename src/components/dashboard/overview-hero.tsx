"use client";

import Link from "next/link";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { GlobalIcon, LinkSquare02Icon, RocketIcon } from "@hugeicons/core-free-icons";
import { useProject } from "@/lib/project-context";
import { fmtAgo, useMetric, type Deployment, type DeploymentsData } from "@/lib/status";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Верхняя карточка обзора проекта — по образцу Vercel's "Production
 * Deployment": домены, статус и последний деплой видны без скролла. У нас
 * нет превью-скриншота (не строим его), поэтому вместо него — иконка сервиса.
 */
function statusOf(d: Deployment | undefined): { label: string; dot: string; text: string } {
  if (!d) return { label: "No deployments yet", dot: "bg-muted-foreground/40", text: "text-muted-foreground" };
  if (d.status !== "completed") return { label: "Deploying…", dot: "bg-amber-500 animate-pulse", text: "text-amber-600 dark:text-amber-400" };
  if (d.conclusion === "success") return { label: "Ready", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (d.conclusion === "failure") return { label: "Error", dot: "bg-destructive", text: "text-destructive" };
  return { label: d.conclusion ?? "Unknown", dot: "bg-muted-foreground/40", text: "text-muted-foreground" };
}

export function OverviewHero() {
  const { name, domains, pathBase, apiBase } = useProject();
  const { data, loading } = useMetric<DeploymentsData>(`${apiBase}/deployments`, 30_000);
  const latest = data?.items[0];
  const status = statusOf(latest);
  const visitUrl = domains[0] ? `https://${domains[0]}` : null;

  return (
    <div className="mb-8 rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", status.dot)} />
            <span className={cn("text-sm font-medium", status.text)}>{status.label}</span>
          </div>
          <h1 className="mb-2 text-xl font-semibold">{name}</h1>
          {domains.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {domains.map((d) => (
                <a key={d} href={`https://${d}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline">
                  <HugeiconsIcon icon={GlobalIcon} className="h-3.5 w-3.5" />
                  {d}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No domains attached yet — add one on a service.</p>
          )}
        </div>
        {visitUrl && (
          <a
            href={visitUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            Visit
            <HugeiconsIcon icon={LinkSquare02Icon} className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        {loading && !data ? (
          <Skeleton className="h-10 w-full" />
        ) : latest ? (
          <Link href={`${pathBase}/deployments`} className="flex items-center gap-3 rounded-lg p-2 -m-2 hover:bg-muted/50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <HugeiconsIcon icon={RocketIcon} className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{latest.title || "(no message)"}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {latest.branch && <>{latest.branch} · </>}
                {latest.sha || latest.image}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {latest.actor_avatar ? (
                <Image src={latest.actor_avatar} alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
              ) : null}
              <span>{fmtAgo(latest.created_at)}</span>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            No deployments yet —{" "}
            <Link href={`${pathBase}/services`} className="underline underline-offset-2 hover:text-foreground">
              add a service and deploy
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
