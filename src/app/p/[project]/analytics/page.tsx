"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon, Globe02Icon, ReloadIcon, WifiConnected01Icon } from "@hugeicons/core-free-icons";
import { fmtTime, useMetric, type ContentData, type VisitorsData } from "@/lib/status";
import { useProject } from "@/lib/project-context";
import { AnalyticsContentSkeleton, AnalyticsError } from "@/components/dashboard/analytics-states";
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
 * Analytics Page — web analytics in the spirit of Vercel Web Analytics.
 *
 * Visitors, page views, bounce rate, pages, referrers and device/browser/OS
 * breakdowns come only from the Scalefield script (public/script.js →
 * /api/collect → page_views). Nothing here depends on the proxy or on the
 * server the project runs on: the site can live anywhere. Server traffic from
 * the proxy access log lives on /monitoring.
 *
 * Content block (`/status/content`) is project-specific (researcher.uz) and is
 * shown only when the project has `contentMetrics` enabled.
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
  const { apiBase, slug, contentMetrics } = useProject();
  const visitors = useMetric<VisitorsData>(`${apiBase}/analytics/visitors?days=${range}`, 60000);
  // Счётчик ручного обновления: блок контента держит свой запрос сам и
  // перечитывает его, когда счётчик меняется.
  const [refreshKey, setRefreshKey] = React.useState(0);

  const updatedAt = visitors.updatedAt;
  const refreshing = visitors.loading;

  const refresh = () => {
    visitors.refresh();
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Analytics</h1>
          <p className="text-sm text-muted-foreground">Visitors, pages and referrers from the Scalefield script</p>
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
        <VisitorsSection state={visitors} site={slug} />
      </section>

      {contentMetrics ? (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Content</h2>
          <ContentBlock refreshKey={refreshKey} />
        </section>
      ) : null}
    </div>
  );
}

function VisitorsSection({ state, site }: { state: ReturnType<typeof useMetric<VisitorsData>>; site: string }) {
  const { data, error, loading, refresh } = state;

  if (!data) {
    if (loading) return <VisitorStatsSkeleton />;
    return <AnalyticsError title="Visitor metrics unavailable" message={error ?? "Unknown error"} onRetry={refresh} />;
  }

  if (!data.configured) return <VisitorsNotConfigured site={site} />;

  return (
    <div className="space-y-4">
      {error ? <AnalyticsError title="Latest refresh failed — showing previous data" message={error} onRetry={refresh} /> : null}
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

/** Только для проектов с `contentMetrics`: без него ручка отвечает 404, и
 * компонент не монтируется вовсе — запроса нет. */
function ContentBlock({ refreshKey }: { refreshKey: number }) {
  const { data, error, loading, refresh } = useMetric<ContentData>("content", 60000);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    refresh();
  }, [refreshKey, refresh]);

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
