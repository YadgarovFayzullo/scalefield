"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon, Globe02Icon, ReloadIcon, Time01Icon, WifiConnected01Icon } from "@hugeicons/core-free-icons";
import { fmtTime, useMetric, type ApiData, type ContentData, type VisitorsData } from "@/lib/status";
import { useProject } from "@/lib/project-context";
import { AnalyticsContentSkeleton, AnalyticsError, AnalyticsTrafficSkeleton } from "@/components/dashboard/analytics-states";
import {
  HostsList,
  StatusCodes,
  TopEndpoints,
  TrafficCharts,
  TrafficNotConfigured,
  TrafficStats,
} from "@/components/dashboard/analytics-traffic";
import { ArticlesByType, ContentStats, TopArticles } from "@/components/dashboard/analytics-content";
import {
  BreakdownCard,
  ReferrersCard,
  TopPagesCard,
  VisitorsChart,
  VisitorsNotConfigured,
  VisitorStats,
  VisitorStatsSkeleton,
} from "@/components/dashboard/analytics-visitors";

/**
 * Analytics Page
 *
 * Traffic block mirrors Vercel Analytics: totals for the collector window
 * (`window_hours`, normally 24h), hourly series, status code distribution,
 * top endpoints and hosts. Data comes from the status API (`/status/api`,
 * polled every 30s) — no mock data. When the access log is not configured
 * the traffic block collapses into a single notice.
 *
 * Content block (`/status/content`, polled every 60s) shows platform-wide
 * interaction totals, top articles and the publication type breakdown.
 *
 * EXCEPTION: Using cards for statistics (Supabase-style)
 */
const RANGE_OPTIONS = [
  { value: "1", label: "Last 24 Hours" },
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
];

export default function AnalyticsPage() {
  const [range, setRange] = React.useState("7");
  const { apiBase } = useProject();
  const visitors = useMetric<VisitorsData>(`${apiBase}/analytics/visitors?days=${range}`, 60000);
  const api = useMetric<ApiData>("api", 30000);
  const content = useMetric<ContentData>("content", 60000);

  const updatedAt = visitors.updatedAt ?? api.updatedAt ?? content.updatedAt;
  const windowHours = api.data?.configured ? (api.data.window_hours ?? 24) : null;
  const refreshing = api.loading || content.loading;

  const refresh = () => {
    visitors.refresh();
    api.refresh();
    content.refresh();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Analytics</h1>
          <p className="text-sm text-muted-foreground">Traffic, performance and content usage metrics</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Select value="production" onValueChange={() => {}}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v ?? "7")}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {windowHours != null ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-foreground font-medium">
              <HugeiconsIcon icon={Time01Icon} className="h-3.5 w-3.5" />
              Last {windowHours}h
            </span>
          ) : null}
          <span className="whitespace-nowrap">{updatedAt ? `Updated ${fmtTime(updatedAt)}` : "Loading…"}</span>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 cursor-pointer"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <HugeiconsIcon icon={ReloadIcon} className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Visitors */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Visitors · {RANGE_OPTIONS.find((o) => o.value === range)?.label.toLowerCase()}</h2>
        <VisitorsSection state={visitors} />
      </section>

      {/* Traffic */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Traffic</h2>
        <TrafficSection state={api} />
      </section>

      {/* Content */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Content</h2>
        <ContentSection state={content} />
      </section>
    </div>
  );
}

function VisitorsSection({ state }: { state: ReturnType<typeof useMetric<VisitorsData>> }) {
  const { data, error, loading, refresh } = state;

  if (!data) {
    if (loading) return <VisitorStatsSkeleton />;
    return <AnalyticsError title="Visitor metrics unavailable" message={error ?? "Unknown error"} onRetry={refresh} />;
  }

  if (!data.configured) return <VisitorsNotConfigured />;

  return (
    <div className="space-y-4">
      {error ? <AnalyticsError title="Latest refresh failed — showing previous data" message={error} onRetry={refresh} /> : null}
      {data.source === "logs" && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Estimated from the server proxy log. Add the <code className="font-mono">&lt;Analytics /&gt;</code> tracker
          to this project for exact, script-based numbers (also catches client-side route changes the log can&apos;t see).
        </div>
      )}
      <VisitorStats data={data} />
      <VisitorsChart series={data.series ?? []} days={data.window_days ?? 7} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TopPagesCard pages={data.top_pages ?? []} />
        <ReferrersCard data={data} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <BreakdownCard title="Devices" icon={ComputerIcon} items={data.devices ?? []} />
        <BreakdownCard title="Browsers" icon={Globe02Icon} items={data.browsers ?? []} />
        <BreakdownCard title="Operating Systems" icon={WifiConnected01Icon} items={data.operating_systems ?? []} />
      </div>
    </div>
  );
}

function TrafficSection({ state }: { state: ReturnType<typeof useMetric<ApiData>> }) {
  const { data, error, loading, refresh } = state;

  if (!data) {
    if (loading) return <AnalyticsTrafficSkeleton />;
    return <AnalyticsError title="Traffic metrics unavailable" message={error ?? "Unknown error"} onRetry={refresh} />;
  }

  if (!data.configured) return <TrafficNotConfigured />;

  return (
    <div className="space-y-6">
      {error ? (
        <AnalyticsError title="Latest refresh failed — showing previous data" message={error} onRetry={refresh} />
      ) : null}
      <TrafficStats api={data} />
      <TrafficCharts series={data.series ?? []} />
      <div className="grid gap-4 lg:grid-cols-2">
        {data.status_codes ? <StatusCodes codes={data.status_codes} /> : null}
        <HostsList hosts={data.by_host ?? []} />
      </div>
      <TopEndpoints endpoints={data.top_endpoints ?? []} />
    </div>
  );
}

function ContentSection({ state }: { state: ReturnType<typeof useMetric<ContentData>> }) {
  const { data, error, loading, refresh } = state;

  if (!data) {
    if (loading) return <AnalyticsContentSkeleton />;
    return <AnalyticsError title="Content metrics unavailable" message={error ?? "Unknown error"} onRetry={refresh} />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <AnalyticsError title="Latest refresh failed — showing previous data" message={error} onRetry={refresh} />
      ) : null}
      <ContentStats content={data} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TopArticles articles={data.top_articles} />
        </div>
        <ArticlesByType articles={data.articles} />
      </div>
    </div>
  );
}
