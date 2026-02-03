"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Bar, BarChart } from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Database02Icon,
  LockPasswordIcon,
  CloudIcon,
  SignalIcon,
} from "@hugeicons/core-free-icons";

/**
 * Dashboard Overview Page
 *
 * EXCEPTION: Using cards for statistics (Supabase-style)
 * This is the ONLY place where cards are allowed
 */

// Mock data for charts - simulating last 60 minutes
const databaseData = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  requests: Math.floor(Math.random() * 15) + 2,
}));

const authData = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  requests: i === 15 ? 12 : Math.floor(Math.random() * 2),
}));

const storageData = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  requests: i === 18 ? 8 : Math.floor(Math.random() * 2),
}));

const realtimeData = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  requests: 0,
}));

export default function DashboardPage() {
  const [timeRange, setTimeRange] = React.useState("60");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page header with time selector */}
      <div className="mb-6 sm:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Overview</h1>
          <p className="text-sm text-muted-foreground">System status and recent activity</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-background"
          >
            <option value="60">Last 60 minutes</option>
            <option value="24">Last 24 hours</option>
            <option value="7">Last 7 days</option>
          </select>
        </div>
      </div>

      {/* Stats Cards - Supabase style (EXCEPTION) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Database */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Database02Icon} className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Database</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">REST Requests</div>
              <div className="text-2xl font-semibold">146</div>
            </div>
            <ChartContainer
              config={{
                requests: {
                  label: "Requests",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-20 w-full"
            >
              <BarChart data={databaseData}>
                <Bar dataKey="requests" fill="hsl(142.1 76.2% 36.3%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Jan 14, 4:46am</span>
              <span>Jan 14, 5:41am</span>
            </div>
          </CardContent>
        </Card>

        {/* Auth */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={LockPasswordIcon} className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Auth</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Auth Requests</div>
              <div className="text-2xl font-semibold">1</div>
            </div>
            <ChartContainer
              config={{
                requests: {
                  label: "Requests",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-20 w-full"
            >
              <BarChart data={authData}>
                <Bar dataKey="requests" fill="hsl(142.1 76.2% 36.3%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Jan 14, 4:46am</span>
              <span>Jan 14, 5:41am</span>
            </div>
          </CardContent>
        </Card>

        {/* Storage */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={CloudIcon} className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Storage</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Storage Requests</div>
              <div className="text-2xl font-semibold">1</div>
            </div>
            <ChartContainer
              config={{
                requests: {
                  label: "Requests",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-20 w-full"
            >
              <BarChart data={storageData}>
                <Bar dataKey="requests" fill="hsl(142.1 76.2% 36.3%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Jan 14, 4:46am</span>
              <span>Jan 14, 5:41am</span>
            </div>
          </CardContent>
        </Card>

        {/* Realtime */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={SignalIcon} className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Realtime</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Realtime Requests</div>
              <div className="text-2xl font-semibold">0</div>
            </div>
            <ChartContainer
              config={{
                requests: {
                  label: "Requests",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-20 w-full"
            >
              <BarChart data={realtimeData}>
                <Bar dataKey="requests" fill="hsl(142.1 76.2% 36.3%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Jan 14, 4:46am</span>
              <span>Jan 14, 5:41am</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity - Vertical Flow */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Recent Activity
        </h2>

        <div className="space-y-2">
          {/* Activity item */}
          <div className="px-4 py-3 border border-border rounded-lg hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">api-gateway</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400">
                    Deployed
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  v2.1.4 deployed to production • Build #847
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                <span>2 min ago</span>
                <Link href="/dashboard/deployments" className="text-primary hover:underline">
                  View
                </Link>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border border-border rounded-lg hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">user-service</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    Building
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Running tests and building artifacts • Build #1203
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                <span>5 min ago</span>
                <Link href="/dashboard/deployments" className="text-primary hover:underline">
                  View
                </Link>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border border-border rounded-lg hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">payment-processor</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                    Warning
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  High memory usage detected • 82% of limit
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                <span>12 min ago</span>
                <Link href="/dashboard/analytics" className="text-primary hover:underline">
                  Investigate
                </Link>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border border-border rounded-lg hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">auth-service</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400">
                    Deployed
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  v1.8.2 deployed to production • Build #456
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                <span>1 hour ago</span>
                <Link href="/dashboard/deployments" className="text-primary hover:underline">
                  View
                </Link>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border border-border rounded-lg hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">frontend-app</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400">
                    Deployed
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  v3.2.1 deployed to production • Build #2341
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                <span>2 hours ago</span>
                <Link href="/dashboard/deployments" className="text-primary hover:underline">
                  View
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions - minimal, functional */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/projects">
            <Button variant="outline" size="sm">
              View All Projects
            </Button>
          </Link>
          <Link href="/dashboard/deployments">
            <Button variant="outline" size="sm">
              Deployment History
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
