"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Loading03Icon,
  MinusSignCircleIcon,
} from "@hugeicons/core-free-icons";
import type { Deployment } from "@/lib/status";

/**
 * GitHub returns a workflow run as a pair `status` (queued | in_progress |
 * completed) + `conclusion` (success | failure | cancelled | ...). The UI
 * collapses that pair into one state so badges, filters and the summary
 * all agree on what "failed" or "in progress" means.
 */
export type RunState = "success" | "failure" | "cancelled" | "in_progress" | "queued" | "other";

export function runState(d: Deployment): RunState {
  if (d.status !== "completed") {
    return d.status === "in_progress" ? "in_progress" : "queued";
  }
  switch (d.conclusion) {
    case "success":
      return "success";
    case "failure":
    case "timed_out":
    case "startup_failure":
    case "action_required":
      return "failure";
    case "cancelled":
      return "cancelled";
    default:
      return "other";
  }
}

/** Status filter chips: "in_progress" also covers queued runs (still in work). */
export type StatusFilter = "all" | "success" | "failure" | "in_progress";

export function matchesStatusFilter(state: RunState, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "in_progress") return state === "in_progress" || state === "queued";
  return state === filter;
}

/** `owner/name` -> `name` for the list; the panel still shows the full slug. */
export function shortRepo(repo: string): string {
  const i = repo.lastIndexOf("/");
  return i === -1 ? repo : repo.slice(i + 1);
}

/**
 * Production/Preview — у нас нет отдельного окружения предпросмотра, поэтому
 * помечаем по тому, что реально происходит: деплой через агента идёт сразу в
 * прод (`agent/app/deploy.py` поднимает боевой контейнер), а у прогонов
 * GitHub Actions прод — это push в `main` (см. `.github/workflows/ci.yml`:
 * job `deploy` условие `github.ref == 'refs/heads/main'`), всё остальное —
 * предпросмотр (PR-сборка, ручной запуск на другой ветке).
 */
export type Environment = "production" | "preview";

export function environmentOf(d: Deployment): Environment {
  if (d.source === "scalefield") return "production";
  return d.branch === "main" ? "production" : "preview";
}

/**
 * Какие деплои СЕЙЧАС работают в проде — как метка Current у Vercel. По
 * каждой цели (сервис у деплоя через агента, репозиторий у GitHub Actions)
 * это самый свежий УСПЕШНЫЙ прод-деплой: упавший или ещё идущий прогон
 * в прод не попал, и живым остаётся предыдущий. Считается по всему списку,
 * а не по отфильтрованному, — фильтр не должен менять, что «в проде».
 */
export function currentProductionIds(deployments: Deployment[]): Set<string> {
  const newest = new Map<string, Deployment>();
  for (const d of deployments) {
    if (environmentOf(d) !== "production" || runState(d) !== "success") continue;
    const target = d.source === "scalefield" ? `service:${d.service ?? ""}` : `repo:${d.repo}`;
    const prev = newest.get(target);
    if (!prev || new Date(d.created_at).getTime() > new Date(prev.created_at).getTime()) newest.set(target, d);
  }
  return new Set([...newest.values()].map((d) => d.id));
}

type StateConfig = {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof CheckmarkCircle02Icon;
};

export const STATE_CONFIG: Record<RunState, StateConfig> = {
  success: {
    label: "Ready",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    icon: CheckmarkCircle02Icon,
  },
  failure: {
    label: "Error",
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    icon: AlertCircleIcon,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-gray-600",
    bgColor: "bg-gray-500/10",
    icon: MinusSignCircleIcon,
  },
  in_progress: {
    label: "Building",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    icon: Loading03Icon,
  },
  queued: {
    label: "Queued",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    icon: Clock01Icon,
  },
  other: {
    label: "Skipped",
    color: "text-gray-600",
    bgColor: "bg-gray-500/10",
    icon: MinusSignCircleIcon,
  },
};

export function DeploymentStatusBadge({ state }: { state: RunState }) {
  const config = STATE_CONFIG[state];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${config.bgColor} ${config.color}`}
    >
      <HugeiconsIcon
        icon={config.icon}
        className={`h-3 w-3 ${state === "in_progress" ? "animate-spin" : ""}`}
      />
      {config.label}
    </span>
  );
}
