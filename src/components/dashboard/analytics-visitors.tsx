"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerIcon,
  EyeIcon,
  InformationCircleIcon,
  Link01Icon,
  PercentIcon,
  SmartPhone01Icon,
  Tablet01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { fmtNum, fmtPct, type VisitorsData } from "@/lib/status";
import { cn } from "@/lib/utils";

// ---------- stat row ----------

/** Vercel colors the change badge by whether the direction is GOOD for that
 * metric, not just by sign: fewer visitors is bad (red), a lower bounce
 * rate is good (green). */
function ChangeBadge({ pct, goodDirection }: { pct: number | null; goodDirection: "up" | "down" }) {
  if (pct === null) return null;
  const isUp = pct > 0;
  const isGood = isUp ? goodDirection === "up" : goodDirection === "down";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums",
        pct === 0 ? "bg-muted text-muted-foreground" : isGood ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-destructive/15 text-destructive",
      )}
    >
      {isUp ? "+" : ""}
      {pct}%
    </span>
  );
}

function VisitorStat({
  icon,
  title,
  value,
  change,
  goodDirection,
}: {
  icon: typeof UserMultipleIcon;
  title: string;
  value: string;
  change: number | null | undefined;
  goodDirection: "up" | "down";
}) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <HugeiconsIcon icon={icon} className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
          <ChangeBadge pct={change ?? null} goodDirection={goodDirection} />
        </div>
      </CardContent>
    </Card>
  );
}

export function VisitorStats({ data }: { data: VisitorsData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <VisitorStat icon={UserMultipleIcon} title="Visitors" value={fmtNum(data.visitors)} change={data.changes?.visitors} goodDirection="up" />
      <VisitorStat icon={EyeIcon} title="Page Views" value={fmtNum(data.page_views)} change={data.changes?.page_views} goodDirection="up" />
      <VisitorStat
        icon={PercentIcon}
        title="Bounce Rate"
        value={fmtPct((data.bounce_rate ?? 0) * 100, 0)}
        change={data.changes?.bounce_rate}
        goodDirection="down"
      />
    </div>
  );
}

export function VisitorStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i} className="border-border">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-20" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- chart ----------

const chartConfig: ChartConfig = {
  visitors: { label: "Visitors", color: "var(--chart-1)" },
};

function dayLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function VisitorsChart({ series }: { series: NonNullable<VisitorsData["series"]> }) {
  const rows = series.map((s) => ({ day: dayLabel(s.day), visitors: s.visitors, views: s.views }));
  return (
    <Card className="border-border">
      <CardContent className="pt-6">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No page views in this window yet.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
            <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} width={36} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="visitors" type="monotone" stroke="var(--chart-1)" fill="url(#visitorsFill)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- tables ----------

function RankedList({ items, valueLabel }: { items: { name: string; count: number }[]; valueLabel: string }) {
  if (items.length === 0) return <p className="py-6 text-center text-xs text-muted-foreground">No data yet.</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <div className="space-y-1.5">
      {items.map((i) => (
        <div key={i.name} className="relative flex items-center justify-between overflow-hidden rounded-md px-2 py-1.5 text-sm">
          <div
            className="absolute inset-y-0 left-0 bg-muted"
            style={{ width: `${max ? (i.count / max) * 100 : 0}%` }}
            aria-hidden
          />
          <span className="relative truncate">{i.name}</span>
          <span className="relative shrink-0 pl-3 font-mono text-xs text-muted-foreground">{fmtNum(i.count)}</span>
        </div>
      ))}
      <div className="flex justify-end pr-2 text-[10px] uppercase text-muted-foreground">{valueLabel}</div>
    </div>
  );
}

export function TopPagesCard({ pages }: { pages: NonNullable<VisitorsData["top_pages"]> }) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">Pages</CardTitle>
        <span className="text-xs text-muted-foreground">Visitors</span>
      </CardHeader>
      <CardContent>
        <RankedList items={pages.map((p) => ({ name: p.path, count: p.visitors }))} valueLabel="visitors" />
      </CardContent>
    </Card>
  );
}

export function ReferrersCard({ data }: { data: VisitorsData }) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">Referrers</CardTitle>
        <span className="text-xs text-muted-foreground">Visits</span>
      </CardHeader>
      <CardContent>
        {data.referrer_capture_available === false ? (
          <div className="flex items-start gap-2 py-2 text-xs text-muted-foreground">
            <HugeiconsIcon icon={InformationCircleIcon} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Referrer capture isn&apos;t enabled on this server&apos;s proxy yet — every row shows as
              &quot;Direct&quot;. Add the <code className="font-mono">Referer</code> header to the access log to
              turn this on.
            </span>
          </div>
        ) : (
          <RankedList items={(data.referrers ?? []).map((r) => ({ name: r.referrer, count: r.count }))} valueLabel="visits" />
        )}
      </CardContent>
    </Card>
  );
}

export function BreakdownCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: typeof ComputerIcon;
  items: { name: string; count: number }[];
}) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <HugeiconsIcon icon={icon} className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <RankedList items={items} valueLabel="visitors" />
      </CardContent>
    </Card>
  );
}

export function DeviceIcon(name: string): typeof ComputerIcon {
  if (name === "Mobile") return SmartPhone01Icon;
  if (name === "Tablet") return Tablet01Icon;
  return ComputerIcon;
}

export function VisitorsNotConfigured() {
  return (
    <Card className="border-border">
      <CardContent className="flex items-start gap-3 py-6">
        <HugeiconsIcon icon={Link01Icon} className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div>
          <p className="mb-1 text-sm font-medium">Visitor analytics not configured</p>
          <p className="text-sm text-muted-foreground">
            Set up the proxy&apos;s JSON access log (<code className="font-mono">CADDY_ACCESS_LOG</code> on the
            agent) to see visitors, page views and referrers here.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
