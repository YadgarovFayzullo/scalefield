"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import { CpuIcon, HardDriveIcon, ServerStack01Icon, ArrowDataTransferHorizontalIcon } from "@hugeicons/core-free-icons";
import { fmtBytes, fmtDuration, fmtPct, fmtTime } from "@/lib/status";
import type { ServerData } from "@/lib/status";
import { UsageBar } from "./monitoring-shared";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

const perCpuConfig = { load: { label: "Load", color: "hsl(var(--chart-1))" } };

export function MonitoringHost({ server }: { server: ServerData }) {
  const perCpu = React.useMemo(
    () => server.per_cpu.map((load, i) => ({ core: `${i}`, load })),
    [server.per_cpu]
  );
  const [l1, l5, l15] = server.load_avg;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* CPU */}
      <Card className="border-border md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={CpuIcon} className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">CPU</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">{server.cpu_count} cores</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="text-2xl font-semibold tabular-nums">{fmtPct(server.cpu_pct)}</div>
            <div className="text-xs text-muted-foreground">
              load {l1.toFixed(2)} / {l5.toFixed(2)} / {l15.toFixed(2)}
            </div>
          </div>
          <UsageBar pct={server.cpu_pct} />
          <ChartContainer config={perCpuConfig} className="h-20 w-full">
            <BarChart data={perCpu} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="core" tickLine={false} axisLine={false} fontSize={10} interval={0} />
              <YAxis domain={[0, 100]} hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    labelFormatter={(v: React.ReactNode) => `Core ${v}`}
                    formatter={(v) => fmtPct(typeof v === "number" ? v : Number(v))}
                  />
                }
              />
              <Bar dataKey="load" fill="hsl(142.1 76.2% 36.3%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Memory */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={ServerStack01Icon} className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Memory</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-2xl font-semibold tabular-nums">{fmtPct(server.mem.pct)}</div>
          <UsageBar pct={server.mem.pct} />
          <div className="space-y-1.5">
            <Stat label="Used" value={`${fmtBytes(server.mem.used)} / ${fmtBytes(server.mem.total)}`} />
            <Stat label="Available" value={fmtBytes(server.mem.available)} />
            <Stat
              label="Swap"
              value={
                server.swap.total > 0
                  ? `${fmtBytes(server.swap.used)} / ${fmtBytes(server.swap.total)} (${fmtPct(server.swap.pct, 0)})`
                  : "none"
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Disk */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={HardDriveIcon} className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Disk</CardTitle>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{server.disk.path}</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-2xl font-semibold tabular-nums">{fmtPct(server.disk.pct)}</div>
          <UsageBar pct={server.disk.pct} />
          <div className="space-y-1.5">
            <Stat label="Used" value={`${fmtBytes(server.disk.used)} / ${fmtBytes(server.disk.total)}`} />
            <Stat label="Free" value={fmtBytes(server.disk.free)} />
          </div>
        </CardContent>
      </Card>

      {/* Network + uptime */}
      <Card className="border-border md:col-span-2 lg:col-span-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Network & Uptime</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">counters since boot</span>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Sent</div>
              <div className="text-sm font-medium tabular-nums">{fmtBytes(server.net.bytes_sent)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Received</div>
              <div className="text-sm font-medium tabular-nums">{fmtBytes(server.net.bytes_recv)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Host uptime</div>
              <div className="text-sm font-medium tabular-nums">{fmtDuration(server.uptime_s)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Booted</div>
              <div className="text-sm font-medium tabular-nums">{fmtTime(server.boot_time)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
