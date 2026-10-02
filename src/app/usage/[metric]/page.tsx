import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PanelHeader } from "@/components/panel-header";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { Ring } from "@/components/dashboard/usage-ring";
import { currentUser } from "@/lib/auth";
import { listServersUsage } from "@/lib/servers-usage";
import { fmtBytes, fmtPct } from "@/lib/format";
import { machines, METRIC_LABEL, METRICS, running, totals, type Machine, type Metric } from "@/lib/usage";
import type { Container } from "@/lib/status";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Страница одного ресурса из блока Usage (как клик по строке Usage в
 * Vercel): итог по команде, разбивка по серверам и — для CPU/памяти — топ
 * контейнеров, для контейнеров — полный список со статусом. Обновляется сама.
 */
function Bar({ pct, invert = false }: { pct: number; invert?: boolean }) {
  const v = Math.min(100, Math.max(0, pct));
  const bad = invert ? 100 - v : v;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", bad >= 90 ? "bg-red-500" : bad >= 75 ? "bg-amber-500" : "bg-blue-500")} style={{ width: `${v}%` }} />
    </div>
  );
}

function machineValue(metric: Metric, m: Machine): { pct: number; text: string } {
  const d = m.data;
  if (metric === "cpu") return { pct: d.cpu_pct, text: `${fmtPct(d.cpu_pct)} of ${d.cpu_count} cores · load ${d.load_avg.map((l) => l.toFixed(2)).join(" ")}` };
  if (metric === "memory") return { pct: d.mem.pct, text: `${fmtBytes(d.mem.used)} / ${fmtBytes(d.mem.total)} · swap ${fmtPct(d.swap.pct, 0)}` };
  if (metric === "disk") return { pct: d.disk.pct, text: `${fmtBytes(d.disk.used)} / ${fmtBytes(d.disk.total)} · ${fmtBytes(d.disk.free)} free on ${d.disk.path}` };
  const up = d.containers.filter(running).length;
  return { pct: d.containers.length ? (up / d.containers.length) * 100 : 0, text: `${up} running / ${d.containers.length} total` };
}

function MachineName({ m }: { m: Machine }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      {m.servers.map((s, i) => (
        <Link key={s.id} href={`/servers/${s.id}`} className={cn("hover:underline", i > 0 && "text-muted-foreground")}>
          {s.name}
        </Link>
      ))}
      {m.servers.length > 1 && <span className="text-xs text-muted-foreground">(same machine)</span>}
    </span>
  );
}

function stateDot(c: Container) {
  if (c.status !== "running") return "bg-red-500";
  if (c.health && c.health !== "healthy") return "bg-amber-500";
  return "bg-emerald-500";
}

export default async function UsageMetricPage({ params }: { params: Promise<{ metric: string }> }) {
  const { metric: raw } = await params;
  if (!(METRICS as readonly string[]).includes(raw)) notFound();
  const metric = raw as Metric;
  const user = await currentUser();
  if (!user) redirect("/login");

  const servers = await listServersUsage(user.orgIds);
  const ms = machines(servers);
  const t = totals(ms);
  const unreachable = servers.filter((s) => s.error);

  const headline =
    metric === "cpu"
      ? { pct: t.cpu.pct, big: fmtPct(t.cpu.pct), sub: `of ${t.cpu.cores} cores across ${ms.length} ${ms.length === 1 ? "server" : "servers"}` }
      : metric === "memory"
        ? { pct: t.memory.pct, big: fmtBytes(t.memory.used), sub: `of ${fmtBytes(t.memory.total)} (${fmtPct(t.memory.pct)})` }
        : metric === "disk"
          ? { pct: t.disk.pct, big: fmtBytes(t.disk.used), sub: `of ${fmtBytes(t.disk.total)} (${fmtPct(t.disk.pct)})` }
          : { pct: t.containers.pct, big: String(t.containers.running), sub: `running of ${t.containers.total} containers` };

  // Контейнеры всех машин — для топа (CPU/память) и полного списка.
  const all = ms.flatMap((m) => m.data.containers.map((c) => ({ c, m })));
  const top =
    metric === "cpu"
      ? [...all].filter((x) => x.c.cpu_pct != null).sort((a, b) => (b.c.cpu_pct ?? 0) - (a.c.cpu_pct ?? 0)).slice(0, 10)
      : metric === "memory"
        ? [...all].filter((x) => x.c.mem_used != null).sort((a, b) => (b.c.mem_used ?? 0) - (a.c.mem_used ?? 0)).slice(0, 10)
        : [];
  const list = metric === "containers" ? [...all].sort((a, b) => Number(running(a.c)) - Number(running(b.c)) || a.c.name.localeCompare(b.c.name)) : [];

  return (
    <div className="min-h-screen bg-background">
      <PanelHeader active="/dashboard" />
      <AutoRefresh />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/dashboard" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">
          ← Projects
        </Link>
        <h1 className="mb-4 text-2xl font-semibold">Usage</h1>

        <nav className="mb-6 flex gap-1 border-b border-border">
          {METRICS.map((m) => (
            <Link
              key={m}
              href={`/usage/${m}`}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm", m === metric ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {METRIC_LABEL[m]}
            </Link>
          ))}
        </nav>

        {ms.length === 0 ? (
          <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
            {servers.length === 0 ? "No servers registered yet." : "Servers are unreachable right now."}
          </p>
        ) : (
          <>
            <section className="mb-8 flex items-center gap-4 rounded-xl border border-border p-5">
              <Ring pct={headline.pct} invert={metric === "containers"} size={44} />
              <div>
                <p className="font-mono text-2xl font-semibold tabular-nums">{headline.big}</p>
                <p className="text-sm text-muted-foreground">{headline.sub}</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-sm font-medium">By server</h2>
              <div className="overflow-hidden rounded-xl border border-border">
                {ms.map((m) => {
                  const v = machineValue(metric, m);
                  return (
                    <div key={m.key} className="grid gap-2 border-b border-border p-4 last:border-0 sm:grid-cols-[1fr_2fr] sm:items-center">
                      <div className="text-sm font-medium">
                        <MachineName m={m} />
                      </div>
                      <div className="space-y-1.5">
                        <Bar pct={v.pct} invert={metric === "containers"} />
                        <p className="font-mono text-xs text-muted-foreground tabular-nums">{v.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {unreachable.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Unreachable, not counted: {unreachable.map((s) => s.server.name).join(", ")}</p>
              )}
            </section>

            {top.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-sm font-medium">Top containers</h2>
                <div className="overflow-hidden rounded-xl border border-border">
                  {top.map(({ c, m }) => {
                    const pct = metric === "cpu" ? (c.cpu_pct ?? 0) : (c.mem_pct ?? 0);
                    return (
                      <div key={`${m.key}/${c.name}`} className="grid gap-2 border-b border-border px-4 py-3 last:border-0 sm:grid-cols-[1fr_2fr] sm:items-center">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{m.servers[0].name}</p>
                        </div>
                        <div className="space-y-1.5">
                          <Bar pct={pct} />
                          <p className="font-mono text-xs text-muted-foreground tabular-nums">
                            {metric === "cpu" ? `${fmtPct(c.cpu_pct)} of one core` : `${fmtBytes(c.mem_used)} · ${fmtPct(c.mem_pct)} of server memory`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {list.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-medium">All containers</h2>
                <div className="overflow-hidden rounded-xl border border-border">
                  {list.map(({ c, m }) => (
                    <div key={`${m.key}/${c.name}`} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", stateDot(c))} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.image} · {m.servers[0].name}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.status}
                        {c.health ? ` · ${c.health}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
