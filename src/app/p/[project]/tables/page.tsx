"use client";

import * as React from "react";
import { useProject } from "@/lib/project-context";
import { api, type TableInfo, type TablesResult } from "@/lib/tables";
import { TableList } from "@/components/dashboard/table-editor-list";
import { TableGrid } from "@/components/dashboard/table-editor-grid";

/** Редактор таблиц базы проекта (аналог Table Editor в Supabase). */
export default function TablesPage() {
  const { apiBase } = useProject();
  const [tables, setTables] = React.useState<TableInfo[]>([]);
  const [dbName, setDbName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<TableInfo | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api<TablesResult>(`${apiBase}/tables`);
        if (!alive) return;
        setTables(res.tables);
        setDbName(res.database.name);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [apiBase]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
      <TableList tables={tables} loading={loading} error={error} selected={selected} onSelect={setSelected} />
      {selected ? (
        <TableGrid key={`${selected.schema}.${selected.name}`} apiBase={apiBase} table={selected} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {error ? error : dbName ? `Database ${dbName} — pick a table` : "Pick a table"}
        </div>
      )}
    </div>
  );
}
