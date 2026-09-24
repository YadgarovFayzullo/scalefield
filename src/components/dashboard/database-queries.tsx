"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DatabaseData } from "@/lib/status";
import { fmtDuration, fmtMs, fmtNum } from "@/lib/status";
import { cn } from "@/lib/utils";
import { DataTable, DataTd, DataTh, EmptyRow } from "./database-table";

const QUERY_MAX_CHARS = 160;
const LONG_QUERY_WARN_S = 60;

function truncateQuery(q: string): string {
  const oneLine = q.replace(/\s+/g, " ").trim();
  return oneLine.length > QUERY_MAX_CHARS ? `${oneLine.slice(0, QUERY_MAX_CHARS)}…` : oneLine;
}

function QueryCell({ query }: { query: string }) {
  return (
    <code className="block max-w-[520px] truncate font-mono text-xs text-foreground/90" title={query}>
      {truncateQuery(query)}
    </code>
  );
}

function stateVariant(state: string): "default" | "secondary" | "outline" {
  if (state === "active") return "default";
  if (state.startsWith("idle in transaction")) return "outline";
  return "secondary";
}

export function LongestRunningCard({ items }: { items: DatabaseData["longest_running"] }) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Longest running queries</CardTitle>
        <CardDescription>Backends from pg_stat_activity, ordered by duration</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <DataTable>
          <thead>
            <tr>
              <DataTh className="pl-6">PID</DataTh>
              <DataTh className="text-right">Duration</DataTh>
              <DataTh>State</DataTh>
              <DataTh className="w-full pr-6">Query</DataTh>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <EmptyRow colSpan={4}>No long-running queries</EmptyRow>
            ) : (
              items.map((q) => {
                const slow = q.dur_s >= LONG_QUERY_WARN_S;
                return (
                  <tr key={q.pid} className="hover:bg-muted/20">
                    <DataTd className="pl-6 font-mono text-xs tabular-nums">{q.pid}</DataTd>
                    <DataTd
                      className={cn(
                        "text-right tabular-nums whitespace-nowrap",
                        slow && "font-medium text-red-600 dark:text-red-400"
                      )}
                    >
                      {fmtDuration(q.dur_s)}
                    </DataTd>
                    <DataTd>
                      <Badge variant={stateVariant(q.state)}>{q.state}</Badge>
                    </DataTd>
                    <DataTd className="pr-6">
                      <QueryCell query={q.query} />
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

export function SlowQueriesCard({
  items,
  available,
}: {
  items: DatabaseData["slow_queries"];
  available: boolean;
}) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Slow queries</CardTitle>
        <CardDescription>Statements with the highest mean execution time (pg_stat_statements)</CardDescription>
      </CardHeader>
      <CardContent className={cn(available && "px-0")}>
        {!available ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
            <p className="text-sm font-medium">pg_stat_statements extension is not installed</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add it to <code className="font-mono">shared_preload_libraries</code> and run{" "}
              <code className="font-mono">CREATE EXTENSION pg_stat_statements</code> to collect per-statement timings.
            </p>
          </div>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <DataTh className="w-full pl-6">Query</DataTh>
                <DataTh className="text-right">Calls</DataTh>
                <DataTh className="text-right">Mean</DataTh>
                <DataTh className="text-right">Total</DataTh>
                <DataTh className="text-right pr-6">Rows</DataTh>
              </tr>
            </thead>
            <tbody>
              {!items || items.length === 0 ? (
                <EmptyRow colSpan={5}>No statements recorded yet</EmptyRow>
              ) : (
                items.map((q, i) => (
                  <tr key={`${i}-${q.query.slice(0, 40)}`} className="hover:bg-muted/20">
                    <DataTd className="pl-6">
                      <QueryCell query={q.query} />
                    </DataTd>
                    <DataTd className="text-right tabular-nums">{fmtNum(q.calls)}</DataTd>
                    <DataTd className="text-right tabular-nums whitespace-nowrap">{fmtMs(q.mean_ms)}</DataTd>
                    <DataTd className="text-right tabular-nums whitespace-nowrap">{fmtMs(q.total_ms)}</DataTd>
                    <DataTd className="text-right tabular-nums pr-6">{fmtNum(q.rows)}</DataTd>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        )}
      </CardContent>
    </Card>
  );
}
