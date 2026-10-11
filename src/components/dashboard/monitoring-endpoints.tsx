"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { Globe02Icon, Link01Icon } from "@hugeicons/core-free-icons";
import { fmtMs, fmtNum, fmtPct, type ApiData } from "@/lib/status";

/**
 * Таблицы трафика сервера для /monitoring: топ эндпоинтов и разбивка по
 * доменам. Данные — access-лог прокси через агента (`/status/api`): это
 * инфраструктура, а не аудитория; аналитика посетителей — на /analytics,
 * только из скрипта Scalefield.
 */

// ---------- hosts ----------

export function HostsList({ hosts }: { hosts: NonNullable<ApiData["by_host"]> }) {
  const total = hosts.reduce((s, h) => s + h.count, 0);
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Globe02Icon} className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Hosts</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">{hosts.length} hosts</span>
      </CardHeader>
      <CardContent>
        {hosts.length === 0 ? (
          <div className="text-sm text-muted-foreground">No requests in the current window</div>
        ) : (
          <div className="space-y-3">
            {hosts.map((h) => {
              const pct = total > 0 ? (h.count / total) * 100 : 0;
              return (
                <div key={h.host}>
                  <div className="flex items-center justify-between gap-3 text-sm mb-1">
                    <span className="font-mono text-xs truncate">{h.host}</span>
                    <span className="text-xs tabular-nums whitespace-nowrap">
                      <span className="font-medium">{fmtNum(h.count)}</span>
                      <span className="text-muted-foreground"> · {fmtPct(pct, 1)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${pct}%` }} />
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

// ---------- top endpoints ----------

export function TopEndpoints({ endpoints }: { endpoints: NonNullable<ApiData["top_endpoints"]> }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <HugeiconsIcon icon={Link01Icon} className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top endpoints</h2>
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        {endpoints.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">No requests in the current window</div>
        ) : (
          /* header 32px + 10 rows × 37px = 402px; the rest scrolls under the sticky header */
          <div className="max-h-[402px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="text-xs text-muted-foreground uppercase tracking-wide bg-muted/30">
                  <th className="text-left font-medium px-4 py-2">Path</th>
                  <th className="text-right font-medium px-4 py-2">Requests</th>
                  <th className="text-right font-medium px-4 py-2">Avg time</th>
                  <th className="text-right font-medium px-4 py-2">Errors</th>
                  <th className="text-right font-medium px-4 py-2">Error rate</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((e) => {
                  const rate = e.count > 0 ? (e.errors / e.count) * 100 : 0;
                  return (
                    <tr key={e.path} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-xs max-w-[28rem] truncate" title={e.path}>
                        {e.path}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtNum(e.count)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtMs(e.avg_ms)}</td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums ${
                          e.errors > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                        }`}
                      >
                        {fmtNum(e.errors)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtPct(rate, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
