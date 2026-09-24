"use client";

import * as React from "react";
import { fmtBytes, fmtDuration, fmtAgo, fmtPct } from "@/lib/status";
import type { Container } from "@/lib/status";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, Alert02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { containerState, startedAtMs, STATE_LABEL, STATE_TEXT, type ServiceState } from "./monitoring-shared";

const STATE_ICON = {
  operational: Tick02Icon,
  degraded: Alert02Icon,
  down: Cancel01Icon,
} as const;

const STATE_ORDER: Record<ServiceState, number> = { degraded: 0, down: 1, operational: 2 };

type Props = {
  containers: Container[];
  /** Current time (ms) passed in so uptime ticks with the polling cycle. */
  now: number;
};

export function MonitoringServices({ containers, now }: Props) {
  const rows = React.useMemo(
    () =>
      containers
        .map((c) => ({ c, state: containerState(c) }))
        .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.c.name.localeCompare(b.c.name)),
    [containers]
  );

  if (rows.length === 0) {
    return <div className="border-t border-b border-border py-6 text-sm text-muted-foreground">No containers reported.</div>;
  }

  return (
    <div className="space-y-0">
      {rows.map(({ c, state }, index) => {
        const started = startedAtMs(c.started_at);
        const running = c.status === "running";
        return (
          <div
            key={c.name}
            className={`border-b border-border py-3 transition-colors hover:bg-muted/30 ${index === 0 ? "border-t" : ""}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <HugeiconsIcon icon={STATE_ICON[state]} className={`h-4 w-4 flex-shrink-0 ${STATE_TEXT[state]}`} />
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className={`text-xs ${STATE_TEXT[state]}`}>{STATE_LABEL[state]}</span>
                  </div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {c.image}
                    {" · "}
                    {c.status}
                    {c.health ? ` / ${c.health}` : ""}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs">
                <div className="hidden text-right sm:block">
                  <div className="text-muted-foreground">CPU</div>
                  <div className="font-medium">{running ? fmtPct(c.cpu_pct) : "—"}</div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="text-muted-foreground">Memory</div>
                  <div className="font-medium">
                    {running && c.mem_used != null ? `${fmtBytes(c.mem_used)} (${fmtPct(c.mem_pct)})` : "—"}
                  </div>
                </div>
                <div className="min-w-[80px] text-right">
                  <div className="text-muted-foreground">{running ? "Uptime" : "Last started"}</div>
                  <div className="font-medium">
                    {started == null
                      ? "never"
                      : running
                        ? fmtDuration(Math.max(0, now - started) / 1000)
                        : fmtAgo(started)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
