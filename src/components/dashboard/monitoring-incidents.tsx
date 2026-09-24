"use client";

import * as React from "react";
import { fmtAgo, fmtTime } from "@/lib/status";
import type { ApiData, Container } from "@/lib/status";
import { containerState } from "./monitoring-shared";

type ApiError = NonNullable<ApiData["recent_errors"]>[number];

type Props = {
  containers: Container[];
  api: ApiData | null;
  apiError: string | null;
};

function severityClass(kind: "critical" | "major" | "minor"): string {
  switch (kind) {
    case "critical":
      return "bg-red-500/10 text-red-700 dark:text-red-400";
    case "major":
      return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
    case "minor":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
  }
}

function sortByTsDesc(list: ApiError[]): ApiError[] {
  return [...list].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
}

export function MonitoringIncidents({ containers, api, apiError }: Props) {
  const unhealthy = React.useMemo(
    () => containers.filter((c) => containerState(c) !== "operational"),
    [containers]
  );
  const errors = React.useMemo(() => sortByTsDesc(api?.recent_errors ?? []), [api]);
  const serverErrors = errors.filter((e) => e.status >= 500);
  const clientErrors = errors.filter((e) => e.status >= 400 && e.status < 500);
  const trafficNote =
    apiError != null
      ? `traffic log unavailable: ${apiError}`
      : api && !api.configured
        ? "traffic log not configured"
        : null;

  const nothing = unhealthy.length === 0 && serverErrors.length === 0 && clientErrors.length === 0;

  return (
    <div className="space-y-6">
      {trafficNote ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{trafficNote}</div>
      ) : null}

      {nothing && !trafficNote ? (
        <div className="border-t border-b border-border py-6 text-sm text-muted-foreground">
          No incidents: all containers healthy and no errors in the last {api?.window_hours ?? 24}h.
        </div>
      ) : null}

      {/* Containers not running / unhealthy */}
      {unhealthy.length > 0 ? (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Containers</div>
          <div className="space-y-0">
            {unhealthy.map((c, i) => {
              const state = containerState(c);
              return (
                <div key={c.name} className={`border-b border-border py-3 ${i === 0 ? "border-t" : ""}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${severityClass(state === "down" ? "major" : "minor")}`}>
                      {state === "down" ? "down" : "degraded"}
                    </span>
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    status {c.status}
                    {c.health ? `, health ${c.health}` : ""}
                    {c.started_at ? ` · last started ${fmtAgo(c.started_at)}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 5xx = incidents */}
      {serverErrors.length > 0 ? (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Recent 5xx errors ({serverErrors.length}, last {api?.window_hours ?? 24}h)
          </div>
          <ErrorRows list={serverErrors} kind="critical" />
        </div>
      ) : null}

      {/* 4xx = warnings */}
      {clientErrors.length > 0 ? (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Warnings: recent 4xx ({clientErrors.length})
          </div>
          <ErrorRows list={clientErrors} kind="minor" />
        </div>
      ) : null}
    </div>
  );
}

function ErrorRows({ list, kind }: { list: ApiError[]; kind: "critical" | "minor" }) {
  return (
    <div className="space-y-0">
      {list.map((e, i) => (
        <div
          key={`${e.path}-${e.status}-${e.ts ?? i}`}
          className={`flex items-center justify-between gap-4 border-b border-border py-2.5 ${i === 0 ? "border-t" : ""}`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 font-mono text-xs ${severityClass(kind)}`}>{e.status}</span>
            <span className="truncate font-mono text-xs">{e.path}</span>
          </div>
          <div className="flex-shrink-0 text-xs text-muted-foreground" title={fmtTime(e.ts)}>
            {fmtAgo(e.ts)}
          </div>
        </div>
      ))}
    </div>
  );
}
