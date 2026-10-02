"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EnvInput } from "./env-input";
import { RepoPicker } from "./repo-picker";
import type { RepoInsights } from "@/lib/github-app";
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
  const [container, setContainer] = React.useState("");
  const [port, setPort] = React.useState("");
  const [domains, setDomains] = React.useState("");
  const [env, setEnv] = React.useState("");
  const [volumes, setVolumes] = React.useState("");
  const [command, setCommand] = React.useState("");
  const [repo, setRepo] = React.useState("");
  const [branch, setBranch] = React.useState("");
  const [dockerfile, setDockerfile] = React.useState("");
  const [context, setContext] = React.useState("");
  const [autoDeploy, setAutoDeploy] = React.useState(false);
  const [deployMode, setDeployMode] = React.useState<"image" | "script">("image");
  const [appDir, setAppDir] = React.useState("");
  const [deployCommand, setDeployCommand] = React.useState("");
  const [workflow, setWorkflow] = React.useState("");
  const [insights, setInsights] = React.useState<RepoInsights | null>(null);
  const [advanced, setAdvanced] = React.useState(false);
  const projectSlug = apiBase.match(/\/projects\/([^/]+)/)?.[1] ?? "";

  // Выбрали репозиторий — подставляем, как Vercel при импорте: ветку по
  // умолчанию, а если в репозитории свой скрипт деплоя — режим script с ним.
  const applyInsights = React.useCallback(
    (info: RepoInsights | null, picked: boolean) => {
      setInsights(info);
      if (!info || !picked) return;
      setBranch(info.defaultBranch);
      if (info.deployScript) {
        setDeployMode("script");
        setDeployCommand((c) => c || `bash ${info.deployScript}`);
        setAppDir((d) => d || projectSlug);
      } else {
        setDeployMode("image");
      }
      if (info.workflows.length === 1) setWorkflow((w) => w || info.workflows[0]);
    },
    [projectSlug],
  );
  const [buildEnv, setBuildEnv] = React.useState("");
  const [rotate, setRotate] = React.useState<boolean | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setKind(service?.kind ?? "web");
    setImage(service?.image ?? "");
    setContainer(service?.container ?? "");
    setPort(service?.port ? String(service.port) : "");
    setDomains(service?.domains.join("\n") ?? "");
    setEnv(service ? envToText(service.env) : "");
    setVolumes(service?.volumes.join("\n") ?? "");
    setCommand(service?.command ?? "");
    setRepo(service?.repo ?? "");
    setBranch(service?.branch ?? "");
    setDockerfile(service?.dockerfile ?? "");
    setContext(service?.buildContext ?? "");
    setAutoDeploy(service?.autoDeploy ?? false);
    setDeployMode(service?.deployMode ?? "image");
    setAppDir(service?.appDir ?? "");
    setDeployCommand(service?.deployCommand ?? "");
    setWorkflow(service?.workflow ?? "");
    setInsights(null);
    // Сервис из готового образа без репозитория — его настройки как раз в Advanced.
    setAdvanced(Boolean(service && !service.repo && service.image));
    setBuildEnv(service ? envToText(service.buildEnv) : "");
    setRotate(undefined);
    setError(null);
  }, [open, service]);

  const advancedCount = [image, container, port, domains, env, volumes, command, buildEnv].filter((v) => v.trim()).length;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const input: ServiceInput = {
      name: name.trim(),
      kind,
      image: image.trim() || null,
      container: container.trim() || null,
      port: port.trim() ? Number(port) : null,
      domains: domains.split("\n").map((s) => s.trim()).filter(Boolean),
      env: parseEnvText(env),
      volumes: volumes.split("\n").map((s) => s.trim()).filter(Boolean),
      command: command.trim() || null,
      repo: repo.trim() || null,
      branch: branch.trim() || null,
      dockerfile: dockerfile.trim() || null,
      buildContext: context.trim() || null,
      autoDeploy,
      deployMode,
      appDir: appDir.trim() || null,
      deployCommand: deployCommand.trim() || null,
      workflow: workflow.trim() || null,
      buildEnv: parseEnvText(buildEnv),
      ...(rotate === undefined ? {} : { rotateWebhookSecret: rotate }),
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
      <SheetContent className="flex flex-col data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{service ? `Edit ${service.name}` : "New service"}</SheetTitle>
          <SheetDescription>Connect a Git repository — Scalefield deploys it on the project server.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
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

          <section className="space-y-3 rounded-lg border border-border p-3">
            {open && <RepoPicker key={service?.id ?? "new"} value={repo} initialRepo={service?.repo ?? ""} onChange={setRepo} onInsights={applyInsights} />}
            {insights && (
              <p className="text-[11px] text-muted-foreground">
                Found in the repo:{" "}
                {[
                  insights.deployScript && `deploy script ${insights.deployScript}`,
                  insights.composeFiles.length > 0 && insights.composeFiles.join(", "),
                  insights.hasDockerfile && "Dockerfile",
                  insights.workflows.length > 0 && `${insights.workflows.length} CI workflow(s)`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "no Dockerfile or deploy script — Railpack will detect the stack"}
              </p>
            )}
            <datalist id="repo-branches">
              {(insights?.branches ?? []).map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            {repo.trim() ? (
              <>
                {field(
                  "How to deploy",
                  <select
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                    value={deployMode}
                    onChange={(e) => setDeployMode(e.target.value as "image" | "script")}
                  >
                    <option value="image">Build an image (Dockerfile or auto-detected stack)</option>
                    <option value="script">Run the repo&apos;s deploy script (own compose stack)</option>
                  </select>,
                )}
                {deployMode === "image" ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {field("Branch", <Input className="h-8 font-mono text-xs" list="repo-branches" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />)}
                      {field("Dockerfile", <Input className="h-8 font-mono text-xs" value={dockerfile} onChange={(e) => setDockerfile(e.target.value)} placeholder="Dockerfile" />)}
                      {field("Context", <Input className="h-8 font-mono text-xs" value={context} onChange={(e) => setContext(e.target.value)} placeholder="." />)}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Built with the Dockerfile if the repository has one; otherwise Railpack detects the stack (Node/Next.js, Python, Go, PHP, static…) and the app gets $PORT.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-[120px_160px_1fr] gap-2">
                      {field("Branch", <Input className="h-8 font-mono text-xs" list="repo-branches" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />)}
                      {field("App directory", <Input className="h-8 font-mono text-xs" value={appDir} onChange={(e) => setAppDir(e.target.value)} placeholder="myapp" />, "/opt/apps/<name>")}
                      {field("Deploy command", <Input className="h-8 font-mono text-xs" value={deployCommand} onChange={(e) => setDeployCommand(e.target.value)} placeholder="bash scripts/deploy.sh" />, "Runs in the app directory")}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      For apps with their own compose stack: the agent puts the commit&apos;s code into /opt/apps/&lt;app directory&gt; (keeping .env and other server-only files) and runs the command with a live log.
                    </p>
                  </>
                )}
                {field(
                  "Wait for CI workflow",
                  insights && insights.workflows.length > 0 ? (
                    <select className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs" value={workflow} onChange={(e) => setWorkflow(e.target.value)}>
                      <option value="">(deploy on push, don&apos;t wait)</option>
                      {[...new Set([...insights.workflows, ...(workflow ? [workflow] : [])])].map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input className="h-8 font-mono text-xs" value={workflow} onChange={(e) => setWorkflow(e.target.value)} placeholder="(deploy on push)" />
                  ),
                  "Name of a GitHub Actions workflow, e.g. CI. Auto-deploy then starts when it succeeds on the branch instead of on the push itself.",
                )}
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={autoDeploy} onChange={(e) => setAutoDeploy(e.target.checked)} />
                  {workflow.trim() ? `Auto-deploy when “${workflow.trim()}” passes on the branch` : "Auto-deploy on push to the branch"}
                </label>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Connect a repository and Scalefield deploys it on the project server on every push — or after CI passes. To run a ready-made image instead, use Advanced settings.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setAdvanced((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium"
            >
              <span>
                Advanced settings
                {advancedCount > 0 && <span className="ml-2 font-normal text-muted-foreground">{advancedCount} set</span>}
              </span>
              <span className="text-muted-foreground">{advanced ? "▲" : "▼"}</span>
            </button>
            {advanced && (
              <div className="space-y-3 border-t border-border p-3">
                {field("Image", <Input className="h-8 font-mono text-xs" value={image} onChange={(e) => setImage(e.target.value)} placeholder="ghcr.io/org/app:1.2.3" />, "Deploy a ready image from a registry instead of building from Git.")}
                <div className="grid grid-cols-[1fr_120px] gap-2">
                  {field(
                    "Container name",
                    <Input className="h-8 font-mono text-xs" value={container} onChange={(e) => setContainer(e.target.value)} placeholder="auto after first deploy" />,
                    "Decides what Overview and Monitoring show. Set it by hand for containers deployed outside Scalefield.",
                  )}
                  {field("Port", <Input className="h-8 font-mono text-xs" value={port} onChange={(e) => setPort(e.target.value)} placeholder="3000" />)}
                </div>
                {field("Domains", <Textarea className="min-h-14 font-mono text-xs" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder={"app.example.com"} />, "One per line. Traefik gets a router and a Let's Encrypt certificate (image deploys).")}
                {field("Environment", <EnvInput value={env} onChange={setEnv} placeholder={"DATABASE_URL=postgres://…"} />, "KEY=VALUE per line. Stored encrypted; written into the compose file on deploy.")}
                {deployMode === "image" &&
                  field(
                    "Build environment",
                    <EnvInput className="min-h-16 font-mono text-xs" value={buildEnv} onChange={setBuildEnv} placeholder={"NEXT_PUBLIC_API_URL=https://api.example.com"} />,
                    "Written to .env.production before the build (Next.js inlines NEXT_PUBLIC_* at build time).",
                  )}
                {field("Volumes", <Textarea className="min-h-12 font-mono text-xs" value={volumes} onChange={(e) => setVolumes(e.target.value)} placeholder="/opt/data/app:/data" />, "host:container[:ro] per line.")}
                {field("Command", <Input className="h-8 font-mono text-xs" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="(image default)" />)}
                <div className="space-y-1 text-xs">
                  <div className="font-medium">GitHub webhook</div>
                  {service ? (
                    <>
                      <div className="font-mono text-[11px] break-all text-muted-foreground">
                        {typeof window !== "undefined" ? window.location.origin : ""}/api/hooks/github/{service.id}
                      </div>
                      {service.webhookSecret && rotate !== false ? (
                        <div className="font-mono text-[11px] break-all">secret: {rotate ? "(new secret after save)" : service.webhookSecret}</div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground">{rotate ? "A secret will be generated on save." : "No secret yet — the hook is disabled."}</div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setRotate(true)}>
                          {service.webhookSecret ? "Rotate secret" : "Generate secret"}
                        </Button>
                        {service.webhookSecret && (
                          <Button size="sm" variant="ghost" onClick={() => setRotate(false)}>
                            Disable
                          </Button>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Content type: application/json, event: push. Builds run on the project server.</div>
                    </>
                  ) : (
                    <div className="text-[11px] text-muted-foreground">Save the service first to get a webhook URL.</div>
                  )}
                </div>
              </div>
            )}
          </section>
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
