"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, COMMON_TYPES, type NewColumn } from "@/lib/tables";

type Draft = { name: string; type: string; nullable: boolean; default: string; pk: boolean };
const emptyCol = (): Draft => ({ name: "", type: "text", nullable: true, default: "", pk: false });

/** Создание таблицы: имя, схема и список колонок; по умолчанию — `id bigserial` как PK. */
export function CreateTableSheet({
  open,
  onOpenChange,
  apiBase,
  schema,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  apiBase: string;
  schema: string;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [cols, setCols] = React.useState<Draft[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setCols([
        { name: "id", type: "bigserial", nullable: false, default: "", pk: true },
        { name: "created_at", type: "timestamptz", nullable: false, default: "now()", pk: false },
      ]);
      setError(null);
    }
  }, [open]);

  const update = (i: number, patch: Partial<Draft>) => setCols((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const columns: NewColumn[] = cols
      .filter((c) => c.name.trim())
      .map((c) => ({ name: c.name.trim(), type: c.type.trim(), nullable: c.nullable, default: c.default.trim() || null, pk: c.pk }));
    try {
      await api(`${apiBase}/tables`, { method: "POST", body: JSON.stringify({ schema, name: name.trim(), columns }) });
      onOpenChange(false);
      onCreated(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New table</SheetTitle>
          <SheetDescription>Schema {schema}. Empty column names are skipped.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
          <div className="space-y-1 text-xs">
            <label className="font-medium">Table name</label>
            <Input className="h-8 font-mono text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="my_table" />
          </div>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-[1fr_1fr_auto_1fr_auto_auto] items-center gap-2 text-[10px] uppercase text-muted-foreground">
              <span>name</span>
              <span>type</span>
              <span>null</span>
              <span>default</span>
              <span>pk</span>
              <span />
            </div>
            {cols.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto_1fr_auto_auto] items-center gap-2">
                <Input className="h-7 font-mono text-xs" value={c.name} onChange={(e) => update(i, { name: e.target.value })} />
                <Input className="h-7 font-mono text-xs" value={c.type} list="sf-create-types" onChange={(e) => update(i, { type: e.target.value })} />
                <input type="checkbox" checked={c.nullable} disabled={c.pk} onChange={(e) => update(i, { nullable: e.target.checked })} />
                <Input className="h-7 font-mono text-xs" value={c.default} onChange={(e) => update(i, { default: e.target.value })} />
                <input type="checkbox" checked={c.pk} onChange={(e) => update(i, { pk: e.target.checked, nullable: e.target.checked ? false : c.nullable })} />
                <button className="cursor-pointer text-muted-foreground hover:text-destructive" title="Remove" onClick={() => setCols((v) => v.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
            <datalist id="sf-create-types">
              {COMMON_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <Button size="sm" variant="outline" onClick={() => setCols((v) => [...v, emptyCol()])}>
              + Column
            </Button>
          </div>
        </div>
        {error && <div className="mx-4 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{error}</div>}
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !name.trim() || cols.every((c) => !c.name.trim())}>
            {busy ? "Creating…" : "Create table"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
