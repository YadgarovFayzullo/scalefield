"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtBytes } from "@/lib/status";
import { api, shortType, COMMON_TYPES, type ColumnInfo, type IndexInfo, type SchemaResult, type TableInfo } from "@/lib/tables";

/**
 * Боковая панель схемы таблицы: колонки (добавить, переименовать, тип,
 * NULL, default, удалить), индексы (создать, удалить), удаление таблицы.
 * Каждое действие — отдельный запрос к `/schema`; ответ содержит свежие
 * колонки и индексы, локальное состояние не угадывается.
 */
export function SchemaSheet({
  open,
  onOpenChange,
  url,
  table,
  onChanged,
  onDropped,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  table: TableInfo;
  onChanged: () => void;
  onDropped: () => void;
}) {
  const [data, setData] = React.useState<SchemaResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [dropOpen, setDropOpen] = React.useState(false);
  const [dropConfirm, setDropConfirm] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setData(await api<SchemaResult>(`${url}/schema`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [url]);

  React.useEffect(() => {
    if (open) {
      setError(null);
      void load();
    }
  }, [open, load]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<SchemaResult & { dropped?: boolean }>(`${url}/schema`, { method: "POST", body: JSON.stringify(body) });
      if (res.dropped) {
        onOpenChange(false);
        onDropped();
        return;
      }
      setData({ columns: res.columns, indexes: res.indexes });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="font-mono">
            {table.schema}.{table.name}
          </SheetTitle>
          <SheetDescription>Columns and indexes. Changes run as DDL immediately.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
          {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{error}</div>}
          {!data ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Columns</h3>
                <div className="divide-y divide-border rounded-md border border-border">
                  {data.columns.map((c) => (
                    <ColumnRow key={c.name} column={c} busy={busy} onAction={act} />
                  ))}
                </div>
                <AddColumnForm busy={busy} onAdd={(column) => act({ action: "add_column", column })} />
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium">Indexes</h3>
                {data.indexes.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No indexes</div>
                ) : (
                  <div className="divide-y divide-border rounded-md border border-border">
                    {data.indexes.map((i) => (
                      <IndexRow key={i.name} index={i} busy={busy} onDrop={() => act({ action: "drop_index", name: i.name })} />
                    ))}
                  </div>
                )}
                <AddIndexForm columns={data.columns} busy={busy} onAdd={(body) => act({ action: "add_index", ...body })} />
              </section>

              {table.kind === "table" && (
                <section className="space-y-2 rounded-md border border-destructive/40 p-3">
                  <h3 className="text-sm font-medium text-destructive">Danger zone</h3>
                  <p className="text-xs text-muted-foreground">Drops the table and all its rows. Type the table name to confirm.</p>
                  <div className="flex items-center gap-2">
                    <Input className="h-8 font-mono text-xs" placeholder={table.name} value={dropConfirm} onChange={(e) => setDropConfirm(e.target.value)} />
                    <Button size="sm" variant="destructive" disabled={busy || dropConfirm !== table.name} onClick={() => setDropOpen(true)}>
                      Drop table
                    </Button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </SheetContent>

      <AlertDialog open={dropOpen} onOpenChange={setDropOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop {table.schema}.{table.name}?</AlertDialogTitle>
            <AlertDialogDescription>The table and every row in it will be gone. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void act({ action: "drop_table" })}>Drop</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

function ColumnRow({
  column: c,
  busy,
  onAction,
}: {
  column: ColumnInfo;
  busy: boolean;
  onAction: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [edit, setEdit] = React.useState(false);
  const [name, setName] = React.useState(c.name);
  const [type, setType] = React.useState(c.type);
  const [nullable, setNullable] = React.useState(c.nullable);
  const [def, setDef] = React.useState(c.default ?? "");
  const [confirmDrop, setConfirmDrop] = React.useState(false);

  React.useEffect(() => {
    setName(c.name);
    setType(c.type);
    setNullable(c.nullable);
    setDef(c.default ?? "");
  }, [c]);

  const save = async () => {
    if (name !== c.name) await onAction({ action: "rename_column", column: c.name, to: name });
    const change: Record<string, unknown> = { action: "alter_column", column: name };
    let changed = false;
    if (type.trim() !== c.type) {
      change.type = type.trim();
      changed = true;
    }
    if (nullable !== c.nullable) {
      change.nullable = nullable;
      changed = true;
    }
    if ((def.trim() || null) !== (c.default ?? null)) {
      change.default = def.trim() || null;
      changed = true;
    }
    if (changed) await onAction(change);
    setEdit(false);
  };

  if (!edit) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
        <span className="font-mono font-medium">{c.name}</span>
        {c.is_pk && <Badge variant="outline">PK</Badge>}
        <span className="font-mono text-muted-foreground">{shortType(c.type)}</span>
        {!c.nullable && <span className="text-[10px] uppercase text-muted-foreground">not null</span>}
        {c.default && (
          <span className="truncate font-mono text-[10px] text-muted-foreground" title={c.default}>
            = {c.default}
          </span>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEdit(true)}>
          Edit
        </Button>
        {confirmDrop ? (
          <>
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => void onAction({ action: "drop_column", column: c.name })}>
              Confirm drop
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDrop(false)}>
              No
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busy || c.is_pk} onClick={() => setConfirmDrop(true)}>
            Drop
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2 bg-muted/30 px-3 py-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <Input className="h-7 font-mono text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="name" />
        <Input className="h-7 font-mono text-xs" value={type} onChange={(e) => setType(e.target.value)} placeholder="type" list="sf-types" />
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={nullable} onChange={(e) => setNullable(e.target.checked)} /> nullable
        </label>
        <Input className="h-7 font-mono text-xs" value={def} onChange={(e) => setDef(e.target.value)} placeholder="default expression (empty = none)" />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>
          Cancel
        </Button>
        <Button size="sm" disabled={busy || !name.trim() || !type.trim()} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  );
}

function AddColumnForm({ busy, onAdd }: { busy: boolean; onAdd: (c: { name: string; type: string; nullable: boolean; default: string | null }) => Promise<void> }) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("text");
  const [nullable, setNullable] = React.useState(true);
  const [def, setDef] = React.useState("");
  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3 text-xs">
      <div className="font-medium">Add column</div>
      <div className="grid grid-cols-2 gap-2">
        <Input className="h-7 font-mono text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="name" />
        <Input className="h-7 font-mono text-xs" value={type} onChange={(e) => setType(e.target.value)} placeholder="type" list="sf-types" />
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={nullable} onChange={(e) => setNullable(e.target.checked)} /> nullable
        </label>
        <Input className="h-7 font-mono text-xs" value={def} onChange={(e) => setDef(e.target.value)} placeholder="default (optional)" />
      </div>
      <datalist id="sf-types">
        {COMMON_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={busy || !name.trim() || !type.trim()}
          onClick={async () => {
            await onAdd({ name: name.trim(), type: type.trim(), nullable, default: def.trim() || null });
            setName("");
            setDef("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function IndexRow({ index: i, busy, onDrop }: { index: IndexInfo; busy: boolean; onDrop: () => void }) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium">{i.name}</span>
          {i.primary && <Badge variant="outline">PK</Badge>}
          {i.unique && !i.primary && <Badge variant="secondary">unique</Badge>}
          <span className="text-muted-foreground">{fmtBytes(i.size_bytes)}</span>
        </div>
        <div className="truncate font-mono text-[10px] text-muted-foreground" title={i.definition}>
          {i.definition}
        </div>
      </div>
      {!i.primary &&
        (confirm ? (
          <>
            <Button size="sm" variant="destructive" disabled={busy} onClick={onDrop}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              No
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => setConfirm(true)}>
            Drop
          </Button>
        ))}
    </div>
  );
}

function AddIndexForm({
  columns,
  busy,
  onAdd,
}: {
  columns: ColumnInfo[];
  busy: boolean;
  onAdd: (body: { name?: string; columns: string[]; unique: boolean }) => Promise<void>;
}) {
  const [cols, setCols] = React.useState<string[]>([]);
  const [unique, setUnique] = React.useState(false);
  const [name, setName] = React.useState("");
  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3 text-xs">
      <div className="font-medium">Add index</div>
      <div className="flex flex-wrap gap-2">
        {columns.map((c) => (
          <label key={c.name} className="flex items-center gap-1 rounded border border-border px-2 py-0.5 font-mono">
            <input
              type="checkbox"
              checked={cols.includes(c.name)}
              onChange={(e) => setCols((v) => (e.target.checked ? [...v, c.name] : v.filter((x) => x !== c.name)))}
            />
            {c.name}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Input className="h-7 w-56 font-mono text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="index name (optional)" />
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} /> unique
        </label>
        <div className="flex-1" />
        <Button
          size="sm"
          disabled={busy || cols.length === 0}
          onClick={async () => {
            await onAdd({ name: name.trim() || undefined, columns: cols, unique });
            setCols([]);
            setName("");
          }}
        >
          Create
        </Button>
      </div>
    </div>
  );
}
