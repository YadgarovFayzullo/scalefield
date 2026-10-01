"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProject } from "@/lib/project-context";
import { api } from "@/lib/tables";

/**
 * Настройки проекта. Пока одно — Danger zone с удалением, как в Vercel:
 * подтверждение вводом имени проекта. По умолчанию проект убирается только
 * из панели, а его контейнеры на сервере продолжают работать; галочка —
 * остановить и удалить их тоже.
 */
export default function ProjectSettingsPage() {
  const project = useProject();
  const router = useRouter();
  const [confirm, setConfirm] = React.useState("");
  const [removeContainers, setRemoveContainers] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`${project.apiBase}`, { method: "DELETE", body: JSON.stringify({ removeContainers }) });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Settings</h1>
      <p className="mb-8 text-sm text-muted-foreground">{project.name}</p>

      <section className="rounded-xl border border-destructive/40">
        <div className="p-5">
          <h2 className="font-medium">Delete project</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Removes the project, its services, deployments, domains and analytics from Scalefield. This cannot be undone.
          </p>
          <form onSubmit={remove} className="mt-4 space-y-4">
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5" checked={removeContainers} onChange={(e) => setRemoveContainers(e.target.checked)} />
              <span>
                Also stop and remove its containers{project.serverName ? ` on ${project.serverName}` : ""}
                <span className="block text-xs text-muted-foreground">Off: containers keep running on the server, only Scalefield forgets them.</span>
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">
                Type <span className="font-mono font-medium text-foreground">{project.name}</span> to confirm
              </span>
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="max-w-sm" autoComplete="off" spellCheck={false} />
            </label>
            {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="destructive" disabled={busy || confirm !== project.name}>
              {busy ? "Deleting…" : "Delete project"}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
