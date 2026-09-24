"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Database01Icon,
  HardDriveIcon,
  Link01Icon,
  ZapIcon,
  Exchange01Icon,
} from "@hugeicons/core-free-icons";
import type { DatabaseData } from "@/lib/status";
import { fmtNum, fmtPct } from "@/lib/status";
import { cn } from "@/lib/utils";

const CACHE_HIT_WARN = 0.95;

function StatCard({
  icon,
  title,
  children,
}: {
  icon: typeof Database01Icon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border" size="sm">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-1">
        <HugeiconsIcon icon={icon} className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Postgres version string is like "17.10 (Debian 17.10-1.pgdg12+1)" — keep the number, show the rest as a subtitle. */
function splitVersion(version: string): { major: string; detail: string } {
  const idx = version.indexOf(" ");
  if (idx === -1) return { major: version, detail: "" };
  return { major: version.slice(0, idx), detail: version.slice(idx + 1).trim() };
}

export function DatabaseStatCards({ data }: { data: DatabaseData }) {
  const version = splitVersion(data.version);
  const connPct = data.connections.max > 0 ? (data.connections.total / data.connections.max) * 100 : 0;
  const connHigh = connPct >= 80;
  const cacheLow = data.cache_hit_ratio < CACHE_HIT_WARN;
  const byState = Object.entries(data.connections.by_state).sort((a, b) => b[1] - a[1]);
  const txn = data.txn;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard icon={Database01Icon} title="PostgreSQL">
        <div className="text-2xl font-semibold tabular-nums">{version.major}</div>
        <p className="mt-1 truncate text-xs text-muted-foreground" title={data.version}>
          {version.detail || "version"}
        </p>
      </StatCard>

      <StatCard icon={HardDriveIcon} title="Database size">
        <div className="text-2xl font-semibold tabular-nums">{data.size_pretty}</div>
        <p className="mt-1 text-xs text-muted-foreground">{fmtNum(data.size_bytes)} bytes</p>
      </StatCard>

      <StatCard icon={Link01Icon} title="Connections">
        <div className="flex items-baseline gap-1">
          <span className={cn("text-2xl font-semibold tabular-nums", connHigh && "text-red-600 dark:text-red-400")}>
            {fmtNum(data.connections.total)}
          </span>
          <span className="text-sm text-muted-foreground">/ {fmtNum(data.connections.max)}</span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={data.connections.max}
          aria-valuenow={data.connections.total}
        >
          <div
            className={cn("h-full rounded-full", connHigh ? "bg-red-500" : "bg-primary")}
            style={{ width: `${Math.min(100, connPct)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {fmtPct(connPct)}
          {byState.length > 0 && (
            <>
              {" · "}
              {byState.map(([state, n]) => `${state} ${n}`).join(", ")}
            </>
          )}
        </p>
      </StatCard>

      <StatCard icon={ZapIcon} title="Cache hit ratio">
        <div className={cn("text-2xl font-semibold tabular-nums", cacheLow && "text-amber-600 dark:text-amber-400")}>
          {fmtPct(data.cache_hit_ratio * 100, 2)}
        </div>
        <p className={cn("mt-1 text-xs", cacheLow ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
          {cacheLow ? `Below ${CACHE_HIT_WARN * 100}% — shared_buffers may be too small` : "Buffer cache is healthy"}
        </p>
      </StatCard>

      <StatCard icon={Exchange01Icon} title="Transactions">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">{fmtNum(txn.commits)}</span>
          <span className="text-xs text-muted-foreground">commits</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className={cn(txn.rollbacks > 0 && "text-amber-600 dark:text-amber-400")}>
            {fmtNum(txn.rollbacks)} rollbacks
          </span>
        </p>
        <dl className="mt-2 grid grid-cols-3 gap-1 text-xs">
          <div>
            <dt className="text-muted-foreground">ins</dt>
            <dd className="font-medium tabular-nums">{fmtNum(txn.inserts)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">upd</dt>
            <dd className="font-medium tabular-nums">{fmtNum(txn.updates)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">del</dt>
            <dd className="font-medium tabular-nums">{fmtNum(txn.deletes)}</dd>
          </div>
        </dl>
      </StatCard>
    </div>
  );
}
