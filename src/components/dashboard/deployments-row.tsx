"use client";

import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, EyeIcon, GitBranchIcon, GitCommitIcon, MoreHorizontalIcon, Redo02Icon } from "@hugeicons/core-free-icons";
import { fmtAgo, fmtDuration, type Deployment } from "@/lib/status";
import { cn } from "@/lib/utils";
import { environmentOf, runState, STATE_CONFIG } from "./deployments-status";

/**
 * Одна строка списка — фиксированная сетка колонок, как в таблице Vercel:
 * сообщение | статус+длительность | окружение | источник (ветка+хэш или
 * образ) | время+автор+«...». На узком экране источник и длительность
 * прячутся, остальное остаётся в одну строку.
 */
export function DeploymentRow({
  deployment: d,
  active,
  onClick,
}: {
  deployment: Deployment;
  active: boolean;
  onClick: () => void;
}) {
  const state = runState(d);
  const config = STATE_CONFIG[state];
  const env = environmentOf(d);
  const isAgentDeploy = d.source === "scalefield";
  const isRedeploy = isAgentDeploy && d.workflow === "deploy";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3.5 text-left hover:bg-muted/40 sm:grid-cols-[minmax(0,1.4fr)_6.5rem_5.5rem_9rem_9.5rem_auto]",
        active && "bg-muted/60",
      )}
    >
      <span className="col-span-2 truncate text-sm sm:col-span-1" title={d.title}>
        {d.title || (isAgentDeploy ? `${d.service ?? "service"} deploy` : "(no message)")}
      </span>

      <span className="hidden items-center gap-1.5 text-sm sm:flex">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", config.color.replace("text-", "bg-"))} />
        {config.label}
        <span className="text-xs text-muted-foreground">{fmtDuration(d.duration_s)}</span>
      </span>

      <span className="hidden sm:block">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            env === "production" ? "bg-blue-500 text-white" : "border border-border text-muted-foreground",
          )}
        >
          <HugeiconsIcon icon={env === "production" ? ArrowUp01Icon : EyeIcon} className="h-3 w-3" />
          {env === "production" ? "Production" : "Preview"}
        </span>
      </span>

      <span className="hidden items-center gap-2 truncate font-mono text-xs text-muted-foreground sm:flex">
        {isAgentDeploy ? (
          <span className="truncate" title={d.image ?? undefined}>
            {d.image}
          </span>
        ) : isRedeploy ? (
          <span className="flex items-center gap-1">
            <HugeiconsIcon icon={Redo02Icon} className="h-3 w-3" />
            {d.sha}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-0.5">
              <HugeiconsIcon icon={GitCommitIcon} className="h-3 w-3" />
              {d.sha}
            </span>
            <span className="flex items-center gap-0.5">
              <HugeiconsIcon icon={GitBranchIcon} className="h-3 w-3" />
              {d.branch}
            </span>
          </>
        )}
      </span>

      <span className="col-start-2 row-start-1 flex items-center justify-end gap-2.5 whitespace-nowrap text-xs text-muted-foreground sm:col-start-auto sm:row-start-auto sm:justify-self-end">
        {fmtAgo(d.created_at)}
        {d.actor_avatar ? (
          <Image src={d.actor_avatar} alt="" width={20} height={20} className="h-5 w-5 shrink-0 rounded-full" />
        ) : (
          <div className="h-5 w-5 shrink-0 rounded-full bg-muted" />
        )}
        <HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4 shrink-0" />
      </span>
    </button>
  );
}
