"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, RefreshIcon, RocketIcon } from "@hugeicons/core-free-icons";
import { useProject } from "@/lib/project-context";
import { fmtAgo, useMetric, type Deployment, type SummaryData } from "@/lib/status";
import { api, type ImagesResult, type ServiceView } from "@/lib/tables";
import { ServiceSheet } from "@/components/dashboard/services-sheet";
import { cn } from "@/lib/utils";

/**
 * Сервисы проекта: контейнеры, которые панель деплоит через агента.
 * Деплой и сборка — фоновые задачи агента: страница получает строку деплоя
 * (in_progress) и поллит её раз в 2 с, показывая лог по мере выполнения.
 * Состояние контейнера — из сводки агента (`summary`) по имени
 * `<project>-<service>`.
 */
export default function ServicesPage() {
  const { slug, apiBase } = useProject();
  const [services, setServices] = React.useState<ServiceView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<{ open: boolean; service: ServiceView | null }>({ open: false, service: null });
  const [removing, setRemoving] = React.useState<ServiceView | null>(null);
  const summary = useMetric<SummaryData>("summary", 10_000);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ services: ServiceView[] }>(`${apiBase}/services`);
      setServices(res.services);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const remove = async () => {
    const s = removing;
    if (!s) return;
    setRemoving(null);
    try {
      await api(`${apiBase}/services/${s.id}`, { method: "DELETE" });
      await load();
      summary.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 text-xl font-semibold sm:text-2xl">Services</h1>
          <p className="text-sm text-muted-foreground">Containers Scalefield deploys on the project server.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <HugeiconsIcon icon={RefreshIcon} className={loading ? "animate-spin" : undefined} />
          </Button>
          <Button size="sm" onClick={() => setSheet({ open: true, service: null })}>
            <HugeiconsIcon icon={Add01Icon} />
            New service
          </Button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {services.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No services yet. Add one and deploy an image.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              slug={slug}
              apiBase={apiBase}
              service={s}
              containers={summary.data?.server?.containers ?? []}
              onChanged={() => {
                void load();
                summary.refresh();
              }}
              onEdit={() => setSheet({ open: true, service: s })}
              onRemove={() => setRemoving(s)}
            />
          ))}
        </div>
      )}

      <ServiceSheet
        open={sheet.open}
        onOpenChange={(v) => setSheet((st) => ({ ...st, open: v }))}
        apiBase={apiBase}
        service={sheet.service}
        onSaved={() => void load()}
      />

      <AlertDialog open={removing !== null} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.container ? "The container is stopped and removed from the compose stack, then the service is deleted." : "The service definition is deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ServiceCard({
  slug,
  apiBase,
  service: s,
  containers,
  onChanged,
  onEdit,
  onRemove,
}: {
  slug: string;
  apiBase: string;
  service: ServiceView;
  containers: SummaryData["server"] extends infer T ? (T extends { containers: infer C } ? C : never) : never;
  onChanged: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [image, setImage] = React.useState(s.image ?? "");
  const [ref, setRef] = React.useState(s.branch ?? "main");
  const [active, setActive] = React.useState<Deployment | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [images, setImages] = React.useState<ImagesResult | null>(null);
  const logRef = React.useRef<HTMLPreElement>(null);

  React.useEffect(() => {
    setImage(s.image ?? "");
  }, [s.image]);

  const c = containers.find((x) => x.name === (s.container ?? `${slug}-${s.name}`)) ?? null;
  const tone = !c
    ? "bg-muted text-muted-foreground"
    : c.status === "running" && c.health !== "unhealthy"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : "bg-destructive/15 text-destructive";

  // Поллинг активного деплоя, пока агент не закончит.
  React.useEffect(() => {
    if (!active || active.status === "completed") return;
    const id = active.id;
    const t = setInterval(async () => {
      try {
        const res = await api<{ deployment: Deployment }>(`${apiBase}/deployments/${encodeURIComponent(id)}`);
        setActive(res.deployment);
        if (res.deployment.status === "completed") {
          setBusy(false);
          onChanged();
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [active, apiBase, onChanged]);

  React.useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.log]);

  const start = async (path: string, body: unknown) => {
    setBusy(true);
    setErr(null);
    setActive(null);
    try {
      const res = await api<{ deployment: Deployment }>(`${apiBase}/services/${s.id}/${path}`, { method: "POST", body: JSON.stringify(body) });
      setActive(res.deployment);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const loadImages = async () => {
    try {
      setImages(await api<ImagesResult>(`${apiBase}/services/${s.id}/images`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{s.name}</span>
          <Badge variant="outline">{s.kind}</Badge>
          <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", tone)}>{c ? `${c.status}${c.health ? ` · ${c.health}` : ""}` : "not deployed"}</span>
          {s.autoDeploy && <Badge variant="secondary">auto-deploy</Badge>}
          {s.domains.map((d) => (
            <a key={d} href={`https://${d}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              {d}
            </a>
          ))}
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>
            Remove
          </Button>
        </div>

        <div className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            image: <span className="font-mono text-foreground">{s.image ?? "—"}</span>
          </div>
          <div>
            port: <span className="font-mono text-foreground">{s.port ?? "—"}</span>
            {s.container && (
              <>
                {" · "}container: <span className="font-mono text-foreground">{s.container}</span>
              </>
            )}
          </div>
          <div>
            env: <span className="text-foreground">{Object.keys(s.env).length} vars</span>
            {s.volumes.length > 0 && (
              <>
                {" · "}volumes: <span className="text-foreground">{s.volumes.length}</span>
              </>
            )}
          </div>
          {s.repo && (
            <div>
              repo: <span className="font-mono text-foreground">{s.repo}</span>
              {s.branch && <span className="font-mono text-foreground">@{s.branch}</span>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {s.deployMode === "script" ? (
            // Своё compose-приложение: образа нет, деплой — код коммита + скрипт из репозитория.
            <>
              <Input className="h-8 w-32 font-mono text-xs" placeholder="branch" value={ref} onChange={(e) => setRef(e.target.value)} />
              <Button size="sm" onClick={() => void start("build", { ref: ref.trim() })} disabled={busy || !ref.trim() || !s.repo}>
                <HugeiconsIcon icon={RocketIcon} className={busy ? "animate-pulse" : undefined} />
                {busy ? "Working…" : "Deploy from Git"}
              </Button>
            </>
          ) : (
            <>
              <Input className="h-8 w-80 font-mono text-xs" placeholder="image:tag to deploy" value={image} onChange={(e) => setImage(e.target.value)} />
              <Button size="sm" onClick={() => void start("deploy", { image: image.trim() })} disabled={busy || !image.trim()}>
                <HugeiconsIcon icon={RocketIcon} className={busy ? "animate-pulse" : undefined} />
                {busy ? "Working…" : c ? "Redeploy" : "Deploy"}
              </Button>
              {s.repo && (
                <>
                  <span className="mx-1 text-xs text-muted-foreground">or</span>
                  <Input className="h-8 w-32 font-mono text-xs" placeholder="branch" value={ref} onChange={(e) => setRef(e.target.value)} />
                  <Button size="sm" variant="outline" onClick={() => void start("build", { ref: ref.trim() })} disabled={busy || !ref.trim()}>
                    Build from Git
                  </Button>
                </>
              )}
            </>
          )}
          <div className="flex-1" />
          {images ? (
            images.images.filter((i) => i.image !== s.image).length === 0 ? (
              <span className="text-xs text-muted-foreground">no previous images</span>
            ) : (
              <select
                aria-label="Rollback to"
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                defaultValue=""
                disabled={busy}
                onChange={(e) => {
                  if (e.target.value) void start("deploy", { image: e.target.value });
                  e.target.value = "";
                }}
              >
                <option value="">Rollback to…</option>
                {images.images
                  .filter((i) => i.image !== s.image)
                  .map((i) => (
                    <option key={i.image} value={i.image}>
                      {i.image} · {fmtAgo(i.at)}
                    </option>
                  ))}
              </select>
            )
          ) : (
            <Button size="sm" variant="ghost" onClick={() => void loadImages()} disabled={busy}>
              Rollback…
            </Button>
          )}
        </div>

        {err && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{err}</div>}
        {active && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className={cn("rounded px-1.5 py-0.5 font-medium", active.status !== "completed" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : active.conclusion === "success" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-destructive/15 text-destructive")}>
                {active.status !== "completed" ? "in progress" : active.conclusion}
              </span>
              <span className="font-mono text-muted-foreground">{active.title}</span>
              {active.duration_s != null && <span className="text-muted-foreground">{active.duration_s}s</span>}
            </div>
            <pre ref={logRef} className="max-h-72 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] whitespace-pre-wrap">
              {active.log || "…"}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
