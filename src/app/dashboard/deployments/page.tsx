"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { fmtAgo, fmtDuration, useMetric, type Deployment, type DeploymentsData } from "@/lib/status";
import {
  DeploymentStatusBadge,
  matchesStatusFilter,
  runState,
  shortRepo,
  type StatusFilter,
} from "@/components/dashboard/deployments-status";
import { DeploymentDetailPanel } from "@/components/dashboard/deployments-detail-panel";

/**
 * Deployments Page
 *
 * Source: GitHub Actions runs of the platform repos (frontend, backend, this
 * panel) via `/api/deployments`, polled every 30 s. Workflow: monitor runs →
 * spot failures → open the run in GitHub for logs / re-run.
 */

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "failure", label: "Failed" },
  { value: "in_progress", label: "In Progress" },
];

type Summary = {
  total: number;
  success: number;
  failure: number;
  inProgress: number;
  avgSuccessDuration: number | null;
};

function summarize(items: Deployment[]): Summary {
  let success = 0;
  let failure = 0;
  let inProgress = 0;
  let durationSum = 0;
  let durationCount = 0;
  for (const d of items) {
    const state = runState(d);
    if (state === "success") {
      success++;
      if (d.duration_s != null) {
        durationSum += d.duration_s;
        durationCount++;
      }
    } else if (state === "failure") {
      failure++;
    } else if (state === "in_progress" || state === "queued") {
      inProgress++;
    }
  }
  return {
    total: items.length,
    success,
    failure,
    inProgress,
    avgSuccessDuration: durationCount > 0 ? durationSum / durationCount : null,
  };
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-sm rounded-md transition-colors cursor-pointer ${
        active ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-4 py-3 border border-border rounded-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function SummaryRow({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <StatCard label="Total runs" value={String(summary.total)} />
      <StatCard label="Successful" value={String(summary.success)} tone="text-green-600" />
      <StatCard label="Failed" value={String(summary.failure)} tone={summary.failure > 0 ? "text-red-600" : undefined} />
      <StatCard label="In progress" value={String(summary.inProgress)} tone={summary.inProgress > 0 ? "text-blue-600" : undefined} />
      <StatCard label="Avg. duration (success)" value={fmtDuration(summary.avgSuccessDuration)} />
    </div>
  );
}

function DeploymentRow({
  deployment,
  selected,
  onClick,
}: {
  deployment: Deployment;
  selected: boolean;
  onClick: () => void;
}) {
  const state = runState(deployment);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border border-border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer ${
        selected ? "bg-muted/50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-medium">{shortRepo(deployment.repo)}</span>
            <span className="text-xs text-muted-foreground">{deployment.workflow}</span>
            <DeploymentStatusBadge state={state} />
          </div>
          <p className="text-sm text-muted-foreground mb-1 truncate">{deployment.title}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="font-mono">{deployment.branch}</span>
            <span>•</span>
            <span className="font-mono">{deployment.sha}</span>
            <span>•</span>
            <span>{fmtDuration(deployment.duration_s)}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1.5">
              {deployment.actor_avatar ? (
                <Image
                  src={deployment.actor_avatar}
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 rounded-full"
                />
              ) : null}
              {deployment.actor || "unknown"}
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {fmtAgo(deployment.created_at)}
        </div>
      </div>
    </button>
  );
}

function ListSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[66px] rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[86px] rounded-lg" />
        ))}
      </div>
    </>
  );
}

export default function DeploymentsPage() {
  const { data, error, loading, updatedAt, refresh } = useMetric<DeploymentsData>(
    "/api/deployments",
    30000,
  );
  const [selectedDeployment, setSelectedDeployment] = React.useState<string | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<StatusFilter>("all");
  const [filterRepo, setFilterRepo] = React.useState<string>("all");
  const [isPanelVisible, setIsPanelVisible] = React.useState(false);
  const [displayedDeployment, setDisplayedDeployment] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (selectedDeployment) {
      setDisplayedDeployment(selectedDeployment);
      const t = setTimeout(() => setIsPanelVisible(true), 10);
      return () => clearTimeout(t);
    }
    setIsPanelVisible(false);
    const t = setTimeout(() => setDisplayedDeployment(null), 300);
    return () => clearTimeout(t);
  }, [selectedDeployment]);

  const items = React.useMemo(() => data?.items ?? [], [data]);

  const repos = React.useMemo(() => {
    const set = new Set<string>();
    for (const d of items) set.add(d.repo);
    return Array.from(set).sort();
  }, [items]);

  const filteredDeployments = React.useMemo(
    () =>
      items.filter(
        (d) =>
          matchesStatusFilter(runState(d), filterStatus) &&
          (filterRepo === "all" || d.repo === filterRepo),
      ),
    [items, filterStatus, filterRepo],
  );

  const summary = React.useMemo(() => summarize(items), [items]);

  const selected = items.find((d) => d.id === displayedDeployment);

  const showSkeleton = loading && !data;
  const showError = !!error && !data;

  return (
    <div className="relative flex flex-col md:flex-row h-[calc(100vh-57px)]">
      {/* Main deployment list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Deployments</h1>
              <p className="text-sm text-muted-foreground">
                {showSkeleton
                  ? "Loading GitHub Actions runs…"
                  : `${filteredDeployments.length} of ${items.length} runs${
                      updatedAt ? ` · updated ${fmtAgo(updatedAt)}` : ""
                    }`}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={refresh} disabled={loading && !data}>
              <HugeiconsIcon icon={RefreshIcon} className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Non-blocking warnings: poll failure with stale data, per-repo errors */}
          {error && data ? (
            <Warning>Refresh failed: {error}. Showing the last successful response.</Warning>
          ) : null}
          {data?.errors.map((e) => (
            <Warning key={e}>{e}</Warning>
          ))}

          {showSkeleton ? (
            <ListSkeleton />
          ) : showError ? (
            <div className="px-4 py-6 border border-red-500/30 bg-red-500/5 rounded-lg text-sm">
              <p className="font-medium text-red-600 mb-1">Failed to load deployments</p>
              <p className="text-muted-foreground mb-3">{error}</p>
              <Button size="sm" variant="outline" onClick={refresh}>
                Try again
              </Button>
            </div>
          ) : data && !data.configured ? (
            <div className="px-4 py-6 border border-border rounded-lg text-sm">
              <p className="font-medium mb-1">Deployments are not configured</p>
              <p className="text-muted-foreground">
                Set <code className="font-mono">GITHUB_REPOS</code> (comma-separated{" "}
                <code className="font-mono">owner/name</code>) and{" "}
                <code className="font-mono">GITHUB_TOKEN</code> (actions:read) in the panel
                environment to show GitHub Actions runs here.
              </p>
            </div>
          ) : (
            <>
              <SummaryRow summary={summary} />

              {/* Filters - simple, functional */}
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border flex-wrap">
                {STATUS_FILTERS.map((f) => (
                  <FilterChip
                    key={f.value}
                    active={filterStatus === f.value}
                    onClick={() => setFilterStatus(f.value)}
                  >
                    {f.label}
                  </FilterChip>
                ))}
                {repos.length > 1 ? (
                  <>
                    <span className="mx-1 h-4 w-px bg-border" aria-hidden />
                    <FilterChip active={filterRepo === "all"} onClick={() => setFilterRepo("all")}>
                      All repos
                    </FilterChip>
                    {repos.map((r) => (
                      <FilterChip key={r} active={filterRepo === r} onClick={() => setFilterRepo(r)}>
                        {shortRepo(r)}
                      </FilterChip>
                    ))}
                  </>
                ) : null}
              </div>

              {/* Deployment list - vertical flow */}
              {filteredDeployments.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-8 text-center">
                  {items.length === 0 ? "No workflow runs returned by GitHub." : "No runs match the current filters."}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredDeployments.map((deployment) => (
                    <DeploymentRow
                      key={deployment.id}
                      deployment={deployment}
                      selected={selectedDeployment === deployment.id}
                      onClick={() =>
                        setSelectedDeployment(
                          selectedDeployment === deployment.id ? null : deployment.id,
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selected && (
        <DeploymentDetailPanel
          deployment={selected}
          visible={isPanelVisible}
          onClose={() => setSelectedDeployment(null)}
        />
      )}
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 mb-4 px-4 py-3 border border-amber-500/30 bg-amber-500/5 rounded-lg text-sm text-amber-700">
      <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4 mt-0.5 shrink-0" />
      <span className="break-words min-w-0">{children}</span>
    </div>
  );
}
