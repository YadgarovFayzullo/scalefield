"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/tables";
import type { AgentJob, ProxyState } from "@/lib/servers";

/**
 * «Домены и HTTPS» на странице сервера: кто держит 80/443 (agent/app/proxy.py).
 * Traefik в сети edge — всё работает. Иначе — что именно не так и кнопка,
 * которая чинит: свой Traefik подключает к edge, чужой прокси (nginx, Caddy…)
 * заменяет нашим Traefik, пустые порты — ставит Traefik. Замена
 * останавливает прокси, поэтому только после подтверждения; если Traefik не
 * поднялся, агент возвращает прежний прокси сам.
 */
export function ServerProxyCard({ serverId }: { serverId: string }) {
  const [state, setState] = React.useState<ProxyState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const [job, setJob] = React.useState<AgentJob | null>(null);
  const [lines, setLines] = React.useState<string[]>([]);

  const load = React.useCallback(async () => {
    try {
      const res = await api<{ proxy: ProxyState }>(`/api/servers/${serverId}/proxy`);
      setState(res.proxy);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [serverId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Живой лог задачи, пока она идёт; по завершении — перепроверить порты.
  const running = job && (job.status === "queued" || job.status === "running");
  React.useEffect(() => {
    if (!job || !running) return;
    const t = setInterval(async () => {
      try {
        const res = await api<{ job: AgentJob }>(`/api/servers/${serverId}/proxy?job=${job.id}&since=${lines.length}`);
        setLines((prev) => [...prev, ...res.job.lines]);
        setJob(res.job);
        if (res.job.status === "succeeded" || res.job.status === "failed") void load();
      } catch {
        /* следующий тик */
      }
    }, 1500);
    return () => clearInterval(t);
  }, [job, running, serverId, lines.length, load]);

  async function fix() {
    setConfirm(false);
    setError(null);
    setLines([]);
    try {
      const res = await api<{ job: AgentJob }>(`/api/servers/${serverId}/proxy`, { method: "POST", body: "{}" });
      setJob(res.job);
      setLines(res.job.lines);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!state && !error) return null;
  // Старый агент без /proxy — не пугаем, просто молчим.
  if (!state && error && /404|Not Found/i.test(error)) return null;

  const holder = state?.holder;
  const who = holder ? (holder.type === "container" ? `${holder.name} (${holder.image})` : `${holder.name} on the host`) : "";
  const text = !state
    ? { title: "Could not check ports 80/443", body: error || "" }
    : state.ok
      ? { title: "Domains and HTTPS work", body: `Traefik${holder ? ` (${holder.name})` : ""} on the edge network serves ports 80/443.` }
      : state.kind === "traefik"
        ? {
            title: "Traefik is not on the edge network",
            body: `${who} holds ports 80/443 but does not see the edge network, so project domains don't reach their containers.`,
          }
        : state.kind === "other"
          ? {
              title: `${holder?.name ?? "Another proxy"} holds ports 80/443`,
              body: `${who} serves ports 80/443. Project domains and HTTPS from Scalefield won't work, and Analytics/Logs stay empty until Traefik takes over.`,
            }
          : { title: "Nothing serves ports 80/443", body: "Install Traefik to give projects domains and HTTPS." };

  const button = state?.action === "attach" ? "Attach to edge" : state?.action === "replace" ? "Replace with Traefik" : state?.action === "install" ? "Install Traefik" : null;

  return (
    <section className={`mb-6 rounded-xl border p-4 ${state?.ok ? "border-border" : "border-amber-500/40 bg-amber-500/5"}`}>
      <div className="flex items-start gap-3">
        <HugeiconsIcon
          icon={state?.ok ? CheckmarkCircle02Icon : AlertCircleIcon}
          className={`mt-0.5 h-4 w-4 shrink-0 ${state?.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{text.title}</p>
          <p className="mt-0.5 break-words text-sm text-muted-foreground">{text.body}</p>
          {state && !state.ok && !button && (
            <p className="mt-2 text-sm text-muted-foreground">Free ports 80/443 on the server by hand, then reload this page.</p>
          )}
        </div>
        {button && !state?.ok && (
          <Button
            size="sm"
            variant={state?.action === "replace" ? "outline" : "default"}
            disabled={!!running}
            onClick={() => (state?.action === "replace" ? setConfirm(true) : void fix())}
          >
            {running ? "Working…" : button}
          </Button>
        )}
      </div>

      {lines.length > 0 && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
          {lines.join("\n")}
          {running && <span className="animate-pulse">▍</span>}
        </pre>
      )}
      {job?.status === "failed" && <p className="mt-2 text-sm text-destructive">{job.error || "The fix failed — the previous proxy was restored. See the log above."}</p>}
      {error && state && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace {holder?.name ?? "the proxy"} with Traefik?</AlertDialogTitle>
            <AlertDialogDescription>
              {holder?.name ?? "The current proxy"} will be stopped and won&apos;t start on reboot. Sites it serves go offline until you move them to
              Scalefield projects. If Traefik fails to start, {holder?.name ?? "the proxy"} is brought back automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void fix()}>Replace with Traefik</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
