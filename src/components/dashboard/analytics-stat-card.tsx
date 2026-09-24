"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";

type IconType = React.ComponentProps<typeof HugeiconsIcon>["icon"];

/**
 * Statistic card in the "Supabase style" used across the dashboard:
 * icon + title in the header, a small label, a big value and an optional
 * secondary line underneath.
 */
export function AnalyticsStatCard({
  icon,
  title,
  label,
  value,
  sub,
  valueClassName,
}: {
  icon: IconType;
  title: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={icon} className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums ${valueClassName ?? ""}`}>{value}</div>
        {sub ? <div className="text-xs text-muted-foreground mt-1">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

export function AnalyticsStatCardSkeleton() {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-32 mt-2" />
      </CardContent>
    </Card>
  );
}
