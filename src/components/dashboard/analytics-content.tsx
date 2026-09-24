"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { Book02Icon, Download04Icon, FavouriteIcon, File01Icon, Link01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { fmtNum, type ContentData } from "@/lib/status";
import { AnalyticsStatCard } from "@/components/dashboard/analytics-stat-card";

/** The collector may serialise aggregated counters as strings; normalise before formatting. */
function asNumber(v: number | string): number {
  return typeof v === "number" ? v : Number(v);
}

export function ContentStats({ content }: { content: ContentData }) {
  const { interactions } = content;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <AnalyticsStatCard
        icon={ViewIcon}
        title="Views"
        label="Article views"
        value={fmtNum(asNumber(interactions.views))}
        sub="All time"
      />
      <AnalyticsStatCard
        icon={Download04Icon}
        title="Downloads"
        label="PDF downloads"
        value={fmtNum(asNumber(interactions.downloads))}
        sub="All time"
      />
      <AnalyticsStatCard
        icon={FavouriteIcon}
        title="Likes"
        label="Article likes"
        value={fmtNum(asNumber(interactions.likes))}
        sub="All time"
      />
      <AnalyticsStatCard
        icon={Link01Icon}
        title="Citations"
        label="External citations"
        value={fmtNum(asNumber(content.citations))}
        sub={`${fmtNum(content.articles.with_doi)} articles with DOI`}
      />
    </div>
  );
}

export function TopArticles({ articles }: { articles: ContentData["top_articles"] }) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={File01Icon} className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Top articles</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">By views</span>
      </CardHeader>
      <CardContent>
        {articles.length === 0 ? (
          <div className="text-sm text-muted-foreground">No interactions recorded yet</div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left font-medium py-2 pr-4">Title</th>
                  <th className="text-right font-medium py-2 px-2">Views</th>
                  <th className="text-right font-medium py-2 pl-2">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a, i) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="py-2 pr-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-xs text-muted-foreground tabular-nums w-5 shrink-0 pt-0.5">{i + 1}</span>
                        <span className="truncate max-w-[32rem]" title={a.title}>
                          {a.title}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium">{fmtNum(asNumber(a.views))}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-muted-foreground">
                      {fmtNum(asNumber(a.downloads))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ArticlesByType({ articles }: { articles: ContentData["articles"] }) {
  const entries = Object.entries(articles.by_type)
    .map(([type, count]) => ({ type, count: asNumber(count) }))
    .sort((a, b) => b.count - a.count);
  const max = entries.reduce((m, e) => Math.max(m, e.count), 0);
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Book02Icon} className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Articles by type</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">
          {fmtNum(articles.published)} / {fmtNum(articles.total)} published
        </span>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-sm text-muted-foreground">No articles yet</div>
        ) : (
          <div className="space-y-3">
            {entries.map((e) => {
              const pct = max > 0 ? (e.count / max) * 100 : 0;
              const share = articles.total > 0 ? (e.count / articles.total) * 100 : 0;
              return (
                <div key={e.type}>
                  <div className="flex items-center justify-between gap-3 text-sm mb-1">
                    <span className="capitalize">{e.type.replace(/_/g, " ")}</span>
                    <span className="text-xs tabular-nums whitespace-nowrap">
                      <span className="font-medium">{fmtNum(e.count)}</span>
                      <span className="text-muted-foreground"> · {share.toFixed(1)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[var(--chart-2)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
