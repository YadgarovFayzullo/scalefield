"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { useMetric, type DatabaseData } from "@/lib/status";
import { DatabaseStatCards } from "@/components/dashboard/database-stat-cards";
import { DatabaseSizeChart, DatabaseTablesCard } from "@/components/dashboard/database-tables";
import { LongestRunningCard, SlowQueriesCard } from "@/components/dashboard/database-queries";
import { cn } from "@/lib/utils";

const POLL_MS = 15_000;

/** Seconds since `ts`, re-rendered once a second so the header reads "updated N s ago". */
function useSecondsSince(ts: number | null): number | null {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (ts == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ts]);
  if (ts == null) return null;
  return Math.max(0, Math.floor((now - ts) / 1000));
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-border" size="sm">
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="border-border lg:col-span-3">
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-20" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card className="border-border lg:col-span-2">
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
      </div>
      <Card className="border-border">
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <HugeiconsIcon icon={AlertCircleIcon} className="h-8 w-8 text-red-600 dark:text-red-400" />
        <div>
          <p className="text-sm font-medium">Could not load database metrics</p>
          <p className="mt-1 max-w-md font-mono text-xs text-muted-foreground break-all">{message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <HugeiconsIcon icon={RefreshIcon} />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DatabasePage() {
  const { data, error, loading, updatedAt, refresh } = useMetric<DatabaseData>("database", POLL_MS);
  const ago = useSecondsSince(updatedAt);
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Database</h1>
          <p className="text-sm text-muted-foreground">PostgreSQL health, storage and activity</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {ago == null ? "not loaded yet" : `updated ${ago} s ago`}
          </span>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <HugeiconsIcon icon={RefreshIcon} className={cn(refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* A poll can fail after data has already been shown: keep the stale data and flag it. */}
      {error && data && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4 shrink-0" />
          <span>
            Last refresh failed: <span className="font-mono">{error}</span>. Showing previous data.
          </span>
        </div>
      )}

      {loading && !data ? (
        <LoadingState />
      ) : !data ? (
        <ErrorState message={error ?? "Empty response"} onRetry={handleRefresh} />
      ) : (
        <div className="space-y-6">
          <DatabaseStatCards data={data} />

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <DatabaseTablesCard tables={data.tables} />
            </div>
            <div className="lg:col-span-2">
              <DatabaseSizeChart tables={data.tables} />
            </div>
          </div>

          <LongestRunningCard items={data.longest_running} />
          <SlowQueriesCard items={data.slow_queries} available={data.pg_stat_statements} />
        </div>
      )}
    </div>
  );
}
