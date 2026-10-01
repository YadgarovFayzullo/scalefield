import type { Container, ServerData } from "@/lib/status";
import type { ServerUsage } from "@/lib/servers-usage";

/**
 * Сводка Usage по всем серверам команды: карточка на списке проектов и
 * страницы /usage/<metric>. Один физический хост может быть заведён дважды
 * (два агента на одной машине) — такие записи склеиваются по «отпечатку»
 * машины (время загрузки + ядра + объём памяти и диска), чтобы ресурсы не
 * считались дважды.
 */
export const METRICS = ["cpu", "memory", "disk", "containers"] as const;
export type Metric = (typeof METRICS)[number];
export const METRIC_LABEL: Record<Metric, string> = { cpu: "CPU", memory: "Memory", disk: "Disk", containers: "Containers" };

export type Machine = {
  key: string;
  servers: ServerUsage["server"][]; // все записи панели, указывающие на эту машину
  data: ServerData;
};

export function machines(list: ServerUsage[]): Machine[] {
  const out = new Map<string, Machine>();
  for (const s of list) {
    if (!s.data) continue;
    const d = s.data;
    const key = `${Math.round(d.boot_time)}|${d.cpu_count}|${d.mem.total}|${d.disk.total}`;
    const m = out.get(key);
    if (m) m.servers.push(s.server);
    else out.set(key, { key, servers: [s.server], data: d });
  }
  return [...out.values()];
}

export type Totals = {
  cpu: { pct: number; cores: number };
  memory: { used: number; total: number; pct: number };
  disk: { used: number; total: number; pct: number };
  containers: { running: number; total: number; pct: number };
};

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

export function running(c: Container): boolean {
  return c.status === "running";
}

export function totals(ms: Machine[]): Totals {
  let cores = 0, busy = 0, memUsed = 0, memTotal = 0, diskUsed = 0, diskTotal = 0, up = 0, all = 0;
  for (const { data: d } of ms) {
    cores += d.cpu_count;
    busy += (d.cpu_pct / 100) * d.cpu_count;
    memUsed += d.mem.used;
    memTotal += d.mem.total;
    diskUsed += d.disk.used;
    diskTotal += d.disk.total;
    up += d.containers.filter(running).length;
    all += d.containers.length;
  }
  return {
    cpu: { pct: pct(busy, cores), cores },
    memory: { used: memUsed, total: memTotal, pct: pct(memUsed, memTotal) },
    disk: { used: diskUsed, total: diskTotal, pct: pct(diskUsed, diskTotal) },
    containers: { running: up, total: all, pct: pct(up, all) },
  };
}
