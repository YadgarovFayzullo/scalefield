"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, envToText, parseEnvText, type ServiceInput, type ServiceView } from "@/lib/tables";

const KINDS = ["web", "api", "worker", "database", "proxy"];

/** Создание и правка сервиса: образ, порт, домены, env (KEY=VALUE), тома, команда. */
export function ServiceSheet({
  open,
  onOpenChange,
  apiBase,
  service,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  apiBase: string;
  service: ServiceView | null;
  onSaved: (s: ServiceView) => void;
}) {
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState("web");
  const [image, setImage] = React.useState("");
  const [port, setPort] = React.useState("");
  const [domains, setDomains] = React.useState("");
  const [env, setEnv] = React.useState("");
  const [volumes, setVolumes] = React.useState("");
  const [command, setCommand] = React.useState("");
  const [repo, setRepo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setKind(service?.kind ?? "web");
    setImage(service?.image ?? "");
    setPort(service?.port ? String(service.port) : "");
    setDomains(service?.domains.join("\n") ?? "");
    setEnv(service ? envToText(service.env) : "");
    setVolumes(service?.volumes.join("\n") ?? "");
    setCommand(service?.command ?? "");
    setRepo(service?.repo ?? "");
    setError(null);
  }, [open, service]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const input: ServiceInput = {
      name: name.trim(),
      kind,
      image: image.trim() || null,
      port: port.trim() ? Number(port) : null,
      domains: domains.split("\n").map((s) => s.trim()).filter(Boolean),
      env: parseEnvText(env),
      volumes: volumes.split("\n").map((s) => s.trim()).filter(Boolean),
      command: command.trim() || null,
      repo: repo.trim() || null,
    };
    try {
      const res = service
        ? await api<{ service: ServiceView }>(`${apiBase}/services/${service.id}`, { method: "PATCH", body: JSON.stringify(input) })
        : await api<{ service: ServiceView }>(`${apiBase}/services`, { method: "POST", body: JSON.stringify(input) });
      onOpenChange(false);
      onSaved(res.service);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div className="space-y-1 text-xs">
      <label className="font-medium">{label}</label>
      {node}
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{service ? `Edit ${service.name}` : "New service"}</SheetTitle>
          <SheetDescription>A service is one container. Deploy pulls the image and starts it on the project server.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4">
          <div className="grid grid-cols-[1fr_120px] gap-2">
            {field("Name", <Input className="h-8 font-mono text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="web" disabled={Boolean(service?.container)} />, service?.container ? "Rename after removing the container." : "lowercase, digits, - and _")}
            {field(
              "Kind",
              <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs" value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>,
            )}
          </div>
          {field("Image", <Input className="h-8 font-mono text-xs" value={image} onChange={(e) => setImage(e.target.value)} placeholder="ghcr.io/org/app:1.2.3" />, "Any registry the server can pull from.")}
          <div className="grid grid-cols-2 gap-2">
            {field("Container port", <Input className="h-8 font-mono text-xs" value={port} onChange={(e) => setPort(e.target.value)} placeholder="3000" />, "With domains: Traefik target. Without: published on 127.0.0.1.")}
            {field("Repository", <Input className="h-8 font-mono text-xs" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/name" />, "GitHub, for the deployments history.")}
          </div>
          {field("Domains", <Textarea className="min-h-16 font-mono text-xs" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder={"app.example.com\napi.example.com"} />, "One per line. Traefik gets a router and a Let's Encrypt certificate.")}
          {field("Environment", <Textarea className="min-h-28 font-mono text-xs" value={env} onChange={(e) => setEnv(e.target.value)} placeholder={"DATABASE_URL=postgres://…\nNODE_ENV=production"} />, "KEY=VALUE per line. Stored encrypted; written into the compose file on deploy.")}
          {field("Volumes", <Textarea className="min-h-12 font-mono text-xs" value={volumes} onChange={(e) => setVolumes(e.target.value)} placeholder="/opt/data/app:/data" />, "host:container[:ro] per line.")}
          {field("Command", <Input className="h-8 font-mono text-xs" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="(image default)" />)}
        </div>
        {error && <div className="mx-4 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{error}</div>}
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
