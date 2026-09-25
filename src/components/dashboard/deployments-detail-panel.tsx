"use client";

import * as React from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, Cancel01Icon, GlobalIcon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/button";
import { fmtAgo, fmtDuration, fmtTime, type Deployment } from "@/lib/status";
import { useProject } from "@/lib/project-context";
import { DeploymentStatusBadge, runState, shortRepo } from "./deployments-status";

type Props = {
  deployment: Deployment;
  visible: boolean;
  onClose: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** Последняя непустая строка лога — короткий намёк на причину сбоя без раскрытия всего лога. */
function lastLogLine(log: string | null | undefined): string | null {
  if (!log) return null;
  const lines = log.trim().split("\n").filter(Boolean);
  return lines.length ? lines[lines.length - 1].trim() : null;
}

/**
 * Боковая панель деталей деплоя — по образцу Vercel: баннер сбоя сверху,
 * плотная сетка метаданных, домены/источник, лог сборки внизу. Показывает и
 * прогоны GitHub Actions (репозиторий, ссылка «Open in GitHub»), и деплои
 * через агента (`source: "scalefield"` — сервис, образ, живой лог, домены).
 */
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
  const isAgentDeploy = deployment.source === "scalefield";
  const failed = state === "failure";
  const errorLine = failed ? lastLogLine(deployment.log) : null;

  return (
    <div
      className={`absolute right-0 top-0 h-full w-full md:w-[26rem] overflow-y-auto bg-background border-l border-border shadow-xl z-20 transition-transform duration-300 ease-out ${
        visible ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-5 py-3">
        <h2 className="truncate text-sm font-semibold">
          {isAgentDeploy ? deployment.service ?? deployment.workflow : shortRepo(deployment.repo)}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
          <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <DeploymentStatusBadge state={state} />
          {!isAgentDeploy && deployment.url && (
            <a href={deployment.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
              <HugeiconsIcon icon={LinkSquare02Icon} className="h-3.5 w-3.5" />
              Open in GitHub
            </a>
          )}
        </div>

        {failed && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-destructive">
              <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
              {isAgentDeploy ? "Deploy failed" : "Run failed"}
            </div>
            <p className="break-words font-mono text-xs text-muted-foreground">{errorLine || "See the log below for details."}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          <Field label="Created">
            {fmtTime(deployment.created_at)}
            <span className="block text-xs text-muted-foreground">{fmtAgo(deployment.created_at)}</span>
          </Field>
          <Field label="Status">{deployment.status}</Field>
          <Field label="Duration">{fmtDuration(deployment.duration_s)}</Field>
          <Field label="Triggered by">
            <span className="flex items-center gap-1.5">
              {deployment.actor_avatar ? (
                <Image src={deployment.actor_avatar} alt="" width={16} height={16} className="h-4 w-4 rounded-full" />
              ) : null}
              {deployment.actor || "—"}
            </span>
          </Field>
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs text-muted-foreground">Source</p>
          {isAgentDeploy ? (
            <div className="space-y-1 font-mono text-sm">
              {deployment.image && <p className="break-all">{deployment.image}</p>}
              {deployment.branch && <p className="text-xs text-muted-foreground">branch {deployment.branch}</p>}
              {deployment.sha && <p className="text-xs text-muted-foreground">commit {deployment.sha}</p>}
            </div>
          ) : (
            <div className="font-mono text-sm">
              <p className="break-words">{deployment.title}</p>
              {(deployment.branch || deployment.sha) && (
                <p className="text-xs text-muted-foreground">
                  {deployment.branch} @ {deployment.sha}
                </p>
              )}
            </div>
          )}
        </div>

        {isAgentDeploy && deployment.domains && deployment.domains.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs text-muted-foreground">Domains</p>
            <div className="space-y-1">
              {deployment.domains.map((d) => (
                <a key={d} href={`https://${d}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm hover:underline">
                  <HugeiconsIcon icon={GlobalIcon} className="h-3.5 w-3.5 text-muted-foreground" />
                  {d}
                </a>
              ))}
            </div>
          </div>
        )}

        {deployment.log && (
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              {isAgentDeploy && deployment.status !== "completed" ? "Deploy log · running…" : "Deploy log"}
            </p>
            <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {deployment.log}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
