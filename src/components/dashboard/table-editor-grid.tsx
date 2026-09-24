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
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowDown01Icon, ArrowUp01Icon, Delete02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/status";
import {
  api,
  cellToString,
  pkValues,
  rowKey,
  shortType,
  FILTER_OPS,
  type CellValue,
  type FilterOp,
  type RowsResult,
  type TableInfo,
} from "@/lib/tables";
import { InsertRowSheet } from "./table-editor-insert";

const PAGE_SIZE = 50;

type Filter = { column: string; op: FilterOp; value: string };

/**
 * Сетка данных таблицы: страницы, сортировка по клику на колонку, фильтр,
 * правка ячейки по двойному клику, вставка и удаление строк. Таблицы без
 * первичного ключа и представления — только чтение: без PK строку нельзя
 * адресовать однозначно.
 */
export function TableGrid({ apiBase, table }: { apiBase: string; table: TableInfo }) {
  const url = `${apiBase}/tables/${encodeURIComponent(table.schema)}/${encodeURIComponent(table.name)}`;
  const [offset, setOffset] = React.useState(0);
  const [order, setOrder] = React.useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const [draft, setDraft] = React.useState<Filter>({ column: "", op: "eq", value: "" });
  const [filter, setFilter] = React.useState<Filter | null>(null);
  const [data, setData] = React.useState<RowsResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [editing, setEditing] = React.useState<{ key: string; col: string } | null>(null);
  const [insertOpen, setInsertOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (order) {
      sp.set("order", order.col);
      sp.set("dir", order.dir);
    }
    if (filter) {
      sp.set("fcol", filter.column);
      sp.set("fop", filter.op);
      sp.set("fval", filter.value);
    }
    try {
      const res = await api<RowsResult>(`${url}?${sp.toString()}`);
      setData(res);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [url, offset, order, filter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const readOnly = table.kind === "view" || table.kind === "matview" || (data ? data.pk.length === 0 : true);
  const columns = data?.columns ?? [];
  const pk = data?.pk ?? [];
  const rows = data?.rows ?? [];

  const toggleSort = (col: string) => {
    setOffset(0);
    setOrder((o) => (o?.col === col ? { col, dir: o.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));
  };

  const applyFilter = () => {
    setOffset(0);
    if (!draft.column) setFilter(null);
    else setFilter({ ...draft });
  };
  const clearFilter = () => {
    setDraft({ column: "", op: "eq", value: "" });
    setFilter(null);
    setOffset(0);
  };

  const saveCell = async (row: Record<string, unknown>, col: string, value: CellValue) => {
    setNotice(null);
    try {
      const res = await api<{ row: Record<string, unknown> }>(url, {
        method: "PATCH",
        body: JSON.stringify({ pk: pkValues(row, pk), set: { [col]: value } }),
      });
      setData((d) =>
        d ? { ...d, rows: d.rows.map((r) => (rowKey(r, pk) === rowKey(row, pk) ? res.row : r)) } : d,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setEditing(null);
    }
  };

  const deleteSelected = async () => {
    const keys = rows.filter((r) => selected.has(rowKey(r, pk))).map((r) => pkValues(r, pk));
    setDeleteOpen(false);
    setNotice(null);
    try {
      const res = await api<{ deleted: number }>(url, { method: "DELETE", body: JSON.stringify({ keys }) });
      setNotice(`Deleted ${res.deleted} row${res.deleted === 1 ? "" : "s"}`);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(rowKey(r, pk)));
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + rows.length, offset + PAGE_SIZE);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Шапка: имя таблицы, статус, действия */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <div className="mr-2 flex items-center gap-2">
          <span className="font-mono text-sm font-medium">
            {table.schema}.{table.name}
          </span>
          {readOnly ? (
            <Badge variant="secondary">read-only</Badge>
          ) : (
            <Badge variant="outline">PK: {pk.join(", ")}</Badge>
          )}
        </div>
        <div className="flex-1" />
        {selected.size > 0 && !readOnly && (
          <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
            <HugeiconsIcon icon={Delete02Icon} />
            Delete {selected.size}
          </Button>
        )}
        {!readOnly && (
          <Button size="sm" onClick={() => setInsertOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} />
            Insert row
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <HugeiconsIcon icon={RefreshIcon} className={loading ? "animate-spin" : undefined} />
        </Button>
      </div>

      {/* Фильтр */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-sm">
        <select
          aria-label="Filter column"
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          value={draft.column}
          onChange={(e) => setDraft((d) => ({ ...d, column: e.target.value }))}
        >
          <option value="">Filter column…</option>
          {columns.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Operator"
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          value={draft.op}
          onChange={(e) => setDraft((d) => ({ ...d, op: e.target.value as FilterOp }))}
        >
          {FILTER_OPS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {FILTER_OPS.find((o) => o.value === draft.op)?.needsValue && (
          <Input
            className="h-8 w-56 font-mono text-xs"
            placeholder="value"
            value={draft.value}
            onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilter();
            }}
          />
        )}
        <Button size="sm" variant="outline" onClick={applyFilter} disabled={!draft.column}>
          Apply
        </Button>
        {filter && (
          <Button size="sm" variant="ghost" onClick={clearFilter}>
            Clear
          </Button>
        )}
        {notice && <span className="ml-auto text-xs text-muted-foreground">{notice}</span>}
      </div>

      {/* Сетка */}
      <div className="min-h-0 flex-1 overflow-auto">
        {error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : !data && loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <table className="w-max min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border">
                <th className="w-8 border-r border-border px-2 py-1.5">
                  {!readOnly && (
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(rows.map((r) => rowKey(r, pk))) : new Set())
                      }
                    />
                  )}
                </th>
                {columns.map((c) => (
                  <th
                    key={c.name}
                    className="max-w-[320px] cursor-pointer select-none border-r border-border px-3 py-1.5 text-left font-medium hover:bg-muted/50"
                    onClick={() => toggleSort(c.name)}
                    title={`${c.type}${c.nullable ? ", nullable" : ""}${c.default ? `, default ${c.default}` : ""}`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="truncate">{c.name}</span>
                      {c.is_pk && <span className="text-[9px] text-muted-foreground">PK</span>}
                      {order?.col === c.name && (
                        <HugeiconsIcon icon={order.dir === "asc" ? ArrowUp01Icon : ArrowDown01Icon} className="h-3 w-3" />
                      )}
                    </div>
                    <div className="font-mono text-[10px] font-normal text-muted-foreground">{shortType(c.type)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={cn(loading && "opacity-50")}>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="p-6 text-center text-muted-foreground">
                    No rows
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const key = rowKey(r, pk);
                  const isSel = selected.has(key);
                  return (
                    <tr key={key} className={cn("border-b border-border hover:bg-muted/30", isSel && "bg-muted/50")}>
                      <td className="border-r border-border px-2 py-1 text-center">
                        {!readOnly && (
                          <input
                            type="checkbox"
                            aria-label="Select row"
                            checked={isSel}
                            onChange={(e) =>
                              setSelected((s) => {
                                const n = new Set(s);
                                if (e.target.checked) n.add(key);
                                else n.delete(key);
                                return n;
                              })
                            }
                          />
                        )}
                      </td>
                      {columns.map((c) => {
                        const v = r[c.name];
                        const isEditing = editing?.key === key && editing.col === c.name;
                        return (
                          <td
                            key={c.name}
                            className={cn(
                              "max-w-[320px] border-r border-border px-3 py-1 font-mono",
                              !readOnly && !c.is_pk && "cursor-text",
                            )}
                            onDoubleClick={() => {
                              if (!readOnly && !isEditing) setEditing({ key, col: c.name });
                            }}
                            title={cellToString(v)}
                          >
                            {isEditing ? (
                              <CellEditor
                                initial={v == null ? null : cellToString(v)}
                                nullable={c.nullable}
                                onCancel={() => setEditing(null)}
                                onSave={(val) => void saveCell(r, c.name, val)}
                              />
                            ) : v == null ? (
                              <span className="italic text-muted-foreground">NULL</span>
                            ) : (
                              <span className="block truncate">{cellToString(v)}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Пагинация */}
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          {from}–{to} of {data?.total_exact ? "" : "~"}
          {fmtNum(total)} rows
          {!readOnly && " · double-click a cell to edit"}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
            Prev
          </Button>
          <Button size="sm" variant="outline" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>
            Next
          </Button>
        </div>
      </div>

      <InsertRowSheet open={insertOpen} onOpenChange={setInsertOpen} url={url} columns={columns} onInserted={() => void load()} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} row{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Rows are deleted from {table.schema}.{table.name} immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteSelected()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Инлайн-редактор ячейки: Enter — сохранить, Esc — отмена, кнопка ∅ — NULL. */
function CellEditor({
  initial,
  nullable,
  onSave,
  onCancel,
}: {
  initial: string | null;
  nullable: boolean;
  onSave: (v: CellValue) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initial ?? "");
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        className="h-6 w-full min-w-[160px] rounded border border-ring bg-background px-1 font-mono text-xs outline-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(value);
          if (e.key === "Escape") onCancel();
        }}
        onBlur={(e) => {
          // Клик по кнопкам рядом не должен закрывать редактор.
          if (e.relatedTarget && (e.relatedTarget as HTMLElement).dataset.cellBtn) return;
          onCancel();
        }}
      />
      {nullable && (
        <button data-cell-btn="1" className="rounded border border-border px-1 text-[10px]" title="Set NULL" onMouseDown={(e) => e.preventDefault()} onClick={() => onSave(null)}>
          ∅
        </button>
      )}
      <button data-cell-btn="1" className="rounded border border-border px-1 text-[10px]" title="Save" onMouseDown={(e) => e.preventDefault()} onClick={() => onSave(value)}>
        ✓
      </button>
    </div>
  );
}
