"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import type { Container } from "@/lib/status";

/** Service state derived from a Docker container's status + health. */
export type ServiceState = "operational" | "degraded" | "down";

export function containerState(c: Pick<Container, "status" | "health">): ServiceState {
  if (c.status !== "running") return "down";
  if (c.health === "healthy" || c.health == null) return "operational";
  return "degraded"; // starting / unhealthy while running
}

export const STATE_LABEL: Record<ServiceState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
};

export const STATE_TEXT: Record<ServiceState, string> = {
  operational: "text-green-600 dark:text-green-400",
  degraded: "text-yellow-600 dark:text-yellow-400",
  down: "text-red-600 dark:text-red-400",
};

export const STATE_BG: Record<ServiceState, string> = {
  operational: "bg-green-500",
  degraded: "bg-yellow-500",
  down: "bg-red-500",
};

/** Docker reports a zero date for containers that were created but never started. */
export function startedAtMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t) || t <= 0) return null;
  return t;
}

export function StatusDot({ state, className = "" }: { state: ServiceState; className?: string }) {
  return (
    <span
      aria-label={STATE_LABEL[state]}
      className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${STATE_BG[state]} ${className}`}
    />
  );
}

export function SectionHeading({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
      {aside ? <div className="text-xs text-muted-foreground">{aside}</div> : null}
    </div>
  );
}

/** Horizontal usage bar; turns yellow above 80% and red above 90%. */
export function UsageBar({ pct, className = "" }: { pct: number | null | undefined; className?: string }) {
  const v = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const color = v >= 90 ? "bg-red-500" : v >= 80 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-muted ${className}`}>
      <div className={`h-full rounded-full ${color} transition-[width]`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function ErrorCard({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <Card className="border-red-500/30">
      <CardContent className="flex items-start gap-3 py-4">
        <HugeiconsIcon icon={AlertCircleIcon} className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-0.5 break-all font-mono text-xs text-muted-foreground">{message}</div>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <HugeiconsIcon icon={RefreshIcon} className="h-3.5 w-3.5" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <Card className="border-border">
      <CardContent className="space-y-3 py-5">
        <Skeleton className="h-4 w-1/3" />
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`flex items-center gap-4 border-b border-border py-3 ${i === 0 ? "border-t" : ""}`}>
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
