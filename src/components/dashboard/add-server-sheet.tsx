"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
 * «Добавить сервер» как в Vercel: адрес и root-пароль — и всё. Порт и
 * пользователь берутся из адреса (`root@host:2222`), имя — из адреса, email
 * для Let's Encrypt — из аккаунта. Traefik ставится, только если 80/443 на
 * сервере свободны, Postgres установка находит сама (src/lib/agent-install.ts).
 * Остальное — в «Advanced», для редких случаев. Пароль используется один раз и
 * не хранится; вместо него можно положить на сервер ключ организации.
 */
type ProxyMode = "auto" | "install" | "skip";

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
  const [target, setTarget] = React.useState("");
  const [auth, setAuth] = React.useState<"password" | "key">("password");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [proxy, setProxy] = React.useState<ProxyMode>("auto");
  const [databaseUrl, setDatabaseUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTarget("");
    setAuth("password");
    setPassword("");
    setName("");
    setProxy("auto");
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
          host: target,
          name: name || undefined,
          password: auth === "password" ? password : "",
          installTraefik: proxy === "auto" ? undefined : proxy === "install",
          databaseUrl: databaseUrl || undefined,
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
      <SheetContent className="flex flex-col data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Add server</SheetTitle>
            <SheetDescription>Any Ubuntu/Debian VPS with root access. Paste its address — everything else is detected on the server.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-2">
            <Field label="Server address" hint="IP or hostname. A custom SSH port or user works too: root@host:2222.">
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="81.31.246.252"
                className="font-mono"
                required
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            {auth === "password" ? (
              <div>
                <Field label="Root password" hint="Used once to install and never stored.">
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="off" />
                </Field>
                <button type="button" onClick={() => setAuth("key")} className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  Use an SSH key instead
                </button>
              </div>
            ) : (
              <div>
                <Field label="Add this key to /root/.ssh/authorized_keys on the server">
                  <div className="flex items-start gap-2">
                    <textarea readOnly value={sshPublicKey} rows={3} className="w-full resize-none rounded-md border border-input bg-muted/40 p-2 font-mono text-[11px] leading-snug" />
                    <Button type="button" variant="outline" size="sm" onClick={copyKey}>
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </Field>
                <button type="button" onClick={() => setAuth("password")} className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  Use the root password instead
                </button>
              </div>
            )}

            <ul className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <li>Installs Docker if it is missing.</li>
              <li>Keeps the reverse proxy already on ports 80/443, otherwise installs Traefik with HTTPS.</li>
              <li>Finds Postgres for the Database section.</li>
              <li>The agent connects out to Scalefield — no ports to open.</li>
            </ul>

            <details className="group rounded-lg border border-border">
              <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                <span className="inline-block transition-transform group-open:rotate-90">›</span> Advanced
              </summary>
              <div className="space-y-4 border-t border-border p-3">
                <Field label="Name" hint="Defaults to the address.">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="researcher-uz" />
                </Field>
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Reverse proxy</span>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1 text-sm">
                    {(
                      [
                        ["auto", "Auto"],
                        ["install", "Install Traefik"],
                        ["skip", "Don't install"],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setProxy(v)}
                        className={cn("rounded-md px-2 py-1.5 transition-colors", proxy === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Postgres URL" hint="Only if auto-detection picks the wrong database.">
                  <Input value={databaseUrl} onChange={(e) => setDatabaseUrl(e.target.value)} placeholder="postgresql://user:pass@db:5432/app" className="font-mono text-xs" />
                </Field>
              </div>
            </details>

            {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</p>}
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Connecting…" : "Connect server"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
