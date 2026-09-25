"use client";

import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon, EyeIcon, GitBranchIcon, GitCommitIcon, MoreHorizontalIcon, Redo02Icon } from "@hugeicons/core-free-icons";
import { fmtAgo, fmtDuration, type Deployment } from "@/lib/status";
import { cn } from "@/lib/utils";
import { environmentOf, runState, STATE_CONFIG } from "./deployments-status";

// Насыщенные цвета точки статуса — как в Vercel (мягкий красный/мятный, не Tailwind's text-*-600).
const DOT_COLOR: Record<string, string> = {
  success: "bg-emerald-400",
  failure: "bg-red-500",
  cancelled: "bg-muted-foreground/50",
  in_progress: "bg-blue-500",
  queued: "bg-amber-500",
  other: "bg-muted-foreground/50",
};

/**
 * Одна строка списка — настоящая табличная сетка с ФИКСИРОВАННОЙ шириной
 * колонок (не по содержимому), поэтому статус/пилюля/хэш начинаются в одном
 * месте на каждой строке независимо от длины сообщения коммита — как в
 * таблице Vercel. Последняя колонка резиновая и прижимает время/аватар/«...»
 * к правому краю.
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
        "grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3.5 text-left hover:bg-muted/40 sm:grid-cols-[minmax(10rem,26rem)_8.5rem_8rem_11rem_1fr]",
        active && "bg-muted/60",
      )}
    >
      <span className="col-span-2 min-w-0 truncate text-sm sm:col-span-1" title={d.title}>
        {d.title || (isAgentDeploy ? `${d.service ?? "service"} deploy` : "(no message)")}
      </span>

      <span className="hidden items-center gap-2 sm:flex">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT_COLOR[state])} />
        <span className="text-sm">{config.label}</span>
        <span className="text-sm text-muted-foreground">{fmtDuration(d.duration_s)}</span>
      </span>

      {env === "production" ? (
        <span className="hidden w-fit shrink-0 items-center gap-1.5 rounded-full bg-blue-500 py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-white sm:inline-flex">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white">
            <HugeiconsIcon icon={ArrowUp02Icon} className="h-2.5 w-2.5 text-blue-500" />
          </span>
          Production
        </span>
      ) : (
        <span className="hidden w-fit shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
          <HugeiconsIcon icon={EyeIcon} className="h-3 w-3" />
          Preview
        </span>
      )}

      <span className="hidden items-center gap-2 truncate font-mono text-xs text-muted-foreground md:flex">
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
        <HugeiconsIcon icon={MoreHorizontalIcon} className="hidden h-4 w-4 shrink-0 sm:block" />
      </span>
    </button>
  );
}
