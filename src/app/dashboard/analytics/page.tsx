"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Bar, BarChart } from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ChartLineData01Icon,
  SpeedTrain01Icon,
  AlertCircleIcon,
  WifiConnected01Icon,
} from "@hugeicons/core-free-icons";

/**
 * Analytics Page
 *
 * Workflow: Monitor metrics → Identify trends → Investigate anomalies
 * Primary states: Normal, Warning, Critical
 * Decision points: Drill down into specific metrics, adjust thresholds
 *
 * EXCEPTION: Using cards for statistics (Supabase-style)
 */

// Mock data for charts
const requestsData = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  value: Math.floor(Math.random() * 100) + 50,
}));

const responseTimeData = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  value: Math.floor(Math.random() * 50) + 100,
}));

const errorRateData = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  value: Math.random() * 0.1,
}));

const bandwidthData = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  value: Math.floor(Math.random() * 20) + 100,
}));

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = React.useState("24h");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Analytics</h1>
        <p className="text-sm text-muted-foreground">System performance and usage metrics</p>
      </div>

      {/* Time range selector */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-2">Period:</span>
          {["1h", "24h", "7d", "30d"].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                timeRange === range
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards - Supabase style (EXCEPTION) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Total Requests */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={ChartLineData01Icon} className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Requests</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Requests</div>
              <div className="text-2xl font-semibold">2.4M</div>
              <p className="text-xs text-green-600 mt-1">↑ 12% vs last period</p>
            </div>
            <ChartContainer
              config={{
                value: {
                  label: "Requests",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-20 w-full"
            >
              <BarChart data={requestsData}>
                <Bar dataKey="value" fill="hsl(142.1 76.2% 36.3%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Response Time */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={SpeedTrain01Icon} className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Avg Response Time</div>
              <div className="text-2xl font-semibold">124ms</div>
              <p className="text-xs text-green-600 mt-1">↓ 8ms vs last period</p>
            </div>
            <ChartContainer
              config={{
                value: {
                  label: "Response Time",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-20 w-full"
            >
              <BarChart data={responseTimeData}>
                <Bar dataKey="value" fill="hsl(142.1 76.2% 36.3%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Error Rate</div>
              <div className="text-2xl font-semibold">0.02%</div>
              <p className="text-xs text-green-600 mt-1">Normal range</p>
            </div>
            <ChartContainer
              config={{
                value: {
                  label: "Errors",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-20 w-full"
            >
              <BarChart data={errorRateData}>
                <Bar dataKey="value" fill="hsl(142.1 76.2% 36.3%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bandwidth */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={WifiConnected01Icon} className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Bandwidth</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Bandwidth Used</div>
              <div className="text-2xl font-semibold">124 GB</div>
              <p className="text-xs text-muted-foreground mt-1">52% of quota</p>
            </div>
            <ChartContainer
              config={{
                value: {
                  label: "Bandwidth",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-20 w-full"
            >
              <BarChart data={bandwidthData}>
                <Bar dataKey="value" fill="hsl(142.1 76.2% 36.3%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Per-project breakdown - vertical flow */}
      <div className="mb-8 pb-8 border-b border-border">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          By Project
        </h2>
        <div className="space-y-2">
          <div className="px-4 py-3 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">frontend-app</span>
              <span className="text-sm text-muted-foreground">1.2M requests</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Response time</span>
                <span className="font-medium text-foreground">98ms avg</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Error rate</span>
                <span className="font-medium text-green-600">0.01%</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Uptime</span>
                <span className="font-medium text-foreground">99.98%</span>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">auth-service</span>
              <span className="text-sm text-muted-foreground">432K requests</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Response time</span>
                <span className="font-medium text-foreground">45ms avg</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Error rate</span>
                <span className="font-medium text-green-600">0.00%</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Uptime</span>
                <span className="font-medium text-foreground">100%</span>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">api-gateway</span>
              <span className="text-sm text-muted-foreground">245K requests</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Response time</span>
                <span className="font-medium text-foreground">156ms avg</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Error rate</span>
                <span className="font-medium text-green-600">0.03%</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Uptime</span>
                <span className="font-medium text-foreground">99.95%</span>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">payment-processor</span>
              <span className="text-sm text-muted-foreground">156K requests</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Response time</span>
                <span className="font-medium text-foreground">203ms avg</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Error rate</span>
                <span className="font-medium text-yellow-600">0.08%</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Uptime</span>
                <span className="font-medium text-foreground">99.89%</span>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">user-service</span>
              <span className="text-sm text-muted-foreground">89K requests</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Response time</span>
                <span className="font-medium text-foreground">134ms avg</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Error rate</span>
                <span className="font-medium text-green-600">0.02%</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Uptime</span>
                <span className="font-medium text-foreground">99.97%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent events - vertical flow */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Recent Events
        </h2>
        <div className="space-y-2">
          <div className="px-4 py-3 border border-border rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">High memory usage detected</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                    Warning
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  payment-processor using 82% of allocated memory
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">12 min ago</span>
            </div>
          </div>

          <div className="px-4 py-3 border border-border rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Response time spike</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    Info
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  api-gateway experienced 450ms avg for 3 minutes
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">1 hour ago</span>
            </div>
          </div>

          <div className="px-4 py-3 border border-border rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Auto-scaled instances</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400">
                    Success
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  frontend-app scaled from 3 to 5 instances
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">2 hours ago</span>
            </div>
          </div>

          <div className="py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Bandwidth threshold reached</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    Info
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  50% of monthly bandwidth quota consumed
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">4 hours ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
