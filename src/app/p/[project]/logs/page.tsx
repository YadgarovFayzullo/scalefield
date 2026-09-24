"use client";

/**
 * Logs page: two live sources behind one toolbar — the proxy access log and
 * a container's stdout. Source, level, search and auto-refresh live here;
 * host / container choice and the selected entry live inside each view.
 */
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { LogsAccessView } from "@/components/dashboard/logs-access";
import { LogsContainerView } from "@/components/dashboard/logs-container";
import type { LevelFilter } from "@/components/dashboard/logs-shared";

type Source = "access" | "container";

const SOURCES: { value: Source; label: string }[] = [
  { value: "access", label: "Access log" },
  { value: "container", label: "Container logs" },
];

export default function LogsPage() {
  const [source, setSource] = React.useState<Source>("access");
  const [level, setLevel] = React.useState<LevelFilter>("all");
  const [search, setSearch] = React.useState("");
  const [auto, setAuto] = React.useState(true);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-border bg-background">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
              {SOURCES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSource(s.value)}
                  aria-pressed={source === s.value}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    source === s.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-48 relative">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              />
              <Input
                type="text"
                placeholder={source === "access" ? "Search by request path…" : "Search by message…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Switch size="sm" checked={auto} onCheckedChange={(v: boolean) => setAuto(v)} />
              Auto-refresh {auto ? "on" : "off"}
            </label>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {source === "access" ? (
            <LogsAccessView level={level} onLevelChange={setLevel} search={search} auto={auto} />
          ) : (
            <LogsContainerView level={level} onLevelChange={setLevel} search={search} auto={auto} />
          )}
        </div>
      </div>
    </div>
  );
}
