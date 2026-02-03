"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  FilterIcon,
  Download01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "error" | "warn" | "info" | "debug";
  source: string;
  message: string;
  metadata?: string;
  details?: {
    method?: string;
    path?: string;
    statusCode?: number;
    duration?: string;
    ip?: string;
    userAgent?: string;
  };
}

const mockLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: "2026-01-14 14:23:45",
    level: "error",
    source: "api-gateway",
    message: "Connection timeout to database pool",
    metadata: "pool_id: primary-db-01, timeout: 5000ms",
    details: {
      method: "POST",
      path: "/api/v1/users",
      statusCode: 504,
      duration: "5000ms",
      ip: "192.168.1.100",
    },
  },
  {
    id: "2",
    timestamp: "2026-01-14 14:23:42",
    level: "warn",
    source: "auth-service",
    message: "Rate limit approaching for IP 192.168.1.105",
    metadata: "current: 950/1000, window: 60s",
    details: {
      method: "GET",
      path: "/api/auth/verify",
      ip: "192.168.1.105",
    },
  },
  {
    id: "3",
    timestamp: "2026-01-14 14:23:38",
    level: "info",
    source: "payment-processor",
    message: "Payment processed successfully",
    metadata: "transaction_id: txn_abc123, amount: $49.99",
    details: {
      method: "POST",
      path: "/api/payments",
      statusCode: 200,
      duration: "245ms",
    },
  },
  {
    id: "4",
    timestamp: "2026-01-14 14:23:35",
    level: "info",
    source: "user-service",
    message: "New user registration completed",
    metadata: "user_id: usr_xyz789, email: user@example.com",
    details: {
      method: "POST",
      path: "/api/users/register",
      statusCode: 201,
      duration: "156ms",
    },
  },
  {
    id: "5",
    timestamp: "2026-01-14 14:23:30",
    level: "debug",
    source: "cache-manager",
    message: "Cache hit for key: user_profile_123",
    metadata: "ttl: 3600s, size: 2.4kb",
  },
  {
    id: "6",
    timestamp: "2026-01-14 14:23:28",
    level: "error",
    source: "notification-service",
    message: "Failed to send email notification",
    metadata: "smtp_error: Connection refused, recipient: user@test.com",
    details: {
      method: "POST",
      path: "/api/notifications/email",
      statusCode: 500,
      duration: "2100ms",
    },
  },
  {
    id: "7",
    timestamp: "2026-01-14 14:23:25",
    level: "info",
    source: "api-gateway",
    message: "Health check passed",
    metadata: "response_time: 12ms, status: healthy",
    details: {
      method: "GET",
      path: "/health",
      statusCode: 200,
      duration: "12ms",
    },
  },
];

export default function LogsPage() {
  const [selectedLevel, setSelectedLevel] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedLog, setSelectedLog] = React.useState<LogEntry | null>(null);
  const [hoveredLog, setHoveredLog] = React.useState<LogEntry | null>(null);
  const [hoverPosition, setHoverPosition] = React.useState({ x: 0, y: 0 });
  const [showStatsTooltip, setShowStatsTooltip] = React.useState(false);
  const [statsPosition, setStatsPosition] = React.useState({ x: 0, y: 0 });

  const filteredLogs = mockLogs.filter((log) => {
    const matchesLevel = selectedLevel === "all" || log.level === selectedLevel;
    const matchesSearch =
      searchQuery === "" ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-600 dark:text-red-400";
      case "warn":
        return "text-yellow-600 dark:text-yellow-400";
      case "info":
        return "text-blue-600 dark:text-blue-400";
      case "debug":
        return "text-gray-600 dark:text-gray-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-500/10";
      case "warn":
        return "bg-yellow-500/10";
      case "info":
        return "bg-blue-500/10";
      case "debug":
        return "bg-gray-500/10";
      default:
        return "bg-muted";
    }
  };

  // Generate deterministic chart data
  const chartData = React.useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => {
      // Use index-based deterministic values instead of Math.random()
      const seed = i * 2654435761; // Large prime number for distribution
      const height = ((seed % 100) + 1) * 0.8 + 20; // Range: 20-100
      const isError = (seed % 100) > 90;
      const isWarn = !isError && (seed % 100) > 85;
      return { height, isError, isWarn };
    });
  }, []);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Main Content */}
      <div className={`flex-1 flex flex-col ${selectedLog ? "mr-96" : ""}`}>
        {/* Chart area */}
        <div className="h-32 border-b border-border bg-muted/20 p-4">
          <div className="h-full flex items-end gap-1">
            {chartData.map((bar, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t transition-all ${
                  bar.isError
                    ? "bg-red-500/70"
                    : bar.isWarn
                    ? "bg-yellow-500/70"
                    : "bg-primary/70"
                }`}
                style={{ height: `${bar.height}%` }}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-border bg-background">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 relative">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-md bg-background"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <HugeiconsIcon icon={Download01Icon} className="h-4 w-4" />
              Export
            </Button>
          </div>

          {/* Level filters */}
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={FilterIcon}
              className="h-4 w-4 text-muted-foreground"
            />
            <button
              onClick={() => setSelectedLevel("all")}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedLevel === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedLevel("error")}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedLevel === "error"
                  ? "bg-red-500 text-white"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
              }`}
            >
              Error
            </button>
            <button
              onClick={() => setSelectedLevel("warn")}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedLevel === "warn"
                  ? "bg-yellow-500 text-white"
                  : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20"
              }`}
            >
              Warn
            </button>
            <button
              onClick={() => setSelectedLevel("info")}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedLevel === "info"
                  ? "bg-blue-500 text-white"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setSelectedLevel("debug")}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedLevel === "debug"
                  ? "bg-gray-500 text-white"
                  : "bg-gray-500/10 text-gray-600 dark:text-gray-400 hover:bg-gray-500/20"
              }`}
            >
              Debug
            </button>
            <div className="flex-1" />
            <span
              className="text-xs text-muted-foreground cursor-help relative"
              onMouseEnter={(e) => {
                setShowStatsTooltip(true);
                const rect = e.currentTarget.getBoundingClientRect();
                setStatsPosition({ x: rect.left, y: rect.bottom });
              }}
              onMouseLeave={() => setShowStatsTooltip(false)}
            >
              Total: {filteredLogs.length} • Errors:{" "}
              {mockLogs.filter((l) => l.level === "error").length} • Warnings:{" "}
              {mockLogs.filter((l) => l.level === "warn").length}
            </span>

            {/* Stats tooltip */}
            {showStatsTooltip && (
              <div
                className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-3 min-w-50 pointer-events-none"
                style={{
                  top: `${statsPosition.y + 8}px`,
                  left: `${statsPosition.x}px`,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Logs:</span>
                    <span className="font-semibold">{mockLogs.length}</span>
                  </div>
                  <div className="border-t border-border pt-2 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-muted-foreground">Errors:</span>
                      </div>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {mockLogs.filter((l) => l.level === "error").length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <span className="text-muted-foreground">Warnings:</span>
                      </div>
                      <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                        {mockLogs.filter((l) => l.level === "warn").length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-muted-foreground">Info:</span>
                      </div>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {mockLogs.filter((l) => l.level === "info").length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                        <span className="text-muted-foreground">Debug:</span>
                      </div>
                      <span className="font-semibold text-gray-600 dark:text-gray-400">
                        {mockLogs.filter((l) => l.level === "debug").length}
                      </span>
                    </div>
                  </div>
                  {selectedLevel !== "all" && (
                    <div className="border-t border-border pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Filtered:</span>
                        <span className="font-semibold text-primary">{filteredLogs.length}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Log entries */}
        <div className="flex-1 overflow-auto relative">
          {filteredLogs.map((log) => (
            <button
              key={log.id}
              onClick={() => setSelectedLog(log)}
              onMouseEnter={(e) => {
                setHoveredLog(log);
                const rect = e.currentTarget.getBoundingClientRect();
                setHoverPosition({ x: rect.left, y: rect.top });
              }}
              onMouseLeave={() => setHoveredLog(null)}
              className={`w-full text-left py-2 px-4 border-b border-border hover:bg-muted/50 transition-colors cursor-pointer ${
                selectedLog?.id === log.id ? "bg-muted/70" : ""
              }`}
            >
              <div className="grid grid-cols-[140px_70px_180px_1fr] gap-3 items-start">
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                  {log.timestamp}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded text-center ${getLevelBg(
                    log.level
                  )} ${getLevelColor(log.level)} whitespace-nowrap`}
                >
                  {log.level.toUpperCase()}
                </span>
                <span className="text-xs text-muted-foreground font-mono truncate">
                  {log.source}
                </span>
                <span className="text-sm truncate">{log.message}</span>
              </div>
            </button>
          ))}

          {/* Hover tooltip */}
          {hoveredLog && (
            <div
              className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-3 max-w-md pointer-events-none"
              style={{
                top: `${hoverPosition.y - 10}px`,
                left: `${hoverPosition.x + 400}px`,
              }}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${getLevelBg(
                      hoveredLog.level
                    )} ${getLevelColor(hoveredLog.level)}`}
                  >
                    {hoveredLog.level.toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {hoveredLog.timestamp}
                  </span>
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  {hoveredLog.source}
                </div>
                <div className="text-sm font-medium">{hoveredLog.message}</div>
                {hoveredLog.metadata && (
                  <div className="text-xs text-muted-foreground font-mono">
                    {hoveredLog.metadata}
                  </div>
                )}
                {hoveredLog.details && (
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                    {hoveredLog.details.method && hoveredLog.details.path && (
                      <div>{hoveredLog.details.method} {hoveredLog.details.path}</div>
                    )}
                    {hoveredLog.details.statusCode && (
                      <div className={hoveredLog.details.statusCode >= 400 ? "text-red-500" : "text-green-500"}>
                        Status: {hoveredLog.details.statusCode}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="p-4 text-center">
            <Button variant="outline" size="sm">
              Load More • Showing 100 results
            </Button>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedLog && (
        <div className="fixed right-0 top-0 bottom-0 w-96 bg-background border-l border-border overflow-auto animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between z-10">
            <h3 className="font-semibold">Log Details</h3>
            <button
              onClick={() => setSelectedLog(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-6">
            {/* Level */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Level</div>
              <span
                className={`inline-block text-xs font-medium px-2 py-1 rounded ${getLevelBg(
                  selectedLog.level
                )} ${getLevelColor(selectedLog.level)}`}
              >
                {selectedLog.level.toUpperCase()}
              </span>
            </div>

            {/* Timestamp */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Timestamp
              </div>
              <div className="text-sm font-mono">{selectedLog.timestamp}</div>
            </div>

            {/* Source */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Source</div>
              <div className="text-sm font-mono">{selectedLog.source}</div>
            </div>

            {/* Message */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Message</div>
              <div className="text-sm">{selectedLog.message}</div>
            </div>

            {/* Metadata */}
            {selectedLog.metadata && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Metadata
                </div>
                <div className="text-xs font-mono p-2 bg-muted/50 rounded border border-border">
                  {selectedLog.metadata}
                </div>
              </div>
            )}

            {/* Request Details */}
            {selectedLog.details && (
              <>
                <div className="border-t border-border pt-4">
                  <div className="text-xs font-semibold text-muted-foreground mb-3">
                    REQUEST DETAILS
                  </div>

                  {selectedLog.details.method && (
                    <div className="mb-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        Method
                      </div>
                      <div className="text-sm font-mono">
                        {selectedLog.details.method}
                      </div>
                    </div>
                  )}

                  {selectedLog.details.path && (
                    <div className="mb-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        Path
                      </div>
                      <div className="text-sm font-mono">
                        {selectedLog.details.path}
                      </div>
                    </div>
                  )}

                  {selectedLog.details.statusCode && (
                    <div className="mb-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        Status Code
                      </div>
                      <div
                        className={`text-sm font-mono ${
                          selectedLog.details.statusCode >= 400
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {selectedLog.details.statusCode}
                      </div>
                    </div>
                  )}

                  {selectedLog.details.duration && (
                    <div className="mb-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        Duration
                      </div>
                      <div className="text-sm font-mono">
                        {selectedLog.details.duration}
                      </div>
                    </div>
                  )}

                  {selectedLog.details.ip && (
                    <div className="mb-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        IP Address
                      </div>
                      <div className="text-sm font-mono">
                        {selectedLog.details.ip}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Actions */}
            <div className="border-t border-border pt-4">
              <Button variant="outline" size="sm" className="w-full mb-2">
                Copy Log Entry
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                View in Context
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
