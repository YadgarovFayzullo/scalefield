"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import { Activity03Icon } from "@hugeicons/core-free-icons";
import { fmtMs, fmtNum, fmtPct } from "@/lib/status";
import type { ApiData } from "@/lib/status";

const config = {
  requests: { label: "Requests", color: "hsl(142.1 76.2% 36.3%)" },
  e5xx: { label: "5xx", color: "hsl(0 84.2% 60.2%)" },
  e4xx: { label: "4xx", color: "hsl(45.4 93.4% 47.5%)" },
};

function hourLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function MonitoringTraffic({ api }: { api: ApiData }) {
  const data = React.useMemo(
    () => (api.series ?? []).map((b) => ({ hour: hourLabel(b.ts), requests: b.requests, e5xx: b.e5xx, e4xx: b.e4xx })),
    [api.series]
  );

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Activity03Icon} className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Requests & errors by hour</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">last {api.window_hours ?? 24}h</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Requests</div>
            <div className="text-sm font-medium tabular-nums">{fmtNum(api.total_requests)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Error rate</div>
            <div className="text-sm font-medium tabular-nums">
              {api.error_rate == null ? "—" : fmtPct(api.error_rate * 100, 2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">5xx / 4xx</div>
            <div className="text-sm font-medium tabular-nums">
              {fmtNum(api.status_codes?.["5xx"])} / {fmtNum(api.status_codes?.["4xx"])}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">p50 / p95</div>
            <div className="text-sm font-medium tabular-nums">
              {fmtMs(api.latency_ms?.p50)} / {fmtMs(api.latency_ms?.p95)}
            </div>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">No traffic recorded in this window.</div>
        ) : (
          <ChartContainer config={config} className="h-48 w-full">
            <ComposedChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={10} minTickGap={24} />
              <YAxis yAxisId="left" hide />
              <YAxis yAxisId="right" orientation="right" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar yAxisId="left" dataKey="requests" fill="var(--color-requests)" radius={[2, 2, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="e5xx" stroke="var(--color-e5xx)" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="e4xx" stroke="var(--color-e4xx)" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
