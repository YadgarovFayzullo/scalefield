"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ReloadIcon, Time01Icon } from "@hugeicons/core-free-icons";
import { fmtTime, useMetric, type ApiData, type ContentData } from "@/lib/status";
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
export default function AnalyticsPage() {
  const api = useMetric<ApiData>("api", 30000);
  const content = useMetric<ContentData>("content", 60000);

  const updatedAt = api.updatedAt ?? content.updatedAt;
  const windowHours = api.data?.configured ? (api.data.window_hours ?? 24) : null;
  const refreshing = api.loading || content.loading;

  const refresh = () => {
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
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
