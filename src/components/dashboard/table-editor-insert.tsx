"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api, shortType, type CellValue, type ColumnInfo } from "@/lib/tables";

/**
 * Форма вставки строки. Пустое поле = колонка не передаётся (сработает
 * default/identity); переключатель NULL шлёт явный NULL. Так пустая строка
 * остаётся допустимым значением для text-колонок.
 */
export function InsertRowSheet({
  open,
  onOpenChange,
  url,
  columns,
  onInserted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  columns: ColumnInfo[];
  onInserted: () => void;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [nulls, setNulls] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setValues({});
      setNulls({});
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    const payload: Record<string, CellValue> = {};
    for (const c of columns) {
      if (nulls[c.name]) payload[c.name] = null;
      else if ((values[c.name] ?? "") !== "") payload[c.name] = values[c.name];
    }
    setBusy(true);
    setError(null);
    try {
      await api(url, { method: "POST", body: JSON.stringify({ values: payload }) });
      onOpenChange(false);
      onInserted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Insert row</SheetTitle>
          <SheetDescription>Leave a field empty to use the column default.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4">
          {columns.map((c) => (
            <div key={c.name} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <label className="font-medium">
                  {c.name}
                  {c.is_pk && <span className="ml-1 text-muted-foreground">PK</span>}
                </label>
                <span className="font-mono text-muted-foreground">{shortType(c.type)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 font-mono text-xs"
                  disabled={Boolean(nulls[c.name])}
                  placeholder={c.default ? `default: ${c.default}` : c.has_default ? "auto" : c.nullable ? "NULL" : "required"}
                  value={values[c.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [c.name]: e.target.value }))}
                />
                {c.nullable && (
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(nulls[c.name])}
                      onChange={(e) => setNulls((n) => ({ ...n, [c.name]: e.target.checked }))}
                    />
                    NULL
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
        {error && <div className="mx-4 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{error}</div>}
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
