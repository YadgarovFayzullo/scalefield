"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Line, LineChart, Bar, BarChart } from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick02Icon,
  Cancel01Icon,
  Time01Icon,
  Alert02Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Activity03Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";

interface Service {
  id: string;
  name: string;
  status: "operational" | "degraded" | "down" | "maintenance";
  uptime: number;
  latency: string;
  lastChecked: string;
  region: string;
  endpoint?: string;
}

interface Incident {
  id: string;
  timestamp: string;
  service: string;
  severity: "critical" | "major" | "minor";
  status: "investigating" | "identified" | "monitoring" | "resolved";
  title: string;
  updates?: string[];
}

const mockServices: Service[] = [
  {
    id: "1",
    name: "API Gateway",
    status: "operational",
    uptime: 99.99,
    latency: "45ms",
    lastChecked: "30s ago",
    region: "us-east-1",
    endpoint: "api.example.com",
  },
  {
    id: "2",
    name: "Auth Service",
    status: "operational",
    uptime: 99.95,
    latency: "32ms",
    lastChecked: "30s ago",
    region: "us-east-1",
    endpoint: "auth.example.com",
  },
  {
    id: "3",
    name: "Database Primary",
    status: "operational",
    uptime: 100,
    latency: "12ms",
    lastChecked: "30s ago",
    region: "us-east-1",
  },
  {
    id: "4",
    name: "Database Replica",
    status: "degraded",
    uptime: 98.2,
    latency: "340ms",
    lastChecked: "30s ago",
    region: "us-west-2",
  },
  {
    id: "5",
    name: "Storage Service",
    status: "operational",
    uptime: 99.98,
    latency: "89ms",
    lastChecked: "30s ago",
    region: "us-east-1",
    endpoint: "storage.example.com",
  },
  {
    id: "6",
    name: "CDN",
    status: "operational",
    uptime: 99.99,
    latency: "15ms",
    lastChecked: "30s ago",
    region: "global",
    endpoint: "cdn.example.com",
  },
  {
    id: "7",
    name: "Payment Processor",
    status: "maintenance",
    uptime: 99.5,
    latency: "—",
    lastChecked: "5 min ago",
    region: "us-east-1",
  },
  {
    id: "8",
    name: "Notification Service",
    status: "operational",
    uptime: 99.92,
    latency: "120ms",
    lastChecked: "30s ago",
    region: "us-east-1",
  },
];

const mockIncidents: Incident[] = [
  {
    id: "1",
    timestamp: "2026-01-14 13:45",
    service: "Database Replica",
    severity: "major",
    status: "monitoring",
    title: "Increased latency in us-west-2 region",
    updates: [
      "14:20 - Latency has improved from 450ms to 340ms",
      "14:00 - Identified network congestion, working with provider",
      "13:45 - Investigating increased response times",
    ],
  },
  {
    id: "2",
    timestamp: "2026-01-14 10:30",
    service: "Payment Processor",
    severity: "minor",
    status: "resolved",
    title: "Scheduled maintenance completed",
    updates: [
      "11:15 - Maintenance completed, all systems operational",
      "10:30 - Starting scheduled maintenance window",
    ],
  },
];

// Mock uptime data for last 30 days
const uptimeData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  uptime: 99.5 + Math.random() * 0.5,
}));

// Mock incident count data for last 7 days
const incidentData = Array.from({ length: 7 }, (_, i) => ({
  day: i + 1,
  incidents: i === 5 ? 2 : Math.floor(Math.random() * 2),
}));

export default function MonitoringPage() {
  const [services, setServices] = React.useState<Service[]>(mockServices);
  const [expandedIncident, setExpandedIncident] = React.useState<string | null>(
    null
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "text-green-600 dark:text-green-400";
      case "degraded":
        return "text-yellow-600 dark:text-yellow-400";
      case "down":
        return "text-red-600 dark:text-red-400";
      case "maintenance":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return Tick02Icon;
      case "degraded":
      case "maintenance":
        return Alert02Icon;
      case "down":
        return Cancel01Icon;
      default:
        return Time01Icon;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-700 dark:text-red-400";
      case "major":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "minor":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const operationalCount = services.filter(
    (s) => s.status === "operational"
  ).length;
  const totalServices = services.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          System status and service health
        </p>
      </div>

      {/* System Status Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {/* All Systems Operational */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4 text-green-600" />
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-lg font-semibold text-green-600">All Systems Operational</div>
              <div className="text-xs text-muted-foreground mt-1">
                Last checked: 30 seconds ago
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services Online */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Activity03Icon} className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Services Online</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-2xl font-semibold">{operationalCount} / {totalServices}</div>
              <div className="text-xs text-muted-foreground mt-1">
                2 services under maintenance
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`h-1.5 flex-1 rounded-full ${
                    service.status === "operational"
                      ? "bg-green-500"
                      : service.status === "degraded"
                      ? "bg-yellow-500"
                      : service.status === "maintenance"
                      ? "bg-blue-500"
                      : "bg-red-500"
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Uptime & Incidents */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Uptime & Incidents</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Average uptime (30d):</span>
              <span className="text-sm font-semibold">99.87%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Active incidents:</span>
              <span className="text-sm font-semibold text-yellow-600">
                {mockIncidents.filter((i) => i.status !== "resolved").length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active incidents */}
      {mockIncidents.some((i) => i.status !== "resolved") && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Active Incidents
          </h2>

          <div className="space-y-4">
            {mockIncidents
              .filter((incident) => incident.status !== "resolved")
              .map((incident) => {
                const isExpanded = expandedIncident === incident.id;

                return (
                  <div key={incident.id} className="pb-4 border-b border-border">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getSeverityColor(
                              incident.severity
                            )}`}
                          >
                            {incident.severity}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {incident.service}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium mb-1">
                          {incident.title}
                        </h3>
                        <div className="text-xs text-muted-foreground">
                          Started {incident.timestamp} • Status: {incident.status}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedIncident(
                            isExpanded ? null : incident.id
                          )
                        }
                      >
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          className={`h-4 w-4 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </Button>
                    </div>

                    {isExpanded && incident.updates && (
                      <div className="mt-3 pl-4 border-l-2 border-border space-y-2">
                        {incident.updates.map((update, idx) => (
                          <div key={idx} className="text-xs">
                            <p className="text-muted-foreground">{update}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Services list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Services
        </h2>

        <div className="space-y-0">
          {services.map((service, index) => (
            <div
              key={service.id}
              className={`py-3 border-b border-border hover:bg-muted/30 transition-colors ${
                index === 0 ? "border-t" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <HugeiconsIcon
                    icon={getStatusIcon(service.status)}
                    className={`h-4 w-4 flex-shrink-0 ${getStatusColor(
                      service.status
                    )}`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">
                        {service.name}
                      </span>
                      {service.endpoint && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {service.endpoint}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {service.region}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div className="text-right">
                    <div className="text-muted-foreground">Uptime</div>
                    <div className="font-medium">{service.uptime}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">Latency</div>
                    <div className="font-medium">{service.latency}</div>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <div className="text-muted-foreground">Checked</div>
                    <div className="font-medium">{service.lastChecked}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent history link */}
      <div className="mt-6 pt-6 border-t border-border">
        <Button variant="outline" size="sm">
          View Incident History
        </Button>
      </div>
    </div>
  );
}
