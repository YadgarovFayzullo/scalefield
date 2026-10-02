"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Activity03Icon,
  AlertCircleIcon,
  ChartLineData01Icon,
  Globe02Icon,
  Link01Icon,
  SpeedTrain01Icon,
  Timer01Icon,
  Upload04Icon,
  WifiConnected01Icon,
} from "@hugeicons/core-free-icons";
import { fmtBytes, fmtMs, fmtNum, fmtPct, fmtTime, type ApiData, type TrafficBucket } from "@/lib/status";
import { AnalyticsStatCard } from "@/components/dashboard/analytics-stat-card";

// ---------- helpers ----------

type TrafficRow = TrafficBucket & { hour: string; errorPct: number };

function hourLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function toRows(series: TrafficBucket[]): TrafficRow[] {
  return series.map((b) => ({
    ...b,
    hour: hourLabel(b.ts),
    errorPct: b.requests > 0 ? ((b.e4xx + b.e5xx) / b.requests) * 100 : 0,
  }));
}

function toNumber(value: ValueType): number {
  return typeof value === "number" ? value : Number(value);
}

function fmtRps(rps: number): string {
  if (rps >= 10) return rps.toFixed(0);
  if (rps >= 1) return rps.toFixed(2);
  return rps.toFixed(3);
}

/**
 * Tooltip row formatter: shadcn's default prints `value.toLocaleString()`,
 * which is wrong for percentages, milliseconds and bytes.
 */
function makeFormatter(config: ChartConfig, fmt: (n: number) => string) {
  const Row = (value: ValueType, name: NameType): React.ReactNode => {
    const key = String(name);
    const label = config[key]?.label ?? key;
    return (
      <div className="flex flex-1 items-center justify-between gap-4 leading-none">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: `var(--color-${key})` }}
          />
          {label}
        </span>
        <span className="font-mono font-medium tabular-nums text-foreground">{fmt(toNumber(value))}</span>
      </div>
    );
  };
  return Row;
}

function tooltipLabel(_: React.ReactNode, payload: ReadonlyArray<{ payload?: unknown }>): React.ReactNode {
  const row = payload[0]?.payload as TrafficRow | undefined;
  return row ? fmtTime(row.ts) : null;
}

const axisProps = { tickLine: false, axisLine: false, tickMargin: 8 } as const;

// ---------- chart configs ----------

const requestsConfig = { requests: { label: "Requests", color: "var(--chart-1)" } } satisfies ChartConfig;
const errorConfig = { errorPct: { label: "Error rate", color: "var(--destructive)" } } satisfies ChartConfig;
const latencyConfig = {
  avg_ms: { label: "Average", color: "var(--chart-1)" },
  p95_ms: { label: "p95", color: "var(--chart-3)" },
} satisfies ChartConfig;
const bytesConfig = { bytes: { label: "Bytes out", color: "var(--chart-2)" } } satisfies ChartConfig;

// ---------- blocks ----------

export function TrafficNotConfigured() {
  return (
    <Card className="border-border border-yellow-500/40 bg-yellow-500/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <CardTitle className="text-sm font-medium">Traffic log is not configured</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          The status API has no access log source, so request, latency and error metrics are unavailable.
          Configure the traffic log collector on the status service to enable this section.
        </p>
      </CardContent>
    </Card>
  );
}

export function TrafficStats({ api }: { api: ApiData }) {
  const codes = api.status_codes;
  const errors4 = codes?.["4xx"] ?? 0;
  const errors5 = codes?.["5xx"] ?? 0;
  const errorRate = api.error_rate ?? 0;
  const perReq = api.total_requests && api.bytes_out ? api.bytes_out / api.total_requests : null;
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
      <AnalyticsStatCard
        icon={ChartLineData01Icon}
        title="Requests"
        label="Total requests"
        value={fmtNum(api.total_requests)}
        sub={`Last ${api.window_hours ?? 24}h`}
      />
      <AnalyticsStatCard
        icon={Activity03Icon}
        title="Throughput"
        label="Requests per second"
        value={api.rps != null ? fmtRps(api.rps) : "—"}
        sub="Average over the window"
      />
      <AnalyticsStatCard
        icon={AlertCircleIcon}
        title="Errors"
        label="Error rate"
        value={fmtPct(errorRate * 100, 2)}
        valueClassName={
          errorRate >= 0.05
            ? "text-red-600 dark:text-red-400"
            : errorRate >= 0.01
              ? "text-yellow-600 dark:text-yellow-400"
              : "text-green-600 dark:text-green-400"
        }
        sub={`${fmtNum(errors4)} × 4xx · ${fmtNum(errors5)} × 5xx`}
      />
      <AnalyticsStatCard
        icon={SpeedTrain01Icon}
        title="Latency"
        label="p50 response time"
        value={fmtMs(api.latency_ms?.p50)}
        sub={`p95 ${fmtMs(api.latency_ms?.p95)} · p99 ${fmtMs(api.latency_ms?.p99)}`}
      />
      <AnalyticsStatCard
        icon={Upload04Icon}
        title="Bandwidth"
        label="Bytes out"
        value={fmtBytes(api.bytes_out)}
        sub={perReq != null ? `${fmtBytes(perReq)} per request` : undefined}
      />
    </div>
  );
}

export function TrafficCharts({ series }: { series: TrafficBucket[] }) {
  const rows = React.useMemo(() => toRows(series), [series]);
  const empty = rows.length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard icon={ChartLineData01Icon} title="Requests" description="Requests per hour" empty={empty}>
        <ChartContainer config={requestsConfig} className="h-56 w-full aspect-auto">
          <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="hour" {...axisProps} minTickGap={32} />
            <YAxis {...axisProps} width={44} tickFormatter={(v: number) => fmtNum(v)} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent labelFormatter={tooltipLabel} formatter={makeFormatter(requestsConfig, fmtNum)} />
              }
            />
            <Bar dataKey="requests" fill="var(--color-requests)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard icon={AlertCircleIcon} title="Error rate" description="4xx + 5xx share of requests" empty={empty}>
        <ChartContainer config={errorConfig} className="h-56 w-full aspect-auto">
          <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="hour" {...axisProps} minTickGap={32} />
            <YAxis {...axisProps} width={44} tickFormatter={(v: number) => fmtPct(v, 0)} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={tooltipLabel}
                  formatter={makeFormatter(errorConfig, (n) => fmtPct(n, 2))}
                />
              }
            />
            <Area
              dataKey="errorPct"
              type="monotone"
              stroke="var(--color-errorPct)"
              fill="var(--color-errorPct)"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false} activeDot={false}
            />
          </AreaChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard icon={Timer01Icon} title="Latency" description="Average and p95 per hour" empty={empty}>
        <ChartContainer config={latencyConfig} className="h-56 w-full aspect-auto">
          <LineChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="hour" {...axisProps} minTickGap={32} />
            <YAxis {...axisProps} width={44} tickFormatter={(v: number) => fmtMs(v)} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent labelFormatter={tooltipLabel} formatter={makeFormatter(latencyConfig, fmtMs)} />}
            />
            <Line dataKey="avg_ms" type="monotone" stroke="var(--color-avg_ms)" strokeWidth={2} dot={false} activeDot={false} />
            <Line dataKey="p95_ms" type="monotone" stroke="var(--color-p95_ms)" strokeWidth={2} dot={false} activeDot={false} />
          </LineChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard icon={WifiConnected01Icon} title="Bandwidth" description="Bytes sent per hour" empty={empty}>
        <ChartContainer config={bytesConfig} className="h-56 w-full aspect-auto">
          <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="hour" {...axisProps} minTickGap={32} />
            <YAxis {...axisProps} width={52} tickFormatter={(v: number) => fmtBytes(v)} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent labelFormatter={tooltipLabel} formatter={makeFormatter(bytesConfig, fmtBytes)} />}
            />
            <Area
              dataKey="bytes"
              type="monotone"
              stroke="var(--color-bytes)"
              fill="var(--color-bytes)"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false} activeDot={false}
            />
          </AreaChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  icon,
  title,
  description,
  empty,
  children,
}: {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
  title: string;
  description: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={icon} className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">{description}</span>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            No data in the current window
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// ---------- status codes ----------

const CODE_STYLES: { key: "2xx" | "3xx" | "4xx" | "5xx"; bar: string; text: string; label: string }[] = [
  { key: "2xx", bar: "bg-green-500", text: "text-green-600 dark:text-green-400", label: "Success" },
  { key: "3xx", bar: "bg-blue-500", text: "text-blue-600 dark:text-blue-400", label: "Redirect" },
  { key: "4xx", bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400", label: "Client error" },
  { key: "5xx", bar: "bg-red-500", text: "text-red-600 dark:text-red-400", label: "Server error" },
];

export function StatusCodes({ codes }: { codes: NonNullable<ApiData["status_codes"]> }) {
  const total = CODE_STYLES.reduce((s, c) => s + codes[c.key], 0);
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Activity03Icon} className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Status codes</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">{fmtNum(total)} responses</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {CODE_STYLES.map((c) => {
            const pct = total > 0 ? (codes[c.key] / total) * 100 : 0;
            return pct > 0 ? (
              <div key={c.key} className={c.bar} style={{ width: `${pct}%` }} title={`${c.key}: ${fmtNum(codes[c.key])}`} />
            ) : null;
          })}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {CODE_STYLES.map((c) => {
            const pct = total > 0 ? (codes[c.key] / total) * 100 : 0;
            return (
              <div key={c.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${c.bar}`} />
                  <span className={`font-mono text-xs font-medium ${c.text}`}>{c.key}</span>
                  <span className="text-xs text-muted-foreground truncate">{c.label}</span>
                </div>
                <div className="text-xs tabular-nums whitespace-nowrap">
                  <span className="font-medium">{fmtNum(codes[c.key])}</span>
                  <span className="text-muted-foreground"> · {fmtPct(pct, 1)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
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
