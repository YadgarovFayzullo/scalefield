"use client";

import * as React from "react";
import { useProject } from "@/lib/project-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Activity03Icon,
  AlertCircleIcon,
  Book02Icon,
  CpuIcon,
  Database02Icon,
  Download01Icon,
  EyeIcon,
  HardDriveIcon,
  RefreshIcon,
  Time01Icon,
  UserMultipleIcon,
  ComputerIcon,
} from "@hugeicons/core-free-icons";
import {
  useMetric,
  fmtBytes,
  fmtNum,
  fmtPct,
  fmtMs,
  type ApiData,
  type ContentData,
  type DatabaseData,
  type ServerData,
  type SummaryData,
} from "@/lib/status";
import {
  MetricSection,
  SectionHeading,
  StatCard,
  StatCardSkeleton,
  pctTone,
} from "@/components/dashboard/overview-primitives";
import {
  ContainersCard,
  HealthBanner,
  HealthBannerSkeleton,
} from "@/components/dashboard/overview-health";
import {
  ChartCardSkeleton,
  GrowthChart,
  TrafficChart,
} from "@/components/dashboard/overview-charts";

/**
 * Dashboard Overview Page
 *
 * EXCEPTION: Using cards for statistics (Supabase-style)
 * This is the ONLY place where cards are allowed
 */

/** Re-renders every second so "updated N s ago" keeps counting. */
function useNow(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function fmtSecondsAgo(updatedAt: number | null, now: number): string {
  if (updatedAt == null) return "—";
  const s = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function StatRowSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </>
  );
}

export default function DashboardPage() {
  const project = useProject();
  const summary = useMetric<SummaryData>("summary", 10_000);
  const server = useMetric<ServerData>("server", 10_000);
  const database = useMetric<DatabaseData>("database", 30_000);
  const api = useMetric<ApiData>("api", 60_000);
  const content = useMetric<ContentData>("content", 60_000);

  const metrics = [summary, server, database, api, content];
  const anyLoading = metrics.some((m) => m.loading);
  const lastUpdated = metrics.reduce<number | null>(
    (acc, m) => (m.updatedAt != null && (acc == null || m.updatedAt > acc) ? m.updatedAt : acc),
    null
  );
  const now = useNow();

  const refreshAll = () => {
    for (const m of metrics) m.refresh();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page header */}
      <div className="mb-6 sm:mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Overview</h1>
          <p className="text-sm text-muted-foreground">{project.name} · platform status</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            Updated {fmtSecondsAgo(lastUpdated, now)}
          </span>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={anyLoading}>
            <HugeiconsIcon
              icon={RefreshIcon}
              className={anyLoading ? "animate-spin" : undefined}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Health plate */}
      <div className="mb-8">
        <MetricSection
          title="Health summary"
          data={summary.data}
          error={summary.error}
          loading={summary.loading}
          onRetry={summary.refresh}
          skeleton={<HealthBannerSkeleton />}
        >
          {(s) => <HealthBanner summary={s} />}
        </MetricSection>
      </div>

      {/* Infrastructure */}
      <section className="mb-8">
        <SectionHeading>Infrastructure</SectionHeading>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricSection
            title="Server metrics"
            data={server.data}
            error={server.error}
            loading={server.loading}
            onRetry={server.refresh}
            skeleton={<StatRowSkeleton count={3} />}
          >
            {(s) => (
              <>
                <StatCard
                  icon={CpuIcon}
                  title="CPU"
                  value={fmtPct(s.cpu_pct)}
                  tone={pctTone(s.cpu_pct)}
                  progress={s.cpu_pct}
                  hint={`${s.cpu_count} cores · load ${s.load_avg.map((l) => l.toFixed(2)).join(" / ")}`}
                />
                <StatCard
                  icon={ComputerIcon}
                  title="Memory"
                  value={fmtPct(s.mem.pct)}
                  tone={pctTone(s.mem.pct, 80, 92)}
                  progress={s.mem.pct}
                  hint={`${fmtBytes(s.mem.used)} of ${fmtBytes(s.mem.total)} · swap ${fmtPct(s.swap.pct, 0)}`}
                />
                <StatCard
                  icon={HardDriveIcon}
                  title="Disk"
                  value={fmtPct(s.disk.pct)}
                  tone={pctTone(s.disk.pct, 75, 90)}
                  progress={s.disk.pct}
                  hint={`${fmtBytes(s.disk.used)} of ${fmtBytes(s.disk.total)} on ${s.disk.path}`}
                />
              </>
            )}
          </MetricSection>
          <MetricSection
            title="Database metrics"
            data={database.data}
            error={database.error}
            loading={database.loading}
            onRetry={database.refresh}
            skeleton={<StatRowSkeleton count={1} />}
          >
            {(d) => (
              <StatCard
                icon={Database02Icon}
                title="Database"
                value={d.size_pretty}
                tone={d.ok ? pctTone(d.connections.pct, 60, 85) : "bad"}
                progress={d.connections.pct}
                hint={`${d.connections.total}/${d.connections.max} connections · cache hit ${fmtPct(d.cache_hit_ratio * 100, 0)}`}
              />
            )}
          </MetricSection>
        </div>
      </section>

      {/* API */}
      <section className="mb-8">
        <SectionHeading>API</SectionHeading>
        <MetricSection
          title="API metrics"
          data={api.data}
          error={api.error}
          loading={api.loading}
          onRetry={api.refresh}
          skeleton={
            <div className="grid gap-4 md:grid-cols-3">
              <StatRowSkeleton count={3} />
            </div>
          }
        >
          {(a) =>
            !a.configured ? (
              <Card className="border-border">
                <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                  <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
                  API traffic metrics are not configured on the status service.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard
                    icon={Activity03Icon}
                    title={`Requests (${a.window_hours ?? 24}h)`}
                    value={fmtNum(a.total_requests)}
                    hint={`${(a.rps ?? 0).toFixed(3)} req/s · ${fmtBytes(a.bytes_out)} out`}
                  />
                  <StatCard
                    icon={AlertCircleIcon}
                    title="Error rate"
                    value={fmtPct((a.error_rate ?? 0) * 100, 2)}
                    tone={pctTone((a.error_rate ?? 0) * 100, 2, 5)}
                    hint={`4xx ${fmtNum(a.status_codes?.["4xx"])} · 5xx ${fmtNum(a.status_codes?.["5xx"])}`}
                  />
                  <StatCard
                    icon={Time01Icon}
                    title="Latency p95"
                    value={fmtMs(a.latency_ms?.p95)}
                    tone={pctTone(a.latency_ms?.p95, 500, 1000)}
                    hint={`p50 ${fmtMs(a.latency_ms?.p50)} · p99 ${fmtMs(a.latency_ms?.p99)}`}
                  />
                </div>
                <TrafficChart series={a.series ?? []} windowHours={a.window_hours} />
              </div>
            )
          }
        </MetricSection>
      </section>

      {/* Content */}
      <section className="mb-8">
        <SectionHeading>Content</SectionHeading>
        <MetricSection
          title="Content metrics"
          data={content.data}
          error={content.error}
          loading={content.loading}
          onRetry={content.refresh}
          skeleton={
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatRowSkeleton count={4} />
              </div>
              <ChartCardSkeleton />
            </div>
          }
        >
          {(c) => (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={Book02Icon}
                  title="Articles"
                  value={fmtNum(c.articles.total)}
                  hint={`${fmtNum(c.articles.published)} published · ${fmtNum(c.articles.with_doi)} with DOI`}
                />
                <StatCard
                  icon={UserMultipleIcon}
                  title="Users"
                  value={fmtNum(c.users)}
                  hint={`${fmtNum(c.roles.admin ?? 0)} admins · ${fmtNum(c.roles.owner ?? 0)} owners`}
                />
                <StatCard
                  icon={EyeIcon}
                  title="Views"
                  value={fmtNum(c.interactions.views)}
                  hint={`${fmtNum(c.journals.total)} journals · ${fmtNum(c.issues)} issues`}
                />
                <StatCard
                  icon={Download01Icon}
                  title="Downloads"
                  value={fmtNum(c.interactions.downloads)}
                  hint={`${fmtNum(c.interactions.likes)} likes · ${fmtNum(c.citations)} citations`}
                />
              </div>
              <GrowthChart growth={c.growth} />
            </div>
          )}
        </MetricSection>
      </section>

      {/* Containers */}
      <section>
        <SectionHeading>Containers</SectionHeading>
        <MetricSection
          title="Container list"
          data={summary.data}
          error={summary.error}
          loading={summary.loading}
          onRetry={summary.refresh}
          skeleton={<ChartCardSkeleton />}
        >
          {(s) => <ContainersCard containers={s.server?.containers ?? []} />}
        </MetricSection>
      </section>
    </div>
  );
}
