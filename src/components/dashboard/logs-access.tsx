"use client";

/**
 * Proxy (Traefik) access log: `/api/status/logs`. The level filter is applied
 * on the server (`warn` = 4xx+5xx, `error` = 5xx); host is an exact match.
 */
import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMetric, fmtBytes, fmtMs, fmtTime, type AccessLogItem, type AccessLogsData } from "@/lib/status";
import {
  CopyJsonButton,
  DetailField,
  DetailPanel,
  DetailSection,
  LevelCounts,
  LevelPill,
  LevelPills,
  LogEmpty,
  LogError,
  LogListSkeleton,
  RefreshControl,
  statusText,
  type LevelFilter,
} from "@/components/dashboard/logs-shared";

const ALL_HOSTS = "all";
const ALL_ITEM = { value: ALL_HOSTS, label: "All hosts" };

const LIMIT = 300;
const PAGE_SIZE = 20;

export function LogsAccessView({
  level,
  onLevelChange,
  search,
  auto,
}: {
  level: LevelFilter;
  onLevelChange: (v: LevelFilter) => void;
  search: string;
  auto: boolean;
}) {
  const [host, setHost] = React.useState<string>(ALL_HOSTS);
  const [selected, setSelected] = React.useState<AccessLogItem | null>(null);

  const hostParam = host === ALL_HOSTS ? "" : host;
  const { data, error, loading, updatedAt, refresh } = useMetric<AccessLogsData>(
    `logs?limit=${LIMIT}&level=${level}&host=${encodeURIComponent(hostParam)}`,
    auto ? 10000 : 0
  );

  const items = React.useMemo(() => data?.items ?? [], [data]);
  // Хосты в фильтре — те, что реально встретились в логе: список копится по
  // мере поллинга, чтобы выбор одного хоста не прятал остальные из выпадашки.
  const [knownHosts, setKnownHosts] = React.useState<string[]>([]);
  React.useEffect(() => {
    const fresh = items.map((it) => it.host).filter(Boolean);
    if (fresh.length === 0) return;
    setKnownHosts((prev) => {
      const merged = Array.from(new Set([...prev, ...fresh])).sort();
      return merged.length === prev.length ? prev : merged;
    });
  }, [items]);
  const hostItems = React.useMemo(
    () => [ALL_ITEM, ...knownHosts.map((h) => ({ value: h, label: h }))],
    [knownHosts],
  );
  const q = search.trim().toLowerCase();
  const filtered = React.useMemo(
    () => (q ? items.filter((it) => it.path.toLowerCase().includes(q)) : items),
    [items, q]
  );

  // Пагинация на клиенте по загруженным LIMIT записям; смена фильтров — на первую страницу.
  const [page, setPage] = React.useState(0);
  React.useEffect(() => setPage(0), [level, host, q]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-border">
          <LevelPills value={level} onChange={onLevelChange} />
          <Select value={host} onValueChange={(v: string | null) => setHost(v ?? ALL_HOSTS)} items={hostItems}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {hostItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          {data?.configured && <LevelCounts levels={items.map((it) => it.level)} shown={filtered.length} />}
          <RefreshControl onRefresh={refresh} updatedAt={updatedAt} />
        </div>

        <div className="flex-1 overflow-auto">
          {loading && !data ? (
            <LogListSkeleton />
          ) : error && !data ? (
            <LogError message={error} onRetry={refresh} />
          ) : data && !data.configured ? (
            <LogEmpty
              title="Access log is not configured on the server"
              hint="Set the access log path in the status API to see proxy requests here."
            />
          ) : filtered.length === 0 ? (
            <LogEmpty
              title={items.length === 0 ? "No requests in the access log" : "No entries match your search"}
              hint={items.length === 0 ? "Try a different level or host filter." : "Search matches the request path."}
            />
          ) : (
            <>
              <div className="grid grid-cols-[150px_60px_60px_50px_1fr_72px_150px] gap-3 px-4 py-1.5 border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Time</span>
                <span>Level</span>
                <span>Method</span>
                <span>Status</span>
                <span>Path</span>
                <span className="text-right">Duration</span>
                <span>Host</span>
              </div>
              {pageItems.map((it) => (
                <AccessRow key={it.id} item={it} active={selected?.id === it.id} onSelect={setSelected} />
              ))}
              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-3 p-3 text-xs text-muted-foreground">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Previous page"
                    disabled={current === 0}
                    onClick={() => setPage(current - 1)}
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
                  </Button>
                  <span className="tabular-nums">
                    {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + pageItems.length} of {filtered.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Next page"
                    disabled={current >= pageCount - 1}
                    onClick={() => setPage(current + 1)}
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {items.length >= LIMIT && current === pageCount - 1 && (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Showing the latest {LIMIT} requests. Narrow the level or host to see older ones.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selected && <AccessDetails item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function AccessRow({
  item,
  active,
  onSelect,
}: {
  item: AccessLogItem;
  active: boolean;
  onSelect: (it: AccessLogItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full text-left py-2 px-4 border-b border-border hover:bg-muted/50 transition-colors cursor-pointer font-mono ${
        active ? "bg-muted/70" : ""
      }`}
    >
      <div className="grid grid-cols-[150px_60px_60px_50px_1fr_72px_150px] gap-3 items-center text-xs">
        <span className="text-muted-foreground whitespace-nowrap">{fmtTime(item.ts)}</span>
        <LevelPill level={item.level} />
        <span className="font-medium">{item.method}</span>
        <span className={`font-semibold ${statusText(item.status)}`}>{item.status}</span>
        <span className="truncate" title={item.path}>
          {item.path}
        </span>
        <span className="text-right text-muted-foreground whitespace-nowrap">{fmtMs(item.dur_ms)}</span>
        <span className="truncate text-muted-foreground" title={item.host}>
          {item.host}
        </span>
      </div>
    </button>
  );
}

function AccessDetails({ item, onClose }: { item: AccessLogItem; onClose: () => void }) {
  return (
    <DetailPanel title="Request Details" onClose={onClose}>
      <div>
        <div className="text-xs text-muted-foreground mb-1">Level</div>
        <LevelPill level={item.level} className="py-1" />
      </div>
      <DetailField label="Timestamp">{fmtTime(item.ts)}</DetailField>
      <DetailField label="Request">
        {item.method} {item.path}
      </DetailField>
      <DetailField label="Status" className={statusText(item.status)}>
        {item.status}
      </DetailField>
      <DetailField label="Duration">{fmtMs(item.dur_ms)}</DetailField>

      <DetailSection title="CONNECTION" />
      <DetailField label="Host">{item.host}</DetailField>
      <DetailField label="Client IP">{item.client}</DetailField>
      <DetailField label="Router">{item.router || "—"}</DetailField>
      <DetailField label="Response size">
        {fmtBytes(item.size)} <span className="text-muted-foreground">({item.size} B)</span>
      </DetailField>
      <DetailField label="User agent">{item.ua || "—"}</DetailField>
      <DetailField label="Entry id">{item.id}</DetailField>

      <CopyJsonButton value={item} />
    </DetailPanel>
  );
}
