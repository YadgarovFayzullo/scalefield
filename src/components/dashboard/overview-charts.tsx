"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import { Activity03Icon, ChartLineData01Icon } from "@hugeicons/core-free-icons";
import { fmtNum, type ContentData, type TrafficBucket } from "@/lib/status";

const chartClass = "h-56 w-full aspect-auto";

function ChartCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Activity03Icon;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={icon} className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function ChartCardSkeleton() {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className={chartClass} />
      </CardContent>
    </Card>
  );
}

// ---------- articles growth (30 days) ----------

const growthConfig = {
  count: { label: "New articles", color: "var(--chart-2)" },
} satisfies ChartConfig;

function shortDate(iso: string): string {
  // "2026-08-26" → "26 Aug"
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function GrowthChart({ growth }: { growth: ContentData["growth"] }) {
  const total = growth.reduce((s, g) => s + g.count, 0);
  return (
    <ChartCard
      icon={ChartLineData01Icon}
      title="Articles added"
      subtitle={`${fmtNum(total)} in ${growth.length} days`}
    >
      {growth.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data for the period.</p>
      ) : (
        <ChartContainer config={growthConfig} className={chartClass}>
          <BarChart data={growth} margin={{ left: -16, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tickFormatter={(v: string) => shortDate(v)}
            />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent labelFormatter={(label: string) => shortDate(label)} />
              }
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

// ---------- API traffic by hour ----------

const trafficConfig = {
  ok: { label: "OK", color: "var(--chart-2)" },
  e4xx: { label: "4xx", color: "var(--chart-1)" },
  e5xx: { label: "5xx", color: "var(--destructive)" },
  avg_ms: { label: "Avg latency (ms)", color: "var(--chart-4)" },
} satisfies ChartConfig;

type TrafficPoint = {
  ts: number;
  ok: number;
  e4xx: number;
  e5xx: number;
  avg_ms: number;
  requests: number;
};

function hourLabel(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function TrafficChart({
  series,
  windowHours,
}: {
  series: TrafficBucket[];
  windowHours?: number;
}) {
  const data = React.useMemo<TrafficPoint[]>(
    () =>
      series.map((b) => ({
        ts: b.ts,
        ok: Math.max(0, b.requests - b.e4xx - b.e5xx),
        e4xx: b.e4xx,
        e5xx: b.e5xx,
        avg_ms: Math.round(b.avg_ms),
        requests: b.requests,
      })),
    [series]
  );

  return (
    <ChartCard
      icon={Activity03Icon}
      title="API requests by hour"
      subtitle={windowHours ? `last ${windowHours}h` : undefined}
    >
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No traffic in the window.</p>
      ) : (
        <ChartContainer config={trafficConfig} className={chartClass}>
          <ComposedChart data={data} margin={{ left: -16, right: -16, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="ts"
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              tickFormatter={(v: number) => hourLabel(v)}
            />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} width={44} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => `${v}ms`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_label, payload) => {
                    const p = payload?.[0]?.payload as TrafficPoint | undefined;
                    return p ? `${hourLabel(p.ts)} · ${fmtNum(p.requests)} requests` : null;
                  }}
                />
              }
            />
            <Bar yAxisId="left" dataKey="ok" stackId="req" fill="var(--color-ok)" />
            <Bar yAxisId="left" dataKey="e4xx" stackId="req" fill="var(--color-e4xx)" />
            <Bar
              yAxisId="left"
              dataKey="e5xx"
              stackId="req"
              fill="var(--color-e5xx)"
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avg_ms"
              stroke="var(--color-avg_ms)"
              strokeWidth={2}
              dot={false} activeDot={false}
            />
          </ComposedChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}
