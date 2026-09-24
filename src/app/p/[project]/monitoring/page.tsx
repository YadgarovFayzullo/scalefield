"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, AlertCircleIcon, Activity03Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { useMetric, fmtAgo, fmtDuration, fmtPct } from "@/lib/status";
import type { ApiData, ServerData, SummaryData } from "@/lib/status";
import {
  containerState,
  ErrorCard,
  CardSkeleton,
  RowsSkeleton,
  SectionHeading,
  STATE_BG,
  type ServiceState,
} from "@/components/dashboard/monitoring-shared";
import { MonitoringServices } from "@/components/dashboard/monitoring-services";
import { MonitoringHost } from "@/components/dashboard/monitoring-host";
import { MonitoringIncidents } from "@/components/dashboard/monitoring-incidents";
import { MonitoringTraffic } from "@/components/dashboard/monitoring-traffic";

/**
 * Monitoring page: live host, Docker services and traffic errors.
 * Data: /api/status/server (5s), /api/status/api (30s), /api/status/summary (10s).
 */
export default function MonitoringPage() {
  const server = useMetric<ServerData>("server", 5000);
  const api = useMetric<ApiData>("api", 30000);
  const summary = useMetric<SummaryData>("summary", 10000);

  // `updatedAt` is stamped by useMetric at each poll, so container uptimes tick with the data.
  const now = server.updatedAt ?? 0;

  const containers = React.useMemo(() => server.data?.containers ?? [], [server.data]);
  const states = React.useMemo(() => containers.map(containerState), [containers]);
  const counts = React.useMemo(() => {
    const c: Record<ServiceState, number> = { operational: 0, degraded: 0, down: 0 };
    for (const s of states) c[s] += 1;
    return c;
  }, [states]);

  const e5xx = api.data?.status_codes?.["5xx"] ?? 0;
  const lastChecked = summary.updatedAt ?? server.updatedAt;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Monitoring</h1>
        <p className="text-sm text-muted-foreground">Host, Docker services and API error state</p>
      </div>

      {/* System status cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {summary.loading && !summary.data ? (
          <CardSkeleton />
        ) : summary.error && !summary.data ? (
          <ErrorCard title="Summary unavailable" message={summary.error} onRetry={summary.refresh} />
        ) : summary.data ? (
          <SystemStatusCard summary={summary.data} lastChecked={lastChecked} />
        ) : null}

        {server.loading && !server.data ? (
          <CardSkeleton />
        ) : server.error && !server.data ? (
          <ErrorCard title="Server metrics unavailable" message={server.error} onRetry={server.refresh} />
        ) : (
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Activity03Icon} className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Services Online</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  {counts.operational} / {containers.length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {counts.degraded} degraded, {counts.down} down
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {states.map((s, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${STATE_BG[s]}`} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {api.loading && !api.data ? (
          <CardSkeleton />
        ) : api.error && !api.data ? (
          <ErrorCard title="Traffic log unavailable" message={api.error} onRetry={api.refresh} />
        ) : (
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Errors & Incidents</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {api.data?.configured ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">5xx (last {api.data.window_hours ?? 24}h):</span>
                    <span className={`text-sm font-semibold tabular-nums ${e5xx > 0 ? "text-red-600" : ""}`}>{e5xx}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Error rate:</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {api.data.error_rate == null ? "—" : fmtPct(api.data.error_rate * 100, 2)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">traffic log not configured</div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Unhealthy containers:</span>
                <span className={`text-sm font-semibold tabular-nums ${counts.degraded + counts.down > 0 ? "text-yellow-600" : ""}`}>
                  {counts.degraded + counts.down}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Incidents */}
      <div className="mb-8">
        <SectionHeading>Incidents</SectionHeading>
        {server.loading && !server.data ? (
          <RowsSkeleton rows={3} />
        ) : (
          <MonitoringIncidents containers={containers} api={api.data} apiError={api.error} />
        )}
      </div>

      {/* Host */}
      <div className="mb-8">
        <SectionHeading aside={server.error && server.data ? `stale: ${server.error}` : `updated ${fmtAgo(server.updatedAt)}`}>
          Host
        </SectionHeading>
        {server.loading && !server.data ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="md:col-span-2"><CardSkeleton lines={4} /></div>
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </div>
        ) : server.error && !server.data ? (
          <ErrorCard title="Server metrics unavailable" message={server.error} onRetry={server.refresh} />
        ) : server.data ? (
          <MonitoringHost server={server.data} />
        ) : null}
      </div>

      {/* Traffic */}
      <div className="mb-8">
        <SectionHeading aside={api.updatedAt ? `updated ${fmtAgo(api.updatedAt)}` : undefined}>Traffic</SectionHeading>
        {api.loading && !api.data ? (
          <Card className="border-border">
            <CardContent className="space-y-3 py-5">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ) : api.error && !api.data ? (
          <ErrorCard title="Traffic log unavailable" message={api.error} onRetry={api.refresh} />
        ) : api.data?.configured ? (
          <MonitoringTraffic api={api.data} />
        ) : (
          <div className="border-t border-b border-border py-6 text-sm text-muted-foreground">traffic log not configured</div>
        )}
      </div>

      {/* Services */}
      <div>
        <SectionHeading aside={`${containers.length} containers`}>Services</SectionHeading>
        {server.loading && !server.data ? (
          <RowsSkeleton rows={6} />
        ) : server.error && !server.data ? (
          <ErrorCard title="Containers unavailable" message={server.error} onRetry={server.refresh} />
        ) : (
          <MonitoringServices containers={containers} now={now} />
        )}
      </div>
    </div>
  );
}

function SystemStatusCard({ summary, lastChecked }: { summary: SummaryData; lastChecked: number | null }) {
  const ok = summary.healthy;
  const partial = !ok && (summary.server_ok || summary.db_ok);
  const label = ok ? "All Systems Operational" : partial ? "Partial Outage" : "Major Outage";
  const color = ok ? "text-green-600" : partial ? "text-yellow-600" : "text-red-600";
  const icon = ok ? CheckmarkCircle02Icon : partial ? AlertCircleIcon : Cancel01Icon;

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={icon} className={`h-4 w-4 ${color}`} />
          <CardTitle className="text-sm font-medium">System Status</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className={`text-lg font-semibold ${color}`}>{label}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Last checked: {lastChecked ? fmtAgo(lastChecked) : "—"} · status API up {fmtDuration(summary.api_uptime_s)}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className={summary.server_ok ? "text-green-600" : "text-red-600"} title={summary.server_error ?? undefined}>
            server {summary.server_ok ? "ok" : "down"}
          </span>
          <span className={summary.db_ok ? "text-green-600" : "text-red-600"} title={summary.db_error ?? undefined}>
            database {summary.db_ok ? "ok" : "down"}
            {summary.db ? ` · ${summary.db.size_pretty}, ${summary.db.connections} conn` : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
