"use client";

/**
 * Клиентский слой данных дашборда.
 *
 * Все метрики приходят от агента проекта через серверный прокси
 * `/api/projects/<slug>/status/<metric>` (сессия в cookie, токен агента —
 * только на сервере), история деплоев — из `/api/projects/<slug>/deployments`.
 * Slug проекта берётся из контекста `/p/[project]`. Типы повторяют JSON
 * коллекторов один в один; менять поле здесь = менять его в Python.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useProject } from "@/lib/project-context";

// ---------- типы ответов статус-API ----------

export type Container = {
  name: string;
  status: string; // running / exited / ...
  image: string;
  health: string | null; // healthy / unhealthy / starting / null
  cpu_pct: number | null;
  mem_used: number | null;
  mem_pct: number | null;
  started_at?: string;
};

export type ServerData = {
  cpu_pct: number;
  cpu_count: number;
  per_cpu: number[];
  load_avg: [number, number, number];
  mem: { total: number; used: number; available: number; pct: number };
  swap: { total: number; used: number; pct: number };
  disk: { path: string; total: number; used: number; free: number; pct: number };
  net: { bytes_sent: number; bytes_recv: number };
  uptime_s: number;
  boot_time: number;
  containers: Container[];
};

export type DatabaseData = {
  ok: boolean;
  version: string;
  size_bytes: number;
  size_pretty: string;
  connections: { total: number; max: number; pct: number; by_state: Record<string, number> };
  cache_hit_ratio: number;
  txn: Record<string, number>; // commits, rollbacks, inserts, updates, deletes
  tables: {
    name: string;
    rows: number;
    total_bytes: number;
    total_pretty: string;
    table_bytes: number;
    dead_rows: number;
  }[];
  longest_running: { pid: number; dur_s: number; state: string; query: string }[];
  slow_queries: { query: string; calls: number; mean_ms: number; total_ms: number; rows: number }[] | null;
  pg_stat_statements: boolean;
};

export type TrafficBucket = {
  ts: number; // начало часа, unix-секунды
  requests: number;
  e4xx: number;
  e5xx: number;
  bytes: number;
  avg_ms: number;
  p95_ms: number;
};

export type ApiData = {
  configured: boolean;
  window_hours?: number;
  total_requests?: number;
  rps?: number;
  latency_ms?: { p50: number; p95: number; p99: number };
  status_codes?: { "2xx": number; "3xx": number; "4xx": number; "5xx": number };
  error_rate?: number; // доля 0..1
  bytes_out?: number;
  by_host?: { host: string; count: number }[];
  series?: TrafficBucket[];
  top_endpoints?: { path: string; count: number; avg_ms: number; errors: number }[];
  recent_errors?: { path: string; status: number; ts: number | null }[];
};

export type AccessLogItem = {
  id: string;
  ts: number | null;
  status: number;
  dur_ms: number | null;
  method: string;
  path: string;
  host: string;
  client: string;
  size: number;
  ua: string;
  router: string;
  level: "info" | "warn" | "error";
};

export type AccessLogsData = { configured: boolean; items: AccessLogItem[] };

export type ContainerLogLine = {
  id: string;
  ts: string;
  message: string;
  level: "info" | "warn" | "error";
};

export type ContainerLogsData = {
  configured: boolean;
  container?: string;
  lines: ContainerLogLine[];
  error?: string;
};

export type ContentData = {
  articles: { total: number; published: number; with_doi: number; by_type: Record<string, number> };
  journals: { total: number; by_type: Record<string, number> };
  issues: number;
  publishers: number;
  sections: number;
  users: number;
  roles: Record<string, number>;
  interactions: { views: number; downloads: number; likes: number };
  citations: number;
  top_articles: { id: number; title: string; views: number; downloads: number }[];
  growth: { date: string; count: number }[];
  latest: { id: number; title: string; publication_type: string; created_at: string }[];
};

export type VisitorsData = {
  configured: boolean;
  window_days?: number;
  visitors?: number;
  page_views?: number;
  bounce_rate?: number; // доля 0..1
  changes?: { visitors: number | null; page_views: number | null; bounce_rate: number | null };
  series?: { day: number; visitors: number; views: number }[];
  top_pages?: { path: string; views: number; visitors: number }[];
  referrers?: { referrer: string; count: number }[];
  referrer_capture_available?: boolean;
  devices?: { name: string; count: number }[];
  browsers?: { name: string; count: number }[];
  operating_systems?: { name: string; count: number }[];
};

export type SummaryData = {
  ts: number;
  api_uptime_s: number;
  healthy: boolean;
  server_ok: boolean;
  db_ok: boolean;
  server?: {
    cpu_pct: number;
    mem_pct: number;
    disk_pct: number;
    uptime_s: number;
    containers: { name: string; status: string; health: string | null }[];
  };
  db?: { size_pretty: string; connections: number };
  server_error?: string;
  db_error?: string;
};

// ---------- деплои (GitHub Actions) ----------

export type Deployment = {
  id: string;
  repo: string;
  workflow: string;
  branch: string;
  sha: string;
  title: string;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | ...
  event: string;
  created_at: string;
  updated_at: string;
  duration_s: number | null;
  url: string;
  actor: string;
  actor_avatar: string;
  source?: string; // github_actions | scalefield
  service?: string | null;
  domains?: string[];
  log?: string | null;
  image?: string | null;
};

export type DeploymentsData = { configured: boolean; items: Deployment[]; errors: string[] };

// ---------- хук поллинга ----------

type State<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
};

/**
 * Поллинг метрики через серверный прокси. `path` — либо имя метрики
 * (`server`, `api`, `logs?limit=100`), либо абсолютный путь API (`/api/deployments`).
 * intervalMs=0 — без автообновления.
 */
export function useMetric<T>(path: string, intervalMs = 10000): State<T> & { refresh: () => void } {
  const { apiBase } = useProject();
  const [state, setState] = useState<State<T>>({
    data: null,
    error: null,
    loading: true,
    updatedAt: null,
  });
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const url = path.startsWith("/") ? path : `${apiBase}/status/${path}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const json = await res.json();
      if (!alive.current) return;
      if (!res.ok) {
        setState((s) => ({ ...s, error: json?.error || `HTTP ${res.status}`, loading: false }));
        return;
      }
      setState({ data: json, error: null, loading: false, updatedAt: Date.now() });
    } catch (e) {
      if (!alive.current) return;
      setState((s) => ({ ...s, error: String(e), loading: false }));
    }
  }, [apiBase, path]);

  useEffect(() => {
    alive.current = true;
    load();
    if (intervalMs > 0) {
      const id = setInterval(load, intervalMs);
      return () => {
        alive.current = false;
        clearInterval(id);
      };
    }
    return () => {
      alive.current = false;
    };
  }, [load, intervalMs]);

  return { ...state, refresh: load };
}

export * from "@/lib/format";
