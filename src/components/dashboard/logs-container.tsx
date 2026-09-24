"use client";

/**
 * Docker container stdout/stderr: `/api/status/container-logs?name=…&tail=300`.
 * The container list comes from the summary metric; the level filter is
 * applied on the client (the endpoint has no level parameter).
 */
import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMetric, fmtTime, type ContainerLogLine, type ContainerLogsData, type SummaryData } from "@/lib/status";
import {
  CopyJsonButton,
  DetailField,
  DetailPanel,
  InlineWarning,
  LevelCounts,
  LevelPill,
  LevelPills,
  LogEmpty,
  LogError,
  LogListSkeleton,
  RefreshControl,
  matchesLevel,
  type LevelFilter,
} from "@/components/dashboard/logs-shared";

const TAIL = 300;

type ContainerOption = { value: string; label: string; status: string };

export function LogsContainerView({
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
  const summary = useMetric<SummaryData>("summary", 30000);
  const containers = React.useMemo<ContainerOption[]>(() => {
    const list = summary.data?.server?.containers ?? [];
    // Running containers first, so the default choice is a live one.
    return [...list]
      .sort((a, b) => Number(b.status === "running") - Number(a.status === "running"))
      .map((c) => ({ value: c.name, label: c.name, status: c.status }));
  }, [summary.data]);

  const [name, setName] = React.useState<string>("");
  React.useEffect(() => {
    if (!name && containers.length > 0) setName(containers[0].value);
  }, [name, containers]);

  const selectItems = React.useMemo(
    () => containers.map((c) => ({ value: c.value, label: c.status === "running" ? c.label : `${c.label} (${c.status})` })),
    [containers]
  );

  const selectControl =
    summary.loading && !summary.data ? (
      <div className="h-8 w-64 rounded-md bg-muted animate-pulse" />
    ) : summary.error && !summary.data ? (
      <span className="text-xs text-red-600 dark:text-red-400">Container list unavailable: {summary.error}</span>
    ) : containers.length === 0 ? (
      <span className="text-xs text-muted-foreground">No containers reported by the server</span>
    ) : (
      <Select value={name} onValueChange={(v: string | null) => { if (v) setName(v); }} items={selectItems}>
        <SelectTrigger size="sm" className="w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {selectItems.map((it) => (
            <SelectItem key={it.value} value={it.value}>
              {it.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

  if (!name) {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-border">
          <LevelPills value={level} onChange={onLevelChange} />
          {selectControl}
        </div>
        <div className="flex-1 overflow-auto">
          {summary.loading && !summary.data ? (
            <LogListSkeleton />
          ) : (
            <LogEmpty title="Select a container" hint="Pick a container to stream its recent output." />
          )}
        </div>
      </div>
    );
  }

  return (
    <ContainerLines
      key={name}
      name={name}
      level={level}
      onLevelChange={onLevelChange}
      search={search}
      auto={auto}
      selectControl={selectControl}
    />
  );
}

function ContainerLines({
  name,
  level,
  onLevelChange,
  search,
  auto,
  selectControl,
}: {
  name: string;
  level: LevelFilter;
  onLevelChange: (v: LevelFilter) => void;
  search: string;
  auto: boolean;
  selectControl: React.ReactNode;
}) {
  const [selected, setSelected] = React.useState<ContainerLogLine | null>(null);
  const { data, error, loading, updatedAt, refresh } = useMetric<ContainerLogsData>(
    `container-logs?name=${encodeURIComponent(name)}&tail=${TAIL}`,
    auto ? 10000 : 0
  );

  const lines = React.useMemo(() => data?.lines ?? [], [data]);
  const q = search.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      lines.filter((ln) => matchesLevel(ln.level, level) && (q ? ln.message.toLowerCase().includes(q) : true)),
    [lines, level, q]
  );

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-border">
          <LevelPills value={level} onChange={onLevelChange} />
          {selectControl}
          <div className="flex-1" />
          {data?.configured && <LevelCounts levels={lines.map((ln) => ln.level)} shown={filtered.length} />}
          <RefreshControl onRefresh={refresh} updatedAt={updatedAt} />
        </div>

        {data?.error && <InlineWarning message={data.error} />}

        <div className="flex-1 overflow-auto">
          {loading && !data ? (
            <LogListSkeleton />
          ) : error && !data ? (
            <LogError message={error} onRetry={refresh} />
          ) : data && !data.configured ? (
            <LogEmpty
              title="Container logs are not available"
              hint="The status API has no access to the Docker socket on this server."
            />
          ) : filtered.length === 0 ? (
            <LogEmpty
              title={lines.length === 0 ? `No output from ${name}` : "No lines match the current filters"}
              hint={lines.length === 0 ? `The last ${TAIL} lines are empty.` : "Search matches the message text."}
            />
          ) : (
            <>
              <div className="grid grid-cols-[190px_60px_1fr] gap-3 px-4 py-1.5 border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Time</span>
                <span>Level</span>
                <span>Message</span>
              </div>
              {filtered.map((ln) => (
                <ContainerRow key={ln.id} line={ln} active={selected?.id === ln.id} onSelect={setSelected} />
              ))}
              {lines.length >= TAIL && (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Showing the last {TAIL} lines of {name}.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selected && <ContainerDetails line={selected} container={name} onClose={() => setSelected(null)} />}
    </>
  );
}

function ContainerRow({
  line,
  active,
  onSelect,
}: {
  line: ContainerLogLine;
  active: boolean;
  onSelect: (ln: ContainerLogLine) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(line)}
      className={`w-full text-left py-2 px-4 border-b border-border hover:bg-muted/50 transition-colors cursor-pointer font-mono ${
        active ? "bg-muted/70" : ""
      }`}
    >
      <div className="grid grid-cols-[190px_60px_1fr] gap-3 items-center text-xs">
        <span className="text-muted-foreground whitespace-nowrap">{fmtTime(line.ts)}</span>
        <LevelPill level={line.level} />
        <span className={`truncate ${line.level === "error" ? "text-red-600 dark:text-red-400" : ""}`} title={line.message}>
          {line.message}
        </span>
      </div>
    </button>
  );
}

function ContainerDetails({
  line,
  container,
  onClose,
}: {
  line: ContainerLogLine;
  container: string;
  onClose: () => void;
}) {
  return (
    <DetailPanel title="Log Line" onClose={onClose}>
      <div>
        <div className="text-xs text-muted-foreground mb-1">Level</div>
        <LevelPill level={line.level} className="py-1" />
      </div>
      <DetailField label="Timestamp">{fmtTime(line.ts)}</DetailField>
      <DetailField label="Container">{container}</DetailField>
      <div>
        <div className="text-xs text-muted-foreground mb-1">Message</div>
        <pre className="text-xs font-mono p-2 bg-muted/50 rounded border border-border whitespace-pre-wrap break-all">
          {line.message}
        </pre>
      </div>
      <DetailField label="Raw timestamp">{line.ts}</DetailField>
      <DetailField label="Line id">{line.id}</DetailField>
      <CopyJsonButton value={{ container, ...line }} />
    </DetailPanel>
  );
}
