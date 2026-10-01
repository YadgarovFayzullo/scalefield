"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServerStatusBadge } from "@/components/dashboard/servers-list";
import { api } from "@/lib/tables";
import { fmtAgo } from "@/lib/format";
import type { ServerDetail } from "@/lib/servers";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* буфер недоступен — команда видна и выделяется */
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * Сервер добавлен одной кнопкой и ждёт агента: команда установки, живое
 * ожидание подключения и запасной путь — адрес и root-пароль, если терминала
 * под рукой нет (тогда агента ставит панель по SSH).
 */
function WaitingForAgent({ server, onUpdate }: { server: ServerDetail; onUpdate: (s: ServerDetail) => void }) {
  const [host, setHost] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function connectSsh(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ server: ServerDetail }>(`/api/servers/${server.id}`, { method: "POST", body: JSON.stringify({ host, password }) });
      onUpdate(res.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border p-5">
        <h2 className="mb-1 font-medium">Run this on your server</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Any Ubuntu/Debian VPS. It installs Docker if needed, keeps your reverse proxy or adds Traefik, finds Postgres and starts the agent. No ports to open.
        </p>
        <div className="flex items-start gap-2">
          <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-muted/40 px-3 py-2.5 font-mono text-[12px] leading-relaxed whitespace-pre">
            {server.installCommand}
          </pre>
          <CopyButton text={server.installCommand || ""} />
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
          Waiting for the server to connect… This page updates by itself. The link is valid for 24 hours.
        </p>
      </section>

      <details className="group rounded-xl border border-border">
        <summary className="cursor-pointer select-none list-none px-5 py-3 text-sm text-muted-foreground hover:text-foreground">
          <span className="inline-block transition-transform group-open:rotate-90">›</span> No terminal? Connect with the root password
        </summary>
        <form onSubmit={connectSsh} className="grid gap-3 border-t border-border p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Server address</span>
            <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="81.31.246.252" className="font-mono" required spellCheck={false} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Root password</span>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="off" />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Connecting…" : "Connect"}
          </Button>
          <p className="text-xs text-muted-foreground sm:col-span-3">Used once to install over SSH and never stored.</p>
          {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive sm:col-span-3">{error}</p>}
        </form>
      </details>
    </div>
  );
}

/**
 * Сервер: статус агента, метаданные и лог установки живьём (поллинг раз в
 * 2 с, пока идёт установка) — тот же приём, что у страницы деплоя с логом
 * задачи агента. Клиентская часть страницы /servers/<id>; шапку с сессией
 * рисует серверная страница.
 */
export function ServerDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [server, setServer] = React.useState<ServerDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const logRef = React.useRef<HTMLPreElement>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await api<{ server: ServerDetail }>(`/api/servers/${id}`);
      setServer(res.server);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (server?.status !== "installing" && server?.status !== "waiting") return;
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [server?.status, load]);

  // Лог растёт — держим прокрутку внизу, как в терминале.
  React.useEffect(() => {
    const el = logRef.current;
    if (el && server?.status === "installing") el.scrollTop = el.scrollHeight;
  }, [server?.installLog, server?.status]);

  async function reinstall() {
    setBusy(true);
    try {
      const res = await api<{ server: ServerDetail }>(`/api/servers/${id}`, { method: "POST", body: JSON.stringify({}) });
      setServer(res.server);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
        <Link href="/servers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
          Servers
        </Link>

        {!server && !error ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error && !server ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : server ? (
          <>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold">{server.name}</h1>
                  <ServerStatusBadge s={server} />
                </div>
                {server.host && (
                  <p className="font-mono text-sm text-muted-foreground">
                    {server.sshUser}@{server.host}
                    {server.sshPort !== 22 ? `:${server.sshPort}` : ""}
                  </p>
                )}
              </div>
              {server.transport === "relay" && server.status !== "waiting" && (
                <Button variant="outline" onClick={reinstall} disabled={busy || server.status === "installing"}>
                  Reinstall agent
                </Button>
              )}
            </div>

            {server.status === "error" && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <HugeiconsIcon icon={AlertCircleIcon} className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium">Install failed</p>
                  <p className="break-words font-mono text-xs text-muted-foreground">{server.installError || "See the log below."}</p>
                </div>
              </div>
            )}

            {server.status === "waiting" ? (
              <WaitingForAgent server={server} onUpdate={setServer} />
            ) : (
            <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-border p-4 sm:grid-cols-4">
              <Field label="Agent">{server.agentVersion ? `v${server.agentVersion}` : "—"}</Field>
              <Field label="Hostname">{server.agentHostname || "—"}</Field>
              <Field label="Last seen">{server.lastSeenAt ? fmtAgo(server.lastSeenAt) : "never"}</Field>
              <Field label="Transport">{server.transport === "relay" ? "Relay (outbound)" : "Direct (legacy)"}</Field>
            </div>
            )}

            {server.installLog !== null && server.installLog !== "" && (
              <section>
                <h2 className="mb-2 text-sm font-medium">Install log</h2>
                <pre ref={logRef} className="max-h-[32rem] overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                  {server.installLog}
                  {server.status === "installing" && <span className="animate-pulse">▍</span>}
                </pre>
              </section>
            )}
            {server.status === "installing" && !server.installLog && <p className="text-sm text-muted-foreground">Connecting…</p>}
          </>
        ) : null}
    </main>
  );
}
