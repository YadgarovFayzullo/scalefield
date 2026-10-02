import Link from "next/link";
import { fmtBytes, fmtPct } from "@/lib/format";
import type { ServerUsage } from "@/lib/servers-usage";
import { machines, totals, type Metric } from "@/lib/usage";
import { Ring } from "@/components/dashboard/usage-ring";

/**
 * Блок Usage на списке проектов — как в Vercel: общий итог по всем серверам
 * команды (кольцо + used/total), каждая строка ведёт на страницу своего
 * ресурса (/usage/<metric>) с разбивкой по серверам и контейнерам.
 */
function Row({ metric, label, used, total, pct, invert }: { metric: Metric; label: string; used: string; total: string; pct: number; invert?: boolean }) {
  return (
    <Link
      href={`/usage/${metric}`}
      className="-mx-2 flex items-center gap-2.5 rounded-md border-b border-border/60 px-2 py-2 transition-colors last:border-0 hover:bg-muted/50"
    >
      <Ring pct={pct} invert={invert} />
      <span className="flex-1 truncate text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">
        {used} <span className="text-muted-foreground">/ {total}</span>
      </span>
    </Link>
  );
}

export function UsageCard({ servers }: { servers: ServerUsage[] }) {
  const ms = machines(servers);
  const t = totals(ms);
  const unreachable = servers.filter((s) => s.error).length;

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Usage</h2>
        {ms.length > 0 && (
          <Link href="/servers" className="text-xs text-muted-foreground hover:text-foreground">
            {ms.length} {ms.length === 1 ? "server" : "servers"}
          </Link>
        )}
      </div>
      {servers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No servers registered yet.</p>
      ) : ms.length === 0 ? (
        <p className="text-xs text-muted-foreground">Servers are unreachable right now.</p>
      ) : (
        <div>
          <Row metric="cpu" label="CPU" used={fmtPct(t.cpu.pct)} total={`${t.cpu.cores} cores`} pct={t.cpu.pct} />
          <Row metric="memory" label="Memory" used={fmtBytes(t.memory.used)} total={fmtBytes(t.memory.total)} pct={t.memory.pct} />
          <Row metric="disk" label="Disk" used={fmtBytes(t.disk.used)} total={fmtBytes(t.disk.total)} pct={t.disk.pct} />
          <Row metric="containers" label="Containers" used={String(t.containers.running)} total={`${t.containers.total} total`} pct={t.containers.pct} invert />
          {unreachable > 0 && <p className="pt-2 text-[11px] text-muted-foreground">{unreachable} server(s) unreachable — not counted.</p>}
        </div>
      )}
    </div>
  );
}
