"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Deployments Page
 *
 * Workflow: Monitor deployments → Identify failures → Rollback/Debug
 * Primary states: Success, In Progress, Failed, Cancelled
 * Decision points: View logs, rollback, redeploy
 */

// Mock deployment data
const deployments = [
  {
    id: "847",
    project: "api-gateway",
    version: "v2.1.4",
    status: "success",
    environment: "production",
    duration: "2m 34s",
    time: "2 min ago",
    author: "john@company.com",
    commit: "Fix rate limiting",
  },
  {
    id: "1203",
    project: "user-service",
    version: "v1.3.2",
    status: "in_progress",
    environment: "staging",
    duration: "1m 12s",
    time: "5 min ago",
    author: "sarah@company.com",
    commit: "Add profile update endpoint",
  },
  {
    id: "456",
    project: "auth-service",
    version: "v1.8.2",
    status: "success",
    environment: "production",
    duration: "3m 01s",
    time: "1 hour ago",
    author: "mike@company.com",
    commit: "Update JWT validation",
  },
  {
    id: "2341",
    project: "frontend-app",
    version: "v3.2.1",
    status: "success",
    environment: "production",
    duration: "4m 22s",
    time: "2 hours ago",
    author: "emma@company.com",
    commit: "UI improvements for dashboard",
  },
  {
    id: "1198",
    project: "payment-processor",
    version: "v3.0.0",
    status: "failed",
    environment: "production",
    duration: "1m 05s",
    time: "3 hours ago",
    author: "alex@company.com",
    commit: "Major refactor of payment flow",
  },
  {
    id: "845",
    project: "api-gateway",
    version: "v2.1.3",
    status: "success",
    environment: "production",
    duration: "2m 18s",
    time: "4 hours ago",
    author: "john@company.com",
    commit: "Performance optimizations",
  },
];

const statusConfig = {
  success: {
    label: "Success",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
  },
  in_progress: {
    label: "In Progress",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
  },
  failed: {
    label: "Failed",
    color: "text-red-600",
    bgColor: "bg-red-500/10",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-gray-600",
    bgColor: "bg-gray-500/10",
  },
};

export default function DeploymentsPage() {
  const [selectedDeployment, setSelectedDeployment] = React.useState<string | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<string>("all");
  const [isPanelVisible, setIsPanelVisible] = React.useState(false);
  const [displayedDeployment, setDisplayedDeployment] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (selectedDeployment) {
      setDisplayedDeployment(selectedDeployment);
      setTimeout(() => setIsPanelVisible(true), 10);
    } else {
      setIsPanelVisible(false);
      setTimeout(() => setDisplayedDeployment(null), 300);
    }
  }, [selectedDeployment]);

  const filteredDeployments =
    filterStatus === "all"
      ? deployments
      : deployments.filter((d) => d.status === filterStatus);

  const selected = deployments.find((d) => d.id === displayedDeployment);

  return (
    <div className="relative flex flex-col md:flex-row h-[calc(100vh-57px)]">
      {/* Main deployment list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-1">Deployments</h1>
            <p className="text-sm text-muted-foreground">
              {filteredDeployments.length} deployments
            </p>
          </div>

          {/* Filters - simple, functional */}
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filterStatus === "all"
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus("success")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filterStatus === "success"
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Success
            </button>
            <button
              onClick={() => setFilterStatus("in_progress")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filterStatus === "in_progress"
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setFilterStatus("failed")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filterStatus === "failed"
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Failed
            </button>
          </div>

          {/* Deployment list - vertical flow */}
          <div className="space-y-2">
            {filteredDeployments.map((deployment) => {
              const config = statusConfig[deployment.status as keyof typeof statusConfig];
              return (
                <button
                  key={deployment.id}
                  onClick={() => setSelectedDeployment(selectedDeployment === deployment.id ? null : deployment.id)}
                  className={`w-full text-left px-4 py-3 border border-border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer ${
                    selectedDeployment === deployment.id ? "bg-muted/50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{deployment.project}</span>
                        <span className="text-xs text-muted-foreground">#{deployment.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{deployment.commit}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{deployment.version}</span>
                        <span>•</span>
                        <span>{deployment.environment}</span>
                        <span>•</span>
                        <span>{deployment.duration}</span>
                        <span>•</span>
                        <span>{deployment.author}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {deployment.time}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <div className={`absolute right-0 top-0 h-full w-full md:w-96 overflow-y-auto bg-background border-l border-border shadow-xl z-20 transition-transform duration-300 ease-out ${isPanelVisible ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="px-6 py-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Build #{selected.id}</h2>
                <button
                  onClick={() => setSelectedDeployment(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Actions based on status */}
              {selected.status !== "in_progress" && (
                <div className="space-y-2 mb-6">
                  {selected.status === "success" && (
                    <>
                      <Button size="sm" variant="outline" className="w-full">
                        Rollback
                      </Button>
                      <Button size="sm" variant="outline" className="w-full">
                        View Logs
                      </Button>
                    </>
                  )}
                  {selected.status === "failed" && (
                    <>
                      <Button size="sm" className="w-full">
                        Redeploy
                      </Button>
                      <Button size="sm" variant="outline" className="w-full">
                        View Logs
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Deployment details */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Project</span>
                    <span className="font-medium">{selected.project}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-medium">{selected.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Environment</span>
                    <span className="font-medium">{selected.environment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">{selected.duration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deployed By</span>
                    <span className="font-medium">{selected.author}</span>
                  </div>
                </div>
              </div>

              <div className="pb-4 border-b border-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Build Steps
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                      ✓
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Clone repository</p>
                      <p className="text-xs text-muted-foreground">12s</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                      ✓
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Install dependencies</p>
                      <p className="text-xs text-muted-foreground">45s</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                      ✓
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Run tests</p>
                      <p className="text-xs text-muted-foreground">1m 8s</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                      ✓
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Build application</p>
                      <p className="text-xs text-muted-foreground">29s</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Commit
                </h3>
                <p className="text-sm mb-2">{selected.commit}</p>
                <p className="text-xs text-muted-foreground font-mono">abc123def456</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
