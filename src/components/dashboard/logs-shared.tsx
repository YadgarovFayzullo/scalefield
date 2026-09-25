"use client";

/**
 * Shared building blocks for the Logs page: level colours, filter pills,
 * counters, empty/loading/error states and the detail side panel.
 * Both log sources (proxy access log and container stdout) use these.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Cancel01Icon, Copy01Icon, FilterIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { fmtAgo } from "@/lib/status";

export type LogLevel = "info" | "warn" | "error";
/** Mirrors the status API: `warn` = 4xx and 5xx, `error` = 5xx only. */
export type LevelFilter = "all" | "warn" | "error";

export function matchesLevel(level: LogLevel, filter: LevelFilter): boolean {
  if (filter === "all") return true;
  if (filter === "error") return level === "error";
  return level !== "info";
}

export function levelText(level: LogLevel): string {
  switch (level) {
    case "error":
      return "text-red-600 dark:text-red-400";
    case "warn":
      return "text-yellow-600 dark:text-yellow-400";
    default:
      return "text-blue-600 dark:text-blue-400";
  }
}

export function levelBg(level: LogLevel): string {
  switch (level) {
    case "error":
      return "bg-red-500/10";
    case "warn":
      return "bg-yellow-500/10";
    default:
      return "bg-blue-500/10";
  }
}

export function statusText(status: number): string {
  if (status >= 500) return "text-red-600 dark:text-red-400";
  if (status >= 400) return "text-yellow-600 dark:text-yellow-400";
  if (status >= 300) return "text-blue-600 dark:text-blue-400";
  return "text-green-600 dark:text-green-400";
}

export function LevelPill({ level, className = "" }: { level: LogLevel; className?: string }) {
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded text-center whitespace-nowrap ${levelBg(level)} ${levelText(level)} ${className}`}
    >
      {level.toUpperCase()}
    </span>
  );
}

const PILL_STYLES: Record<LevelFilter, { on: string; off: string; label: string }> = {
  all: {
    on: "bg-primary text-primary-foreground",
    off: "bg-muted text-muted-foreground hover:bg-muted/80",
    label: "All",
  },
  error: {
    on: "bg-red-500 text-white",
    off: "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20",
    label: "Error",
  },
  warn: {
    on: "bg-yellow-500 text-white",
    off: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20",
    label: "Warn",
  },
};

export function LevelPills({ value, onChange }: { value: LevelFilter; onChange: (v: LevelFilter) => void }) {
  const order: LevelFilter[] = ["all", "error", "warn"];
  return (
    <div className="flex items-center gap-2">
      <HugeiconsIcon icon={FilterIcon} className="h-4 w-4 text-muted-foreground" />
      {order.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${value === f ? PILL_STYLES[f].on : PILL_STYLES[f].off}`}
        >
          {PILL_STYLES[f].label}
        </button>
      ))}
    </div>
  );
}

export function LevelCounts({ levels, shown }: { levels: LogLevel[]; shown: number }) {
  const errors = levels.filter((l) => l === "error").length;
  const warnings = levels.filter((l) => l === "warn").length;
  const info = levels.length - errors - warnings;
  return (
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      Showing {shown} of {levels.length} •{" "}
      <span className="text-red-600 dark:text-red-400">Errors: {errors}</span> •{" "}
      <span className="text-yellow-600 dark:text-yellow-400">Warnings: {warnings}</span> •{" "}
      <span className="text-blue-600 dark:text-blue-400">Info: {info}</span>
    </span>
  );
}

export function RefreshControl({ onRefresh, updatedAt }: { onRefresh: () => void; updatedAt: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {updatedAt ? `Updated ${fmtAgo(updatedAt)}` : ""}
      </span>
      <Button variant="outline" size="sm" className="gap-2" onClick={onRefresh}>
        <HugeiconsIcon icon={RefreshIcon} className="h-4 w-4" />
        Refresh
      </Button>
    </div>
  );
}

export function LogListSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 px-4">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function LogEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 p-8 text-center">
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

export function LogError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 p-8 text-center">
      <HugeiconsIcon icon={Alert02Icon} className="h-6 w-6 text-red-500 mb-2" />
      <div className="text-sm font-medium">Failed to load logs</div>
      <div className="text-xs text-muted-foreground font-mono mt-1 max-w-md break-all">{message}</div>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineWarning({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 px-4 py-2 border-b border-border bg-yellow-500/10 text-xs">
      <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
      <span className="font-mono break-all text-yellow-700 dark:text-yellow-300">{message}</span>
    </div>
  );
}

export function DetailPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <aside className="w-96 shrink-0 bg-background border-l border-border overflow-auto animate-in slide-in-from-right duration-300">
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between z-10">
        <h3 className="font-semibold">{title}</h3>
        <button type="button" onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground" aria-label="Close">
          <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" />
        </button>
      </div>
      <div className="p-4 space-y-5">{children}</div>
    </aside>
  );
}

export function DetailField({
  label,
  children,
  mono = true,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-sm break-all ${mono ? "font-mono" : ""} ${className}`}>{children}</div>
    </div>
  );
}

export function DetailSection({ title }: { title: string }) {
  return (
    <div className="border-t border-border pt-4 text-xs font-semibold text-muted-foreground">{title}</div>
  );
}

export function CopyJsonButton({ value }: { value: unknown }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="border-t border-border pt-4">
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={copy}>
        <HugeiconsIcon icon={Copy01Icon} className="h-4 w-4" />
        {copied ? "Copied" : "Copy as JSON"}
      </Button>
    </div>
  );
}
