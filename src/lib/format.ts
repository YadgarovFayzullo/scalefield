/**
 * Форматирование чисел/времени для отображения. Обычные функции, никаких
 * хуков — вынесены из status.ts (там `"use client"`), чтобы серверные
 * компоненты (страница списка проектов и т.п.) могли их звать напрямую:
 * импорт из клиентского модуля в серверном компоненте Next не даёт вызвать
 * функцию, только передать её как проп в клиентский компонент.
 */

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function fmtMs(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(2)} s`;
  return `${n.toFixed(0)} ms`;
}

/**
 * Относительное время: "5m ago", "2h ago", "2d ago" — а начиная с 3 суток
 * календарная дата ("Sep 17", с годом, если не текущий), как в Vercel:
 * "5d ago"/"30d ago" ничего не говорит о конкретной дате, а в списке
 * деплоев разница между «неделю назад» и «месяц назад» уже не важна, важна
 * сама дата.
 */
export function fmtAgo(iso: string | number | null | undefined): string {
  if (iso == null) return "—";
  const t = typeof iso === "number" ? iso * (iso < 1e12 ? 1000 : 1) : new Date(iso).getTime();
  const date = new Date(t);
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 3) return `${d}d ago`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
}

export function fmtTime(ts: number | string | null | undefined): string {
  if (ts == null) return "—";
  const d = typeof ts === "number" ? new Date(ts * (ts < 1e12 ? 1000 : 1)) : new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString("en-GB", { hour12: false });
}
