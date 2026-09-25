"use client";

import * as React from "react";
import { useProject } from "@/lib/project-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, FilterIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmtAgo, useMetric, type Deployment, type DeploymentsData } from "@/lib/status";
import { environmentOf, runState, shortRepo, STATE_CONFIG, type Environment, type RunState } from "@/components/dashboard/deployments-status";
import { DeploymentRow } from "@/components/dashboard/deployments-row";
import { DeploymentDetailPanel } from "@/components/dashboard/deployments-detail-panel";

/**
 * Deployments — плотный список строк с фильтрами-пилюлями, по образцу
 * Vercel: "Add Filter" добавляет размерность (Status/Environment/Author/
 * Repository), активная пилюля кликается для смены значения или снимается
 * крестиком. Детали открываются в боковой панели справа.
 */

const PAGE_SIZE = 20;

type FilterKind = "status" | "environment" | "author" | "repo";
const FILTER_LABELS: Record<FilterKind, string> = {
  status: "Status",
  environment: "Environment",
  author: "Author",
  repo: "Repository",
};
const STATUS_VALUES: RunState[] = ["failure", "success", "in_progress"];
const ENV_VALUES: Environment[] = ["production", "preview"];

function FilterChip({
  kind,
  value,
  options,
  optionLabel,
  onChange,
  onClear,
}: {
  kind: FilterKind;
  value: string;
  options: string[];
  optionLabel: (v: string) => string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border py-1 pl-3 pr-1.5 text-xs">
      <span className="text-muted-foreground">{FILTER_LABELS[kind]}</span>
      <select
        aria-label={FILTER_LABELS[kind]}
        className="cursor-pointer border-0 bg-transparent pr-1 font-medium outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
      <button type="button" onClick={onClear} aria-label={`Remove ${FILTER_LABELS[kind]} filter`} className="cursor-pointer rounded-full px-1 text-muted-foreground hover:text-foreground">
        ✕
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="border-b border-border px-4 py-3">
          <Skeleton className="mb-2 h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export default function DeploymentsPage() {
  const { apiBase } = useProject();
  const { data, error, loading, updatedAt, refresh } = useMetric<DeploymentsData>(`${apiBase}/deployments`, 30000);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [isPanelVisible, setIsPanelVisible] = React.useState(false);
  const [displayedId, setDisplayedId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<Partial<Record<FilterKind, string>>>({});
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  React.useEffect(() => {
    if (selectedId) {
      setDisplayedId(selectedId);
      const t = setTimeout(() => setIsPanelVisible(true), 10);
      return () => clearTimeout(t);
    }
    setIsPanelVisible(false);
    const t = setTimeout(() => setDisplayedId(null), 300);
    return () => clearTimeout(t);
  }, [selectedId]);

  const items = React.useMemo(() => data?.items ?? [], [data]);
  const repos = React.useMemo(() => Array.from(new Set(items.map((d) => d.repo).filter(Boolean))).sort(), [items]);
  const authors = React.useMemo(() => Array.from(new Set(items.map((d) => d.actor).filter(Boolean))).sort(), [items]);

  const allKinds: FilterKind[] = React.useMemo(() => {
    const kinds: FilterKind[] = ["status", "environment"];
    if (authors.length > 1) kinds.push("author");
    if (repos.length > 1) kinds.push("repo");
    return kinds;
  }, [authors.length, repos.length]);
  const availableKinds = allKinds.filter((k) => !(k in filters));

  const filtered = React.useMemo(
    () =>
      items.filter((d) => {
        if (filters.status && runState(d) !== filters.status) return false;
        if (filters.environment && environmentOf(d) !== filters.environment) return false;
        if (filters.author && d.actor !== filters.author) return false;
        if (filters.repo && d.repo !== filters.repo) return false;
        return true;
      }),
    [items, filters],
  );

  React.useEffect(() => setVisibleCount(PAGE_SIZE), [filters]);
  const visible = filtered.slice(0, visibleCount);

  const addFilter = (kind: FilterKind) => {
    const first = kind === "status" ? STATUS_VALUES[0] : kind === "environment" ? ENV_VALUES[0] : kind === "author" ? authors[0] : repos[0];
    if (first) setFilters((f) => ({ ...f, [kind]: first }));
  };
  const clearFilter = (kind: FilterKind) =>
    setFilters((f) => {
      const next = { ...f };
      delete next[kind];
      return next;
    });

  const selected: Deployment | undefined = items.find((d) => d.id === displayedId);
  const showSkeleton = loading && !data;
  const showError = !!error && !data;

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="text-2xl font-semibold">Deployments</h1>
          <p className="text-sm text-muted-foreground">
            {showSkeleton ? "Loading…" : `${filtered.length} of ${items.length} runs${updatedAt ? ` · updated ${fmtAgo(updatedAt)}` : ""}`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading && !data}>
          <HugeiconsIcon icon={RefreshIcon} className={loading ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>

      {data && data.configured !== false && !showSkeleton && !showError && (
        <div className="flex flex-wrap items-center gap-2 px-6 pb-4">
          {availableKinds.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                <HugeiconsIcon icon={FilterIcon} className="h-3.5 w-3.5" />
                Add Filter
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {availableKinds.map((k) => (
                  <DropdownMenuItem key={k} onClick={() => addFilter(k)}>
                    {FILTER_LABELS[k]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {filters.status && (
            <FilterChip kind="status" value={filters.status} options={STATUS_VALUES} optionLabel={(v) => STATE_CONFIG[v as RunState].label} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} onClear={() => clearFilter("status")} />
          )}
          {filters.environment && (
            <FilterChip kind="environment" value={filters.environment} options={ENV_VALUES} optionLabel={(v) => (v === "production" ? "Production" : "Preview")} onChange={(v) => setFilters((f) => ({ ...f, environment: v }))} onClear={() => clearFilter("environment")} />
          )}
          {filters.author && (
            <FilterChip kind="author" value={filters.author} options={authors as string[]} optionLabel={(v) => v} onChange={(v) => setFilters((f) => ({ ...f, author: v }))} onClear={() => clearFilter("author")} />
          )}
          {filters.repo && (
            <FilterChip kind="repo" value={filters.repo} options={repos as string[]} optionLabel={shortRepo} onChange={(v) => setFilters((f) => ({ ...f, repo: v }))} onClear={() => clearFilter("repo")} />
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && data && (
          <div className="mx-6 mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 h-4 w-4 shrink-0" />
            Refresh failed: {error}. Showing the last successful response.
          </div>
        )}
        {data?.errors.map((e) => (
          <div key={e} className="mx-6 mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 h-4 w-4 shrink-0" />
            {e}
          </div>
        ))}

        {showSkeleton ? (
          <ListSkeleton />
        ) : showError ? (
          <div className="mx-6 mt-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="mb-1 font-medium text-destructive">Failed to load deployments</p>
            <p className="mb-3 text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={refresh}>
              Try again
            </Button>
          </div>
        ) : data && data.configured === false ? (
          <div className="mx-6 mt-2 rounded-lg border border-border p-4 text-sm">
            <p className="mb-1 font-medium">No deployments yet</p>
            <p className="text-muted-foreground">
              Deploy a service from the Services tab, or set <code className="font-mono">GITHUB_TOKEN</code> so this
              project&apos;s repos show their GitHub Actions runs here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            {items.length === 0 ? "No deployments yet." : "No runs match the current filters."}
          </p>
        ) : (
          <>
            {visible.map((d) => (
              <DeploymentRow key={d.id} deployment={d} active={selectedId === d.id} onClick={() => setSelectedId(selectedId === d.id ? null : d.id)} />
            ))}
            {visibleCount < filtered.length && (
              <div className="flex justify-center border-b border-border py-4">
                <Button size="sm" variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {selected && <DeploymentDetailPanel deployment={selected} visible={isPanelVisible} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
