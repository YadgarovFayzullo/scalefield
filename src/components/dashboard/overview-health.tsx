"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, CheckmarkCircle02Icon, Package01Icon } from "@hugeicons/core-free-icons";
import { fmtDuration, type SummaryData } from "@/lib/status";
import { toneChip, toneText, type Tone } from "@/components/dashboard/overview-primitives";

// ---------- health plate ----------

function okChip(label: string, ok: boolean) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${ok ? toneChip.ok : toneChip.bad}`}
    >
      {label}: {ok ? "OK" : "DOWN"}
    </span>
  );
}

export function HealthBanner({ summary }: { summary: SummaryData }) {
  const tone: Tone = summary.healthy ? "ok" : "bad";
  const title = summary.healthy ? "All Systems Operational" : "Degraded";
  const issues = [summary.server_error, summary.db_error].filter(
    (e): e is string => typeof e === "string" && e.length > 0
  );

  return (
    <Card className={summary.healthy ? "border-border" : "border-red-500/40"}>
      <CardContent className="py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <HugeiconsIcon
              icon={summary.healthy ? CheckmarkCircle02Icon : AlertCircleIcon}
              className={`h-5 w-5 mt-0.5 ${toneText[tone]}`}
            />
            <div>
              <div className={`text-lg font-semibold ${toneText[tone]}`}>{title}</div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {okChip("Server", summary.server_ok)}
                {okChip("Database", summary.db_ok)}
              </div>
              {issues.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-red-600 dark:text-red-400 break-all">
                  {issues.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm md:text-right">
            <dt className="text-muted-foreground">Server uptime</dt>
            <dd className="font-medium tabular-nums">{fmtDuration(summary.server?.uptime_s)}</dd>
            <dt className="text-muted-foreground">API uptime</dt>
            <dd className="font-medium tabular-nums">{fmtDuration(summary.api_uptime_s)}</dd>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

export function HealthBannerSkeleton() {
  return (
    <Card className="border-border">
      <CardContent className="py-4 flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- containers ----------

type ContainerRow = NonNullable<SummaryData["server"]>["containers"][number];

function containerTone(c: ContainerRow): { tone: Tone; label: string } {
  if (c.status !== "running") return { tone: "bad", label: c.status };
  if (c.health === "healthy") return { tone: "ok", label: "healthy" };
  if (c.health === "unhealthy") return { tone: "bad", label: "unhealthy" };
  if (c.health === "starting") return { tone: "warn", label: "starting" };
  return { tone: "ok", label: "running" };
}

const toneOrder: Record<Tone, number> = { bad: 0, warn: 1, ok: 2, neutral: 3 };

export function ContainersCard({ containers }: { containers: ContainerRow[] }) {
  const rows = React.useMemo(
    () =>
      containers
        .map((c) => ({ ...c, ...containerTone(c) }))
        .sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone] || a.name.localeCompare(b.name)),
    [containers]
  );
  const running = rows.filter((r) => r.status === "running").length;
  const unhealthy = rows.filter((r) => r.tone === "bad" && r.status === "running").length;

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Package01Icon} className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Containers</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {running}/{rows.length} running
          {unhealthy > 0 ? ` · ${unhealthy} unhealthy` : ""}
        </span>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No containers reported.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-72 overflow-y-auto pr-1">
            {rows.map((r) => (
              <li
                key={r.name}
                className="flex items-center justify-between gap-2 px-3 py-1.5 border border-border rounded-md text-sm"
              >
                <span className="truncate font-mono text-xs" title={r.name}>
                  {r.name}
                </span>
                <Badge variant="outline" className={`border-transparent ${toneChip[r.tone]}`}>
                  {r.label}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
