"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/status";
import type { TableInfo } from "@/lib/tables";

/** Левая колонка редактора: схемы и таблицы, как в Supabase Table Editor. */
export function TableList({
  tables,
  loading,
  error,
  selected,
  onSelect,
  onNewTable,
}: {
  tables: TableInfo[];
  loading: boolean;
  error: string | null;
  selected: { schema: string; name: string } | null;
  onSelect: (t: TableInfo) => void;
  onNewTable: (schema: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const [schema, setSchema] = React.useState<string>("public");

  const schemas = React.useMemo(() => Array.from(new Set(tables.map((t) => t.schema))).sort(), [tables]);
  React.useEffect(() => {
    if (schemas.length && !schemas.includes(schema)) setSchema(schemas[0]);
  }, [schemas, schema]);

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tables.filter((t) => t.schema === schema && (!needle || t.name.toLowerCase().includes(needle)));
  }, [tables, schema, q]);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border">
      <div className="space-y-2 border-b border-border p-3">
        <select
          aria-label="Schema"
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          value={schema}
          onChange={(e) => setSchema(e.target.value)}
        >
          {schemas.length === 0 ? <option value={schema}>{schema}</option> : null}
          {schemas.map((s) => (
            <option key={s} value={s}>
              schema: {s}
            </option>
          ))}
        </select>
        <Input placeholder="Search tables…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-sm" />
        <button
          onClick={() => onNewTable(schema)}
          className="w-full cursor-pointer rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          + New table
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-3 text-xs text-destructive">{error}</div>
        ) : shown.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">No tables</div>
        ) : (
          shown.map((t) => {
            const active = selected?.schema === t.schema && selected?.name === t.name;
            return (
              <button
                key={`${t.schema}.${t.name}`}
                onClick={() => onSelect(t)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60",
                  active && "bg-muted font-medium",
                )}
                title={`${t.schema}.${t.name}`}
              >
                <span className="truncate">
                  {t.name}
                  {t.kind !== "table" && (
                    <span className="ml-1 text-[10px] uppercase text-muted-foreground">{t.kind === "partitioned" ? "part" : t.kind}</span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmtNum(t.est_rows)}</span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
