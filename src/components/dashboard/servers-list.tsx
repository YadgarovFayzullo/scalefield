"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, ServerStack01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { AddServerSheet } from "@/components/dashboard/add-server-sheet";
import { fmtAgo } from "@/lib/format";
import { api } from "@/lib/tables";
import type { ServerView } from "@/lib/servers";
import { cn } from "@/lib/utils";

export function ServerStatusBadge({ s }: { s: Pick<ServerView, "status" | "online"> }) {
  const [label, cls] =
    s.status === "waiting"
      ? ["Waiting", "bg-sky-500/15 text-sky-600 dark:text-sky-400"]
      : s.status === "installing"
      ? ["Installing", "bg-amber-500/15 text-amber-600 dark:text-amber-400"]
      : s.status === "error"
        ? ["Error", "bg-destructive/15 text-destructive"]
        : s.online
          ? ["Online", "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"]
          : ["Offline", "bg-muted text-muted-foreground"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", (s.status === "installing" || s.status === "waiting") && "animate-pulse")} />
      {label}
    </span>
  );
}

/** Список серверов + «Add server». Пока есть установка — обновляем раз в 3 с. */
export function ServersList({ initial, sshPublicKey }: { initial: ServerView[]; sshPublicKey: string }) {
  const router = useRouter();
  const [servers, setServers] = React.useState(initial);
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // «Add server» — одна кнопка: сервер создаётся сразу, на его странице
  // команда установки; адрес и имя придут от агента сами.
  async function addServer() {
    setCreating(true);
    setError(null);
    try {
      const res = await api<{ server: ServerView }>("/api/servers", { method: "POST", body: JSON.stringify({ mode: "command" }) });
      router.push(`/servers/${res.server.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  }

  const installing = servers.some((s) => s.status === "installing" || s.status === "waiting");
  React.useEffect(() => {
    if (!installing) return;
    const t = setInterval(async () => {
      try {
        const res = await api<{ servers: ServerView[] }>("/api/servers");
        setServers(res.servers);
      } catch {
        /* следующий тик */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [installing]);

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Servers</h1>
          <p className="text-sm text-muted-foreground">Your machines with the Scalefield agent. Projects deploy onto them.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setOpen(true)} className="text-muted-foreground">
            Connect with SSH
          </Button>
          <Button onClick={addServer} disabled={creating}>
            <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4" />
            {creating ? "Adding…" : "Add server"}
          </Button>
        </div>
      </div>
      {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</p>}

      {servers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <HugeiconsIcon icon={ServerStack01Icon} className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No servers yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Press Add server and run one command on your VPS — everything else is detected.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Server</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id} className="cursor-pointer border-t border-border transition-colors hover:bg-muted/30" onClick={() => router.push(`/servers/${s.id}`)}>
                  <td className="px-4 py-3">
                    <Link href={`/servers/${s.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      {s.name}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">
                      {s.host ? (
                        <>
                          {s.sshUser}@{s.host}
                          {s.sshPort !== 22 ? `:${s.sshPort}` : ""}
                        </>
                      ) : (
                        "waiting for the install command"
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ServerStatusBadge s={s} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.agentVersion ? `v${s.agentVersion}` : "—"}
                    {s.transport === "direct" && <span className="ml-1.5 text-xs">(direct)</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.lastSeenAt ? fmtAgo(s.lastSeenAt) : "never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddServerSheet
        open={open}
        onOpenChange={setOpen}
        sshPublicKey={sshPublicKey}
        onCreated={(s) => {
          setServers((prev) => [...prev, s]);
          router.push(`/servers/${s.id}`);
        }}
      />
    </>
  );
}
