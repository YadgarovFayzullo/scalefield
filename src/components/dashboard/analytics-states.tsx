"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, ReloadIcon } from "@hugeicons/core-free-icons";
import { AnalyticsStatCardSkeleton } from "@/components/dashboard/analytics-stat-card";

/** Error state for one data source (traffic or content) with a retry button. */
export function AnalyticsError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="px-4 py-3 border border-red-500/30 bg-red-500/5 rounded-lg flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <p className="text-sm text-muted-foreground break-words">{message}</p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="gap-2 cursor-pointer shrink-0" onClick={onRetry}>
        <HugeiconsIcon icon={ReloadIcon} className="h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}

/** Card-shaped skeleton for a chart block. */
export function AnalyticsChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className={className ?? "h-56 w-full"} />
      </CardContent>
    </Card>
  );
}

/** Skeleton for the whole traffic section (stat row + charts + tables). */
export function AnalyticsTrafficSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <AnalyticsStatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <AnalyticsChartSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsChartSkeleton className="h-32 w-full" />
        <AnalyticsChartSkeleton className="h-32 w-full" />
      </div>
      <AnalyticsChartSkeleton className="h-64 w-full" />
    </div>
  );
}

/** Skeleton for the content section. */
export function AnalyticsContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <AnalyticsStatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AnalyticsChartSkeleton className="h-64 w-full" />
        </div>
        <AnalyticsChartSkeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
