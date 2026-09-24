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
import { useMetric, type SummaryData } from "@/lib/status";
import { api, type DeployResponse, type ServiceView } from "@/lib/tables";
import { ServiceSheet } from "@/components/dashboard/services-sheet";
import { cn } from "@/lib/utils";

/**
 * Сервисы проекта: контейнеры, которые панель умеет деплоить через агента.
 * Состояние контейнера берётся из сводки агента (`summary`) по имени
 * `<project>-<service>`, которое агент задаёт при деплое.
 */
export default function ServicesPage() {
  const { slug, apiBase } = useProject();
  const [services, setServices] = React.useState<ServiceView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<{ open: boolean; service: ServiceView | null }>({ open: false, service: null });
  const [deploying, setDeploying] = React.useState<string | null>(null);
  const [imageDraft, setImageDraft] = React.useState<Record<string, string>>({});
  const [lastDeploy, setLastDeploy] = React.useState<{ id: string; ok: boolean; output: string } | null>(null);
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

  const containerState = (s: ServiceView) => {
    const name = s.container ?? `${slug}-${s.name}`;
    return summary.data?.server?.containers.find((c) => c.name === name) ?? null;
  };

  const deploy = async (s: ServiceView) => {
    const image = (imageDraft[s.id] ?? s.image ?? "").trim();
    if (!image) return;
    setDeploying(s.id);
    setLastDeploy(null);
    try {
      const res = await api<DeployResponse>(`${apiBase}/services/${s.id}/deploy`, { method: "POST", body: JSON.stringify({ image }) });
      setLastDeploy({ id: s.id, ok: res.ok, output: res.output });
      await load();
      summary.refresh();
    } catch (e) {
      setLastDeploy({ id: s.id, ok: false, output: e instanceof Error ? e.message : String(e) });
    } finally {
      setDeploying(null);
    }
  };

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
          {services.map((s) => {
            const c = containerState(s);
            const tone = !c ? "bg-muted text-muted-foreground" : c.status === "running" && c.health !== "unhealthy" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-destructive/15 text-destructive";
            return (
              <Card key={s.id}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{s.name}</span>
                    <Badge variant="outline">{s.kind}</Badge>
                    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", tone)}>{c ? `${c.status}${c.health ? ` · ${c.health}` : ""}` : "not deployed"}</span>
                    {s.domains.map((d) => (
                      <a key={d} href={`https://${d}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                        {d}
                      </a>
                    ))}
                    <div className="flex-1" />
                    <Button size="sm" variant="ghost" onClick={() => setSheet({ open: true, service: s })}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoving(s)}>
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
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="h-8 w-80 font-mono text-xs"
                      placeholder="image:tag to deploy"
                      value={imageDraft[s.id] ?? s.image ?? ""}
                      onChange={(e) => setImageDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                    />
                    <Button size="sm" onClick={() => void deploy(s)} disabled={deploying !== null || !(imageDraft[s.id] ?? s.image ?? "").trim()}>
                      <HugeiconsIcon icon={RocketIcon} className={deploying === s.id ? "animate-pulse" : undefined} />
                      {deploying === s.id ? "Deploying…" : c ? "Redeploy" : "Deploy"}
                    </Button>
                  </div>
                  {lastDeploy?.id === s.id && (
                    <pre className={cn("max-h-64 overflow-auto rounded-md border p-3 font-mono text-[11px] whitespace-pre-wrap", lastDeploy.ok ? "border-border bg-muted/40" : "border-destructive/40 bg-destructive/5 text-destructive")}>
                      {lastDeploy.output || (lastDeploy.ok ? "OK" : "failed")}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ServiceSheet
        open={sheet.open}
        onOpenChange={(v) => setSheet((s) => ({ ...s, open: v }))}
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
