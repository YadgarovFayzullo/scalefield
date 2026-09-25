"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, Download01Icon, PlayIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { api, cellToString, downloadText, toCsv, type SqlRunResult } from "@/lib/tables";

const HISTORY_MAX = 50;

type HistoryItem = { q: string; at: number; ok: boolean };

function historyKey(slug: string) {
  return `scalefield:sql-history:${slug}`;
}

function loadHistory(slug: string): HistoryItem[] {
  try {
    const raw = localStorage.getItem(historyKey(slug));
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * SQL-редактор: запрос → `/api/projects/<slug>/sql`. По умолчанию read-only
 * (транзакция READ ONLY на стороне Postgres); запись включается тумблером
 * и подсвечивается. История — в localStorage браузера, на сервер не уходит.
 */
export function SqlEditor({ slug, apiBase }: { slug: string; apiBase: string }) {
  const [query, setQuery] = React.useState("select * from articles order by created_at desc limit 20");
  const [readOnly, setReadOnly] = React.useState(true);
  const [result, setResult] = React.useState<SqlRunResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [active, setActive] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setHistory(loadHistory(slug));
  }, [slug]);

  const pushHistory = (q: string, ok: boolean) => {
    setHistory((h) => {
      const next = [{ q, at: Date.now(), ok }, ...h.filter((x) => x.q !== q)].slice(0, HISTORY_MAX);
      try {
        localStorage.setItem(historyKey(slug), JSON.stringify(next));
      } catch {
        /* приватный режим — история только в памяти */
      }
      return next;
    });
  };

  const run = async () => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<SqlRunResult>(`${apiBase}/sql`, {
        method: "POST",
        body: JSON.stringify({ query: q, read_only: readOnly }),
      });
      setResult(res);
      setActive(res.statements.length - 1);
      pushHistory(q, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      pushHistory(q, false);
    } finally {
      setBusy(false);
    }
  };

  const current = result?.statements[active] ?? null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
      {/* История */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium">
          History
          {history.length > 0 && (
            <button
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              title="Clear history"
              onClick={() => {
                setHistory([]);
                try {
                  localStorage.removeItem(historyKey(slug));
                } catch {
                  /* ignore */
                }
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">Queries you run appear here.</div>
          ) : (
            history.map((h) => (
              <button
                key={h.at}
                onClick={() => {
                  setQuery(h.q);
                  textareaRef.current?.focus();
                }}
                className="block w-full cursor-pointer border-b border-border/60 px-3 py-2 text-left hover:bg-muted/50"
                title={h.q}
              >
                <div className={cn("line-clamp-2 font-mono text-[11px]", !h.ok && "text-destructive")}>{h.q}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(h.at).toLocaleString()}</div>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Редактор */}
        <div className="border-b border-border">
          <textarea
            ref={textareaRef}
            spellCheck={false}
            className="block h-44 w-full resize-y bg-background p-4 font-mono text-sm outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void run();
              }
            }}
            placeholder="select …"
          />
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2">
            <Button size="sm" onClick={() => void run()} disabled={busy || !query.trim()}>
              <HugeiconsIcon icon={PlayIcon} />
              {busy ? "Running…" : "Run"}
            </Button>
            <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter</span>
            <label className="ml-2 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!readOnly} onChange={(e) => setReadOnly(!e.target.checked)} />
              allow writes
            </label>
            {!readOnly && <Badge variant="destructive">write mode: statements commit</Badge>}
            <div className="flex-1" />
            {current && current.columns.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadText(
                    `query-${Date.now()}.csv`,
                    toCsv(
                      current.columns.map((c) => c.name),
                      current.rows,
                    ),
                  )
                }
              >
                <HugeiconsIcon icon={Download01Icon} />
                CSV
              </Button>
            )}
          </div>
        </div>

        {/* Результат */}
        <div className="min-h-0 flex-1 overflow-auto">
          {error ? (
            <pre className="whitespace-pre-wrap p-4 font-mono text-xs text-destructive">{error}</pre>
          ) : !result ? (
            <div className="p-6 text-sm text-muted-foreground">Run a query to see results.</div>
          ) : (
            <>
              {result.statements.length > 1 && (
                <div className="flex gap-1 border-b border-border px-4 py-1.5">
                  {result.statements.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setActive(i)}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs",
                        i === active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {i + 1}. {s.command ?? "?"}
                    </button>
                  ))}
                </div>
              )}
              {current && current.columns.length === 0 ? (
                <div className="p-6 text-sm">
                  <Badge variant="secondary">{current.command ?? "OK"}</Badge>
                  <span className="ml-2 text-muted-foreground">{current.row_count} row(s) affected</span>
                </div>
              ) : current ? (
                <table className="w-max min-w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-background">
                    <tr className="border-b border-border">
                      <th className="w-10 border-r border-border px-2 py-1.5 text-right text-muted-foreground">#</th>
                      {current.columns.map((c, i) => (
                        <th key={i} className="max-w-[320px] border-r border-border px-3 py-1.5 text-left font-medium">
                          <div className="truncate">{c.name}</div>
                          <div className="font-mono text-[10px] font-normal text-muted-foreground">{c.type}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.rows.map((r, i) => (
                      <tr key={i} className="border-b border-border hover:bg-muted/30">
                        <td className="border-r border-border px-2 py-1 text-right text-muted-foreground">{i + 1}</td>
                        {current.columns.map((c, j) => {
                          const v = r[c.name];
                          return (
                            <td key={j} className="max-w-[320px] border-r border-border px-3 py-1 font-mono" title={cellToString(v)}>
                              {v == null ? <span className="italic text-muted-foreground">NULL</span> : <span className="block truncate">{cellToString(v)}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </>
          )}
        </div>
        {result && current && (
          <div className="border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
            {current.command ?? ""} · {current.row_count} row{current.row_count === 1 ? "" : "s"}
            {current.truncated && ` (showing first ${current.rows.length})`} · {result.duration_ms} ms ·{" "}
            {result.read_only ? "read-only" : "write mode"}
          </div>
        )}
      </div>
    </div>
  );
}
