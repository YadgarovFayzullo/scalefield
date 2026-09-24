"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

/** Colour tone shared by stat cards, badges and the health plate. */
export type Tone = "neutral" | "ok" | "warn" | "bad";

export const toneText: Record<Tone, string> = {
  neutral: "text-foreground",
  ok: "text-green-600 dark:text-green-400",
  warn: "text-yellow-700 dark:text-yellow-400",
  bad: "text-red-600 dark:text-red-400",
};

export const toneChip: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  ok: "bg-green-500/10 text-green-700 dark:text-green-400",
  warn: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  bad: "bg-red-500/10 text-red-700 dark:text-red-400",
};

/** Percent → tone: green under `warn`, yellow under `bad`, red above. */
export function pctTone(pct: number | null | undefined, warn = 70, bad = 90): Tone {
  if (pct == null) return "neutral";
  if (pct >= bad) return "bad";
  if (pct >= warn) return "warn";
  return "ok";
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
      {children}
    </h2>
  );
}

type StatCardProps = {
  icon: IconSvgElement;
  title: string;
  value: string;
  /** Secondary line under the value. */
  hint?: string;
  tone?: Tone;
  /** 0..100 — renders a thin usage bar under the value. */
  progress?: number | null;
};

export function StatCard({ icon, title, value, hint, tone = "neutral", progress }: StatCardProps) {
  const barTone: Record<Tone, string> = {
    neutral: "bg-primary",
    ok: "bg-green-500",
    warn: "bg-yellow-500",
    bad: "bg-red-500",
  };
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={icon} className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className={`text-2xl font-semibold tabular-nums ${toneText[tone]}`}>{value}</div>
        {progress != null && (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${barTone[tone]}`}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
        {hint && <p className="text-xs text-muted-foreground truncate">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

export function ErrorBlock({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-red-500/30">
      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 py-4">
        <HugeiconsIcon icon={AlertCircleIcon} className="h-5 w-5 text-red-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{title} failed to load</div>
          <p className="text-xs text-muted-foreground break-all">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <HugeiconsIcon icon={RefreshIcon} />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Loading / error / ready switch for one metric. Keeps the last good data on
 * screen while a refresh fails (a stale number beats an empty card).
 */
export function MetricSection<T>({
  title,
  data,
  error,
  loading,
  onRetry,
  skeleton,
  children,
}: {
  title: string;
  data: T | null;
  error: string | null;
  loading: boolean;
  onRetry: () => void;
  skeleton: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  if (data) return <>{children(data)}</>;
  if (error) return <ErrorBlock title={title} error={error} onRetry={onRetry} />;
  if (loading) return <>{skeleton}</>;
  return null;
}
