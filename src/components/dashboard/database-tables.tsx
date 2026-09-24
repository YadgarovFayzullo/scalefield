"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { DatabaseData } from "@/lib/status";
import { fmtBytes, fmtNum, fmtPct } from "@/lib/status";
import { cn } from "@/lib/utils";
import { DataTable, DataTd, DataTh, EmptyRow } from "./database-table";

type TableRow = DatabaseData["tables"][number];

const DEAD_ROWS_WARN = 0.1;
const CHART_TOP_N = 10;

const chartConfig = {
  total_bytes: { label: "Size", color: "var(--chart-1)" },
} satisfies ChartConfig;

function deadRatio(t: TableRow): number {
  return t.rows > 0 ? t.dead_rows / t.rows : 0;
}

export function DatabaseTablesCard({ tables }: { tables: DatabaseData["tables"] }) {
  const sorted = React.useMemo(
    () => [...tables].sort((a, b) => b.total_bytes - a.total_bytes),
    [tables]
  );

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Tables</CardTitle>
        <CardDescription>
          {fmtNum(sorted.length)} largest relations, sorted by total size (table + indexes + TOAST)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <DataTable>
          <thead>
            <tr>
              <DataTh className="pl-6">Name</DataTh>
              <DataTh className="text-right">Rows</DataTh>
              <DataTh className="text-right">Size</DataTh>
              <DataTh className="text-right">Heap</DataTh>
              <DataTh className="text-right">Dead rows</DataTh>
              <DataTh className="text-right pr-6">Dead %</DataTh>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <EmptyRow colSpan={6}>No tables reported</EmptyRow>
            ) : (
              sorted.map((t) => {
                const ratio = deadRatio(t);
                const bloated = ratio > DEAD_ROWS_WARN;
                return (
                  <tr key={t.name} className={cn("hover:bg-muted/20", bloated && "bg-red-500/5")}>
                    <DataTd className="pl-6 font-mono text-xs">{t.name}</DataTd>
                    <DataTd className="text-right tabular-nums">{fmtNum(t.rows)}</DataTd>
                    <DataTd className="text-right tabular-nums" title={`${fmtNum(t.total_bytes)} bytes`}>
                      {t.total_pretty}
                    </DataTd>
                    <DataTd className="text-right tabular-nums text-muted-foreground">
                      {fmtBytes(t.table_bytes)}
                    </DataTd>
                    <DataTd className="text-right tabular-nums">{fmtNum(t.dead_rows)}</DataTd>
                    <DataTd
                      className={cn(
                        "text-right tabular-nums pr-6",
                        bloated ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"
                      )}
                    >
                      {t.rows > 0 ? fmtPct(ratio * 100) : "—"}
                    </DataTd>
                  </tr>
                );
              })
            )}
          </tbody>
        </DataTable>
      </CardContent>
    </Card>
  );
}

export function DatabaseSizeChart({ tables }: { tables: DatabaseData["tables"] }) {
  const top = React.useMemo(
    () =>
      [...tables]
        .sort((a, b) => b.total_bytes - a.total_bytes)
        .slice(0, CHART_TOP_N)
        .map((t) => ({ name: t.name, total_bytes: t.total_bytes, total_pretty: t.total_pretty })),
    [tables]
  );

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Largest tables</CardTitle>
        <CardDescription>Top {Math.min(CHART_TOP_N, top.length)} by total size</CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No tables reported</p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[320px] w-full">
            <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="total_bytes"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => fmtBytes(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tickLine={false}
                axisLine={false}
                tick={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11 }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, item) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="font-mono text-xs">{String(item.payload?.name ?? "")}</span>
                        <span className="font-medium tabular-nums">{fmtBytes(Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="total_bytes" fill="var(--color-total_bytes)" radius={4} maxBarSize={22} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
