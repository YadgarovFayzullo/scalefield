"use client";

import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/button";
import * as React from "react";
import { fmtAgo, fmtDuration, fmtTime, type Deployment } from "@/lib/status";
import { useProject } from "@/lib/project-context";
import { DeploymentStatusBadge, runState, shortRepo } from "./deployments-status";

type Props = {
  deployment: Deployment;
  visible: boolean;
  onClose: () => void;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right min-w-0 break-words">{children}</span>
    </div>
  );
}

/** Slide-in side panel with every field of the selected GitHub Actions run. */
export function DeploymentDetailPanel({ deployment: initial, visible, onClose }: Props) {
  const { apiBase } = useProject();
  // Деплой через агента, пока идёт, поллим сами раз в 2 с — список
  // обновляется реже, а лог должен расти на глазах.
  const [live, setLive] = React.useState<Deployment | null>(null);
  React.useEffect(() => {
    setLive(null);
    if (initial.source !== "scalefield" || initial.status === "completed") return;
    const id = initial.id;
    const tick = async () => {
      try {
        const res = await fetch(`${apiBase}/deployments/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { deployment: Deployment };
        setLive(json.deployment);
        if (json.deployment.status === "completed") clearInterval(t);
      } catch {
        /* сеть моргнула — попробуем на следующем тике */
      }
    };
    const t = setInterval(() => void tick(), 2000);
    void tick();
    return () => clearInterval(t);
  }, [initial.id, initial.source, initial.status, apiBase]);
  const deployment = live ?? initial;
  const state = runState(deployment);
  const runNumber = deployment.id.split("#").pop() ?? deployment.id;

  return (
    <div
      className={`absolute right-0 top-0 h-full w-full md:w-96 overflow-y-auto bg-background border-l border-border shadow-xl z-20 transition-transform duration-300 ease-out ${
        visible ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="px-6 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold truncate">
              {shortRepo(deployment.repo)}{" "}
              <span className="text-muted-foreground font-normal">#{runNumber}</span>
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" />
            </button>
          </div>
          <div className="mb-6">
            <DeploymentStatusBadge state={state} />
          </div>

          <a
            href={deployment.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "sm", variant: "outline", className: "w-full" })}
          >
            <HugeiconsIcon icon={LinkSquare02Icon} className="h-4 w-4" />
            Open in GitHub
          </a>
        </div>

        <div className="space-y-4">
          <div className="pb-4 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Run
            </h3>
            <div className="space-y-2 text-sm">
              <Row label="Repository">{deployment.repo}</Row>
              <Row label="Workflow">{deployment.workflow}</Row>
              <Row label="Event">{deployment.event}</Row>
              <Row label="Status">{deployment.status}</Row>
              <Row label="Conclusion">{deployment.conclusion ?? "—"}</Row>
              <Row label="Duration">{fmtDuration(deployment.duration_s)}</Row>
            </div>
          </div>

          <div className="pb-4 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Timing
            </h3>
            <div className="space-y-2 text-sm">
              <Row label="Started">
                {fmtTime(deployment.created_at)}
                <span className="block text-xs text-muted-foreground font-normal">
                  {fmtAgo(deployment.created_at)}
                </span>
              </Row>
              <Row label="Updated">
                {fmtTime(deployment.updated_at)}
                <span className="block text-xs text-muted-foreground font-normal">
                  {fmtAgo(deployment.updated_at)}
                </span>
              </Row>
            </div>
          </div>

          <div className="pb-4 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Triggered by
            </h3>
            <div className="flex items-center gap-3 text-sm">
              {deployment.actor_avatar ? (
                <Image
                  src={deployment.actor_avatar}
                  alt={deployment.actor}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full shrink-0"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
              )}
              <span className="font-medium">{deployment.actor || "—"}</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Commit
            </h3>
            <p className="text-sm mb-2 break-words">{deployment.title}</p>
            {(deployment.branch || deployment.sha) && (
              <p className="text-xs text-muted-foreground font-mono">
                {deployment.branch} @ {deployment.sha}
              </p>
            )}
          </div>

          {deployment.log && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Deploy log
              </h3>
              <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] whitespace-pre-wrap">
                {deployment.log}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
