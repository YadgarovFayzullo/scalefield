import { fmtBytes, fmtPct } from "@/lib/format";
import type { ServerUsage } from "@/lib/servers-usage";

/**
 * Полоски использования ресурсов сервера — по образцу блока Usage в Vercel
 * (кольцевой индикатор + подпись + дробь used/total в строку), но по
 * реальным метрикам своего хоста (CPU/память/диск/контейнеры), а не по
 * квотам serverless-платформы, которых у self-host просто нет.
 */
function tone(pct: number): "danger" | "warn" | "ok" {
  if (pct >= 90) return "danger";
  if (pct >= 75) return "warn";
  return "ok";
}

const RING_COLOR: Record<ReturnType<typeof tone>, string> = {
  danger: "#ef4444",
  warn: "#f59e0b",
  ok: "#3b82f6",
};

/** Кольцо-индикатор: закрашенная дуга по проценту, как в Usage-виджете Vercel. */
function Ring({ pct, t }: { pct: number; t: ReturnType<typeof tone> }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  const filled = Math.min(100, Math.max(0, pct));
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0 -rotate-90">
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        stroke={RING_COLOR[t]}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${(filled / 100) * c} ${c}`}
      />
    </svg>
  );
}

function Row({ label, used, total, pct }: { label: string; used: string; total: string; pct: number }) {
  const t = tone(pct);
  return (
    <div className="flex items-center gap-2.5 border-b border-border/60 py-2 last:border-0">
      <Ring pct={pct} t={t} />
      <span className="flex-1 truncate text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">
        {used} <span className="text-muted-foreground">/ {total}</span>
      </span>
    </div>
  );
}

export function UsageCard({ servers }: { servers: ServerUsage[] }) {
  const withData = servers.filter((s): s is ServerUsage & { data: NonNullable<ServerUsage["data"]> } => s.data !== null);

  return (
    <div className="rounded-xl border border-border p-4">
      <h2 className="mb-1 text-sm font-semibold">Usage</h2>
      {servers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No servers registered yet.</p>
      ) : withData.length === 0 ? (
        <p className="text-xs text-muted-foreground">Servers are unreachable right now.</p>
      ) : (
        <div>
          {withData.map(({ server, data }) => {
            const running = data.containers.filter((c) => c.status === "running").length;
            return (
              <div key={server.id}>
                {withData.length > 1 && <p className="pt-2 text-xs font-medium text-muted-foreground">{server.name}</p>}
                <Row label="CPU" used={fmtPct(data.cpu_pct)} total={`${data.cpu_count} cores`} pct={data.cpu_pct} />
                <Row label="Memory" used={fmtBytes(data.mem.used)} total={fmtBytes(data.mem.total)} pct={data.mem.pct} />
                <Row label="Disk" used={fmtBytes(data.disk.used)} total={fmtBytes(data.disk.total)} pct={data.disk.pct} />
                <Row label="Containers" used={String(running)} total={`${data.containers.length} total`} pct={data.containers.length ? (running / data.containers.length) * 100 : 0} />
              </div>
            );
          })}
          {servers.some((s) => s.error) && <p className="pt-2 text-[11px] text-muted-foreground">{servers.filter((s) => s.error).length} server(s) unreachable.</p>}
        </div>
      )}
    </div>
  );
}
