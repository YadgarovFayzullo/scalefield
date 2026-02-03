"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  ViewIcon,
  ViewOffSlashIcon,
  Delete02Icon,
  Add01Icon,
} from "@hugeicons/core-free-icons";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  environment: "production" | "development";
  created: string;
  lastUsed: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = React.useState<ApiKey[]>([
    {
      id: "1",
      name: "Production Key",
      key: "sk_live_***************abc123",
      environment: "production",
      created: "2 months ago",
      lastUsed: "5 min ago",
    },
    {
      id: "2",
      name: "Development Key",
      key: "sk_test_***************def456",
      environment: "development",
      created: "3 months ago",
      lastUsed: "2 hours ago",
    },
  ]);

  const [revealedKeys, setRevealedKeys] = React.useState<Set<string>>(new Set());

  const toggleKeyVisibility = (id: string) => {
    setRevealedKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Manage API keys for programmatic access
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
          New Key
        </Button>
      </div>

      {/* Status Overview - not a card, just status lines */}
      <div className="mb-6 pb-6 border-b border-border">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Active keys:</span>
            <span className="font-medium">{keys.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total requests (24h):</span>
            <span className="font-medium">1,247</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Rate limit:</span>
            <span className="font-medium">1000/min</span>
          </div>
        </div>
      </div>

      {/* Keys list - vertical flow, no cards */}
      <div className="space-y-6">
        {keys.map((apiKey) => {
          const isRevealed = revealedKeys.has(apiKey.id);
          const displayKey = isRevealed
            ? "sk_live_a1b2c3d4e5f6g7h8i9j0abc123"
            : apiKey.key;

          return (
            <div key={apiKey.id}>
              {/* Key header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold">{apiKey.name}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${apiKey.environment === "production"
                          ? "bg-green-500/10 text-green-700 dark:text-green-400"
                          : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                        }`}
                    >
                      {apiKey.environment}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>Created {apiKey.created}</div>
                    <div>Last used {apiKey.lastUsed}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
                </Button>
              </div>

              {/* Key display */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 min-w-0 px-3 py-2 bg-muted/50 rounded-md border border-border">
                  <code className="text-sm font-mono">{displayKey}</code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleKeyVisibility(apiKey.id)}
                >
                  <HugeiconsIcon
                    icon={isRevealed ? ViewOffSlashIcon : ViewIcon}
                    className="h-4 w-4"
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(displayKey)}
                >
                  <HugeiconsIcon icon={Copy01Icon} className="h-4 w-4" />
                </Button>
              </div>

              {/* Usage stats - inline, not boxed */}
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <span>Requests (24h): 847</span>
                <span>Errors: 2</span>
                <span>Avg response: 145ms</span>
              </div>

              {/* Divider between keys */}
              {apiKey.id !== keys[keys.length - 1].id && (
                <div className="mt-6 border-b border-border" />
              )}
            </div>
          );
        })}
      </div>

      {/* Help text at bottom */}
      <div className="mt-8 pt-6 border-t border-border text-sm text-muted-foreground">
        <p className="mb-2">Keep your API keys secure:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Never commit keys to version control</li>
          <li>Rotate keys regularly</li>
          <li>Use environment-specific keys</li>
        </ul>
      </div>
    </div>
  );
}
