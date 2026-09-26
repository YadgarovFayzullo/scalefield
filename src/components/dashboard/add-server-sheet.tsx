"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/tables";
import type { ServerView } from "@/lib/servers";
import { cn } from "@/lib/utils";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/**
 * «Добавить сервер»: IP + root-пароль (один раз, не хранится) или наш
 * публичный ключ, уже положенный на сервер. Панель заходит по SSH, ставит
 * Docker, Traefik и агента, дальше сервер живёт через relay. Как у Forge:
 * никакого `curl | sh` руками, но и он остаётся возможен.
 */
export function AddServerSheet({
  open,
  onOpenChange,
  sshPublicKey,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sshPublicKey: string;
  onCreated: (s: ServerView) => void;
}) {
  const [name, setName] = React.useState("");
  const [host, setHost] = React.useState("");
  const [port, setPort] = React.useState("22");
  const [user, setUser] = React.useState("root");
  const [auth, setAuth] = React.useState<"password" | "key">("password");
  const [password, setPassword] = React.useState("");
  const [traefik, setTraefik] = React.useState(true);
  const [email, setEmail] = React.useState("");
  const [databaseUrl, setDatabaseUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setHost("");
    setPort("22");
    setUser("root");
    setAuth("password");
    setPassword("");
    setTraefik(true);
    setDatabaseUrl("");
    setError(null);
    setBusy(false);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ server: ServerView }>("/api/servers", {
        method: "POST",
        body: JSON.stringify({
          name,
          host,
          sshPort: Number(port) || 22,
          sshUser: user,
          password: auth === "password" ? password : "",
          installTraefik: traefik,
          acmeEmail: email,
          databaseUrl,
        }),
      });
      onOpenChange(false);
      onCreated(res.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(sshPublicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* буфер недоступен — ключ виден в поле */
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Add server</SheetTitle>
            <SheetDescription>
              A fresh Ubuntu/Debian VPS with root access. We install Docker, Traefik and the Scalefield agent over SSH; the agent then
              connects outbound — no ports to open.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <Field label="Host (IP or hostname)">
                <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="81.31.246.252" required autoFocus />
              </Field>
              <Field label="SSH port">
                <Input value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name" hint="Defaults to the host.">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="researcher-uz" />
              </Field>
              <Field label="SSH user" hint="Must be root for now.">
                <Input value={user} onChange={(e) => setUser(e.target.value)} />
              </Field>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Authentication</span>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1 text-sm">
                {(["password", "key"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAuth(v)}
                    className={cn("rounded-md px-3 py-1.5 transition-colors", auth === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
                  >
                    {v === "password" ? "Root password" : "Our SSH key"}
                  </button>
                ))}
              </div>
              {auth === "password" ? (
                <div className="mt-3">
                  <Field label="Root password" hint="Used once for the install and never stored. Our key is added to the server for reinstalls.">
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="off" />
                  </Field>
                </div>
              ) : (
                <div className="mt-3">
                  <Field label="Add this key to /root/.ssh/authorized_keys on the server">
                    <div className="flex items-start gap-2">
                      <textarea readOnly value={sshPublicKey} rows={3} className="w-full resize-none rounded-md border border-input bg-muted/40 p-2 font-mono text-[11px] leading-snug" />
                      <Button type="button" variant="outline" size="sm" onClick={copyKey}>
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </Field>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Install Traefik</p>
                  <p className="text-xs text-muted-foreground">Reverse proxy with Let&apos;s Encrypt for your project domains. Skip if the server already has one.</p>
                </div>
                <Switch checked={traefik} onCheckedChange={setTraefik} />
              </div>
              {traefik && (
                <div className="mt-3">
                  <Field label="Let's Encrypt email">
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                  </Field>
                </div>
              )}
            </div>

            <Field label="Postgres on this server (optional)" hint="Lets the agent read pg_stat_* for the Database section.">
              <Input value={databaseUrl} onChange={(e) => setDatabaseUrl(e.target.value)} placeholder="postgresql://user:pass@db:5432/app" className="font-mono text-xs" />
            </Field>

            {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</p>}
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Connecting…" : "Install agent"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
