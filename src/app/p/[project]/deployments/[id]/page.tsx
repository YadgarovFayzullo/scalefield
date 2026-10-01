"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, ArrowLeft01Icon, GlobalIcon, LinkSquare02Icon, RocketIcon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/button";
import { useProject } from "@/lib/project-context";
import { fmtAgo, fmtDuration, type Deployment } from "@/lib/status";
import { api } from "@/lib/tables";
import { DeploymentStatusBadge, environmentOf, runState, shortRepo } from "@/components/dashboard/deployments-status";
import { cn } from "@/lib/utils";

/** Последняя непустая строка лога — короткий намёк на причину сбоя без раскрытия всего лога. */
function lastLogLine(log: string | null | undefined): string | null {
  if (!log) return null;
  const lines = log.trim().split("\n").filter(Boolean);
  return lines.length ? lines[lines.length - 1].trim() : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/**
 * Страница одного деплоя — свой адрес, а не боковая панель, по образцу
 * Vercel: хлебная крошка назад к списку, баннер сбоя, сетка метаданных,
 * домены/источник, лог. У нас нет превью-скриншота, вкладок Resources/Open
 * Graph и рекомендаций — этого функционала просто не существует, честнее
 * не изображать его, чем показывать пустые вкладки.
 */
export default function DeploymentDetailPage() {
  const { apiBase, pathBase } = useProject();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);

  const [deployment, setDeployment] = React.useState<Deployment | null>(null);
  const [lines, setLines] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const linesRef = React.useRef<string[]>([]);

  const load = React.useCallback(async () => {
    try {
      const res = await api<{ deployment: Deployment }>(`${apiBase}/deployments/${encodeURIComponent(id)}`);
      linesRef.current = res.deployment.log ? res.deployment.log.split("\n") : [];
      setLines(linesRef.current);
      setDeployment(res.deployment);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [apiBase, id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const running = Boolean(deployment && deployment.source === "scalefield" && deployment.status !== "completed");

  // Живой лог как у Vercel: пока задача агента идёт, раз в секунду забираем
  // только новые строки (`?since=`) и дописываем их, а не грузим лог заново.
  React.useEffect(() => {
    if (!running) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await api<{ deployment: Deployment }>(
          `${apiBase}/deployments/${encodeURIComponent(id)}?since=${linesRef.current.length}`,
        );
        if (stopped) return;
        const fresh = res.deployment.log_lines ?? [];
        if (fresh.length) {
          linesRef.current = [...linesRef.current, ...fresh];
          setLines(linesRef.current);
        }
        setDeployment({ ...res.deployment, log: null });
        if (res.deployment.status === "completed") return;
      } catch {
        // сеть мигнула — следующий тик повторит
      }
      if (!stopped) timer = setTimeout(() => void tick(), 1000);
    };
    timer = setTimeout(() => void tick(), 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [running, apiBase, id]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href={`${pathBase}/deployments`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
        Deployments
      </Link>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error || !deployment ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="mb-1 font-medium text-destructive">Deployment not found</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      ) : (
        <DeploymentDetail deployment={deployment} lines={lines} />
      )}
    </div>
  );
}

function DeploymentDetail({ deployment, lines }: { deployment: Deployment; lines: string[] }) {
  const state = runState(deployment);
  const env = environmentOf(deployment);
  const isAgentDeploy = deployment.source === "scalefield";
  const failed = state === "failure";
  const live = isAgentDeploy && deployment.status !== "completed";
  const errorLine = failed ? lastLogLine(lines.join("\n")) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2">
            <DeploymentStatusBadge state={state} />
          </div>
          <h1 className="break-words text-xl font-semibold">
            {deployment.title || (isAgentDeploy ? `${deployment.service ?? "service"} deploy` : "(no message)")}
          </h1>
        </div>
        {!isAgentDeploy && deployment.url ? (
          <a href={deployment.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
            <HugeiconsIcon icon={LinkSquare02Icon} className="h-4 w-4" />
            Open in GitHub
          </a>
        ) : isAgentDeploy && deployment.service ? (
          <Link href="../../services" className={buttonVariants({ size: "sm", variant: "outline" })}>
            <HugeiconsIcon icon={RocketIcon} className="h-4 w-4" />
            Go to service
          </Link>
        ) : null}
      </div>

      {failed && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-destructive">
            <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
            {isAgentDeploy ? "Deploy failed" : "Run failed"}
          </div>
          <p className="break-words font-mono text-xs text-muted-foreground">{errorLine || "See the log below for details."}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 rounded-xl border border-border p-5 sm:grid-cols-4">
        <Field label="Created">
          <span className="flex items-center gap-1.5">
            {deployment.actor_avatar ? (
              <Image src={deployment.actor_avatar} alt="" width={16} height={16} className="h-4 w-4 rounded-full" />
            ) : null}
            {deployment.actor || "—"}
          </span>
          <span className="block text-xs text-muted-foreground">{fmtAgo(deployment.created_at)}</span>
        </Field>
        <Field label="Status">{deployment.status}</Field>
        <Field label="Duration">{fmtDuration(deployment.duration_s)}</Field>
        <Field label="Environment">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              env === "production" ? "bg-blue-500 text-white" : "border border-border text-muted-foreground",
            )}
          >
            {env === "production" ? "Production" : "Preview"}
          </span>
        </Field>
      </div>

      {isAgentDeploy && deployment.domains && deployment.domains.length > 0 && (
        <div className="rounded-xl border border-border p-5">
          <p className="mb-2 text-xs text-muted-foreground">Domains</p>
          <div className="space-y-1.5">
            {deployment.domains.map((d) => (
              <a key={d} href={`https://${d}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm hover:underline">
                <HugeiconsIcon icon={GlobalIcon} className="h-3.5 w-3.5 text-muted-foreground" />
                {d}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border p-5">
        <p className="mb-2 text-xs text-muted-foreground">Source</p>
        {isAgentDeploy ? (
          <div className="space-y-1 font-mono text-sm">
            {deployment.image && <p className="break-all">{deployment.image}</p>}
            {deployment.branch && <p className="text-xs text-muted-foreground">branch {deployment.branch}</p>}
            {deployment.sha && <p className="text-xs text-muted-foreground">commit {deployment.sha}</p>}
          </div>
        ) : (
          <div className="font-mono text-sm">
            <p className="text-muted-foreground">{shortRepo(deployment.repo)}</p>
            {(deployment.branch || deployment.sha) && (
              <p className="text-xs text-muted-foreground">
                {deployment.branch} @ {deployment.sha}
              </p>
            )}
          </div>
        )}
      </div>

      {(lines.length > 0 || live) && <LiveLog lines={lines} live={live} failed={failed} startedAt={deployment.created_at} />}
    </div>
  );
}

const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

function lineTone(line: string): string {
  if (line.startsWith("==> ")) return "font-semibold text-foreground";
  if (/^(ERROR|error|fatal)\b|\bERROR:/.test(line)) return "text-destructive";
  if (/^warning\b|\bWARN(ING)?\b/i.test(line)) return "text-amber-600 dark:text-amber-400";
  if (line.startsWith("$ ")) return "text-blue-600 dark:text-blue-400";
  return "text-muted-foreground";
}

/**
 * Лог деплоя как у Vercel: номера строк, этапы (`==> …`), ошибки красным,
 * пока идёт — индикатор Live и таймер, окно само едет вниз, пока пользователь
 * не прокрутил его вверх читать.
 */
function LiveLog({ lines, live, failed, startedAt }: { lines: string[]; live: boolean; failed: boolean; startedAt: string }) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const followRef = React.useRef(true);
  const [now, setNow] = React.useState(() => Date.now());
  const clean = React.useMemo(() => lines.map((l) => l.replace(ANSI_RE, "")), [lines]);
  const steps = React.useMemo(
    () => clean.flatMap((l, i) => (l.startsWith("==> ") ? [{ i, name: l.slice(4) }] : [])),
    [clean],
  );

  React.useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  React.useLayoutEffect(() => {
    const box = boxRef.current;
    if (box && followRef.current) box.scrollTop = box.scrollHeight;
  }, [clean]);

  const onScroll = () => {
    const box = boxRef.current;
    if (box) followRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  };

  const jump = (i: number) => {
    const row = boxRef.current?.querySelector<HTMLElement>(`[data-line="${i}"]`);
    if (row && boxRef.current) {
      followRef.current = false;
      boxRef.current.scrollTop = row.offsetTop - 8;
    }
  };

  const elapsed = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));

  return (
    <div className="rounded-xl border border-border p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Build Log</span>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-0.5 font-medium text-blue-600 dark:text-blue-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            Live · {fmtDuration(elapsed)}
          </span>
        )}
        <span className="ml-auto">{clean.length} lines</span>
      </div>
      {steps.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {steps.map((s, n) => {
            const last = n === steps.length - 1;
            const current = live && last;
            const broke = failed && last;
            return (
              <button
                key={s.i}
                type="button"
                onClick={() => jump(s.i)}
                className={cn(
                  "rounded-md border border-border px-2 py-0.5 font-mono text-[11px] hover:bg-muted",
                  current ? "border-blue-500/50 text-blue-600 dark:text-blue-400" : broke ? "border-destructive/50 text-destructive" : "text-muted-foreground",
                )}
              >
                {current ? "● " : broke ? "✗ " : "✓ "}
                {s.name}
              </button>
            );
          })}
        </div>
      )}
      <div
        ref={boxRef}
        onScroll={onScroll}
        className="relative max-h-[36rem] overflow-auto rounded-md border border-border bg-muted/40 py-2 font-mono text-[11px] leading-relaxed"
      >
        {clean.length === 0 ? (
          <div className="px-3 text-muted-foreground">Waiting for output…</div>
        ) : (
          clean.map((line, i) => (
            <div key={i} data-line={i} className="flex gap-3 px-3 hover:bg-muted">
              <span className="w-8 shrink-0 select-none text-right text-muted-foreground/50">{i + 1}</span>
              <span className={cn("min-w-0 flex-1 whitespace-pre-wrap break-words", lineTone(line))}>{line || " "}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
