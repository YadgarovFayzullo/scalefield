"use client";

import * as React from "react";
import { useProject } from "@/lib/project-context";
import { api, type TableInfo, type TablesResult } from "@/lib/tables";
import { TableList } from "@/components/dashboard/table-editor-list";
import { TableGrid } from "@/components/dashboard/table-editor-grid";
import { CreateTableSheet } from "@/components/dashboard/table-editor-create";
import { ConnectDatabase, NO_DATABASE } from "@/components/dashboard/connect-database";

/** Редактор таблиц базы проекта (аналог Table Editor в Supabase). */
export default function TablesPage() {
  const { apiBase } = useProject();
  const [tables, setTables] = React.useState<TableInfo[]>([]);
  const [dbName, setDbName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<TableInfo | null>(null);
  const [createFor, setCreateFor] = React.useState<string | null>(null);

  const reload = React.useCallback(async (): Promise<TableInfo[]> => {
    try {
      const res = await api<TablesResult>(`${apiBase}/tables`);
      setTables(res.tables);
      setDbName(res.database.name);
      setError(null);
      return res.tables;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return [];
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
      <TableList
        tables={tables}
        loading={loading}
        error={error}
        selected={selected}
        onSelect={setSelected}
        onNewTable={(schema) => setCreateFor(schema)}
      />
      <CreateTableSheet
        open={createFor !== null}
        onOpenChange={(v) => !v && setCreateFor(null)}
        apiBase={apiBase}
        schema={createFor ?? "public"}
        onCreated={async (name) => {
          const list = await reload();
          const t = list.find((x) => x.schema === (createFor ?? "public") && x.name === name);
          if (t) setSelected(t);
        }}
      />
      {selected ? (
        <TableGrid
          key={`${selected.schema}.${selected.name}`}
          apiBase={apiBase}
          table={selected}
          onSchemaChanged={() => void reload()}
          onDropped={() => {
            setSelected(null);
            void reload();
          }}
        />
      ) : error === NO_DATABASE ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <ConnectDatabase
            onConnected={() => {
              setLoading(true);
              void reload();
            }}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {error ? error : dbName ? `Database ${dbName} — pick a table` : "Pick a table"}
        </div>
      )}
    </div>
  );
}
