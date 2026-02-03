"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
  Tick02Icon,
  Cancel01Icon,
  ReloadIcon,
} from "@hugeicons/core-free-icons";

interface WebhookDelivery {
  timestamp: string;
  status: "success" | "failed";
  statusCode: number;
  responseTime: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: "active" | "disabled";
  created: string;
  lastDelivery: string;
  successRate: number;
  recentDeliveries: WebhookDelivery[];
}

const mockWebhooks: Webhook[] = [
  {
    id: "1",
    url: "https://api.example.com/webhooks/payments",
    events: ["payment.success", "payment.failed", "payment.refunded"],
    status: "active",
    created: "2 months ago",
    lastDelivery: "2 min ago",
    successRate: 99.8,
    recentDeliveries: [
      { timestamp: "14:23", status: "success", statusCode: 200, responseTime: "145ms" },
      { timestamp: "14:18", status: "success", statusCode: 200, responseTime: "132ms" },
      { timestamp: "14:12", status: "failed", statusCode: 500, responseTime: "5000ms" },
      { timestamp: "14:08", status: "success", statusCode: 200, responseTime: "156ms" },
      { timestamp: "14:02", status: "success", statusCode: 200, responseTime: "141ms" },
    ],
  },
  {
    id: "2",
    url: "https://webhook.site/a1b2c3d4",
    events: ["user.created", "user.updated", "user.deleted"],
    status: "active",
    created: "1 month ago",
    lastDelivery: "15 min ago",
    successRate: 100,
    recentDeliveries: [
      { timestamp: "14:08", status: "success", statusCode: 200, responseTime: "98ms" },
      { timestamp: "13:45", status: "success", statusCode: 200, responseTime: "102ms" },
      { timestamp: "13:22", status: "success", statusCode: 200, responseTime: "95ms" },
      { timestamp: "12:58", status: "success", statusCode: 200, responseTime: "110ms" },
      { timestamp: "12:34", status: "success", statusCode: 200, responseTime: "89ms" },
    ],
  },
  {
    id: "3",
    url: "https://api.slack.com/hooks/T00000000/B00000000",
    events: ["deployment.started", "deployment.completed", "deployment.failed"],
    status: "disabled",
    created: "3 weeks ago",
    lastDelivery: "3 days ago",
    successRate: 87.5,
    recentDeliveries: [
      { timestamp: "Jan 11 18:45", status: "failed", statusCode: 404, responseTime: "1200ms" },
      { timestamp: "Jan 11 16:22", status: "failed", statusCode: 404, responseTime: "1150ms" },
      { timestamp: "Jan 11 14:10", status: "success", statusCode: 200, responseTime: "234ms" },
      { timestamp: "Jan 10 22:30", status: "success", statusCode: 200, responseTime: "245ms" },
      { timestamp: "Jan 10 18:15", status: "failed", statusCode: 500, responseTime: "5000ms" },
    ],
  },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = React.useState<Webhook[]>(mockWebhooks);
  const [expandedWebhook, setExpandedWebhook] = React.useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedWebhook(expandedWebhook === id ? null : id);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Configure endpoints to receive real-time event notifications
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
          New Webhook
        </Button>
      </div>

      {/* Status overview */}
      <div className="mb-6 pb-6 border-b border-border">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Active webhooks:</span>
            <span className="font-medium">
              {webhooks.filter((w) => w.status === "active").length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Deliveries (24h):</span>
            <span className="font-medium">1,847</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Average success rate:</span>
            <span className="font-medium">98.2%</span>
          </div>
        </div>
      </div>

      {/* Webhooks list */}
      <div className="space-y-6">
        {webhooks.map((webhook) => {
          const isExpanded = expandedWebhook === webhook.id;

          return (
            <div key={webhook.id}>
              {/* Webhook header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        webhook.status === "active"
                          ? "bg-green-500/10 text-green-700 dark:text-green-400"
                          : "bg-gray-500/10 text-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {webhook.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Created {webhook.created}
                    </span>
                  </div>
                  <div className="text-sm font-mono text-muted-foreground mb-2 break-all">
                    {webhook.url}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {webhook.events.map((event) => (
                      <span
                        key={event}
                        className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button variant="ghost" size="sm">
                    <HugeiconsIcon icon={Edit02Icon} className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Stats line */}
              <div className="flex items-center gap-6 text-xs text-muted-foreground mb-3">
                <span>Last delivery: {webhook.lastDelivery}</span>
                <span>Success rate: {webhook.successRate}%</span>
                <span>Deliveries: {webhook.recentDeliveries.length}</span>
              </div>

              {/* Recent deliveries toggle */}
              <button
                onClick={() => toggleExpanded(webhook.id)}
                className="text-xs text-primary hover:underline mb-3"
              >
                {isExpanded ? "Hide" : "Show"} recent deliveries
              </button>

              {/* Recent deliveries - expanded state */}
              {isExpanded && (
                <div className="mb-3 pl-4 border-l-2 border-border">
                  <div className="space-y-2">
                    {webhook.recentDeliveries.map((delivery, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-4 text-xs py-1.5"
                      >
                        <span className="text-muted-foreground font-mono w-16">
                          {delivery.timestamp}
                        </span>
                        <HugeiconsIcon
                          icon={
                            delivery.status === "success"
                              ? Tick02Icon
                              : Cancel01Icon
                          }
                          className={`h-3.5 w-3.5 ${
                            delivery.status === "success"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        />
                        <span
                          className={`font-mono ${
                            delivery.status === "success"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {delivery.statusCode}
                        </span>
                        <span className="text-muted-foreground">
                          {delivery.responseTime}
                        </span>
                        {delivery.status === "failed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 gap-1 ml-auto"
                          >
                            <HugeiconsIcon
                              icon={ReloadIcon}
                              className="h-3 w-3"
                            />
                            Retry
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider */}
              {webhook.id !== webhooks[webhooks.length - 1].id && (
                <div className="mt-6 border-b border-border" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
