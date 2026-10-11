"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/tables";
import { fmtAgo } from "@/lib/format";
import type { RepoInsights, RepoView } from "@/lib/github-app";
import { parseEnvText } from "@/lib/tables";
import { EnvInput } from "./env-input";

type ReposResult = { app: boolean; installed: boolean; orgId?: string; repos: RepoView[]; errors: string[] };
type ServerOption = { id: string; name: string; online: boolean };

/**
 * Импорт репозитория: список репозиториев установок GitHub App команды с
 * поиском → форма (имя, сервер, ветка, домен, env; Dockerfile/порт/CI под Advanced,
 * подставляются из репозитория через repo-info) → проект с
 * первой сборкой. Нет установки — кнопка «Install GitHub App» с возвратом сюда.
 */
export function ImportRepository({ servers }: { servers: ServerOption[] }) {
  const router = useRouter();
  const [data, setData] = React.useState<ReposResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<RepoView | null>(null);

  React.useEffect(() => {
    api<ReposResult>("/api/github/repositories")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const repos = (data?.repos ?? []).filter((r) => r.fullName.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{picked ? "Configure project" : "Import Git Repository"}</h1>
        <p className="text-sm text-muted-foreground">
          {picked ? `From ${picked.fullName}` : "Pick a repository — Scalefield builds it on your server and redeploys on every push."}
        </p>
      </div>

      {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      {picked ? (
        <ConfigureProject repo={picked} servers={servers} onBack={() => setPicked(null)} onDone={(slug) => router.push(`/p/${slug}/deployments`)} />
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Loading repositories…</p>
      ) : !data.app ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          GitHub isn&apos;t set up on this Scalefield yet — the platform owner creates the GitHub App in{" "}
          <Link href="/settings/github" className="underline underline-offset-4">
            Settings → GitHub
          </Link>
          .
        </div>
      ) : !data.installed ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="font-medium">Connect GitHub</p>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Install the Scalefield GitHub App on your account or organization to see your repositories here.</p>
          <a
            href={`/api/auth/github/start?mode=install&org=${data.orgId}&next=/new`}
            className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
          >
            Install GitHub App
          </a>
        </div>
      ) : (
        <div className="rounded-xl border border-border">
          <div className="flex items-center gap-3 border-b border-border p-3">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search repositories…" autoFocus />
            <a
              href={`/api/auth/github/start?mode=install&org=${data.orgId}&next=/new`}
              className="shrink-0 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Adjust GitHub access
            </a>
          </div>
          {data.errors.length > 0 && <p className="border-b border-border px-4 py-2 text-xs text-destructive">{data.errors.join(" · ")}</p>}
          {repos.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{data.repos.length ? "No repositories match." : "The app has no repositories yet — adjust GitHub access."}</p>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-border overflow-auto">
              {repos.map((r) => (
                <li key={r.fullName} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {r.fullName}
                      {r.private && <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">Private</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[r.language, r.updatedAt ? `pushed ${fmtAgo(r.updatedAt)}` : null, r.description].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setPicked(r)}>
                    Import
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

type Insights = { state: "loading" } | { state: "ready"; info: RepoInsights } | { state: "error"; message: string };

/**
 * Настройка проекта после выбора репозитория. Как Vercel при импорте: сразу
 * идём за `repo-info` и подставляем то, что видно в репозитории — ветку по
 * умолчанию, порт из `EXPOSE` Dockerfile, режим деплоя (свой скрипт →
 * script), единственный CI-workflow. Dockerfile и порт — под «Advanced»:
 * сборке они нужны редко (без Dockerfile стек определяет Railpack).
 */
function ConfigureProject({
  repo,
  servers,
  onBack,
  onDone,
}: {
  repo: RepoView;
  servers: ServerOption[];
  onBack: () => void;
  onDone: (slug: string) => void;
}) {
  const [name, setName] = React.useState(repo.name);
  const [serverId, setServerId] = React.useState(servers.find((s) => s.online)?.id ?? servers[0]?.id ?? "");
  const [branch, setBranch] = React.useState(repo.defaultBranch);
  const [dockerfile, setDockerfile] = React.useState("Dockerfile");
  const [port, setPort] = React.useState("3000");
  const [domain, setDomain] = React.useState("");
  const [env, setEnv] = React.useState("");
  const [deployMode, setDeployMode] = React.useState<"image" | "script">("image");
  const [appDir, setAppDir] = React.useState("");
  const [deployCommand, setDeployCommand] = React.useState("");
  const [workflow, setWorkflow] = React.useState("");
  const [insights, setInsights] = React.useState<Insights>({ state: "loading" });
  const [advanced, setAdvanced] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    api<{ repo: RepoInsights }>(`/api/github/repo-info?repo=${encodeURIComponent(repo.fullName)}`)
      .then(({ repo: info }) => {
        if (cancelled) return;
        setInsights({ state: "ready", info });
        setBranch(info.defaultBranch);
        if (info.exposedPort) setPort(String(info.exposedPort));
        if (info.deployScript) {
          setDeployMode("script");
          setDeployCommand(`bash ${info.deployScript}`);
          setAppDir(slugify(repo.name));
        }
        if (info.workflows.length === 1) setWorkflow(info.workflows[0]);
      })
      .catch((e) => {
        // Нет доступа к содержимому — форма работает на умолчаниях, как раньше.
        if (!cancelled) setInsights({ state: "error", message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [repo.fullName, repo.name]);

  const info = insights.state === "ready" ? insights.info : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ project: { slug: string }; deployError: string | null }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          repo: repo.fullName,
          branch,
          serverId: serverId || null,
          dockerfile: dockerfile.trim() || "Dockerfile",
          port: Number(port) || null,
          domain,
          env: parseEnvText(env),
          deployMode,
          appDir: deployMode === "script" ? appDir.trim() || null : null,
          deployCommand: deployMode === "script" ? deployCommand.trim() || null : null,
          workflow: workflow.trim() || null,
        }),
      });
      if (res.deployError) alert(`Project created, but the first build did not start: ${res.deployError}`);
      onDone(res.project.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const field = (label: string, hint: string | null, child: React.ReactNode) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {child}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );

  // Что нашли в репозитории — одной строкой, как «Framework Preset» у Vercel.
  const detected = info
    ? [
        info.framework,
        info.hasDockerfile ? (info.exposedPort ? `Dockerfile (EXPOSE ${info.exposedPort})` : "Dockerfile") : null,
        info.deployScript ? `deploy script ${info.deployScript}` : null,
        info.composeFiles.length > 0 ? info.composeFiles.join(", ") : null,
        info.workflows.length > 0 ? `${info.workflows.length} CI workflow${info.workflows.length > 1 ? "s" : ""}` : null,
      ].filter(Boolean)
    : [];
  const buildHint = info
    ? info.hasDockerfile
      ? `Built with ${dockerfile.trim() || "Dockerfile"} from the repository.`
      : "No Dockerfile — Railpack detects the stack and the app gets $PORT."
    : "Built with the Dockerfile if the repository has one; otherwise Railpack detects the stack.";
  const advancedCount = [dockerfile.trim() !== "Dockerfile", port !== (info?.exposedPort ? String(info.exposedPort) : "3000"), workflow.trim() !== ""].filter(Boolean).length;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border p-5">
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
        {insights.state === "loading" && <span className="text-muted-foreground">Looking at the repository…</span>}
        {insights.state === "error" && <span className="text-muted-foreground">Couldn&apos;t read the repository ({insights.message}) — using defaults.</span>}
        {info && (
          <>
            <span className="font-medium">Detected:</span>{" "}
            {detected.length > 0 ? detected.join(" · ") : "no Dockerfile or deploy script — Railpack will detect the stack on build"}
          </>
        )}
      </div>

      {field("Project name", null, <Input value={name} onChange={(e) => setName(e.target.value)} required />)}
      {servers.length === 0 ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          You have no servers yet — the project will be created without one.{" "}
          <Link href="/servers" className="underline underline-offset-4">
            Add a server
          </Link>{" "}
          to deploy it.
        </p>
      ) : (
        field(
          "Server",
          "The repository is cloned and built there; images are not pushed anywhere.",
          <select value={serverId} onChange={(e) => setServerId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.online ? "" : " (offline)"}
              </option>
            ))}
          </select>,
        )
      )}

      <datalist id="import-branches">
        {(info?.branches ?? []).map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      {field("Branch", "Pushes here redeploy.", <Input value={branch} onChange={(e) => setBranch(e.target.value)} list="import-branches" required />)}

      {info?.deployScript &&
        field(
          "How to deploy",
          deployMode === "script"
            ? "The agent puts the commit's code into /opt/apps/<app directory> and runs the script with a live log."
            : buildHint,
          <select value={deployMode} onChange={(e) => setDeployMode(e.target.value as "image" | "script")} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
            <option value="script">Run the repo&apos;s deploy script ({info.deployScript})</option>
            <option value="image">Build an image ({info.hasDockerfile ? "Dockerfile" : "auto-detected stack"})</option>
          </select>,
        )}
      {deployMode === "script" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {field("App directory", "/opt/apps/<name> on the server", <Input value={appDir} onChange={(e) => setAppDir(e.target.value)} placeholder={slugify(repo.name)} required />)}
          {field("Deploy command", "Runs in the app directory.", <Input value={deployCommand} onChange={(e) => setDeployCommand(e.target.value)} placeholder="bash scripts/deploy.sh" required />)}
        </div>
      )}

      {field(
        "Domain (optional)",
        "Point its DNS A record at the server; Traefik issues the certificate.",
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="app.example.com" />,
      )}
      {field(
        "Environment Variables",
        "KEY=VALUE per line, or upload your .env. Stored encrypted; available at runtime, NEXT_PUBLIC_* also at build time.",
        <EnvInput value={env} onChange={setEnv} placeholder={"DATABASE_URL=postgres://…\nNEXT_PUBLIC_API_URL=https://api.example.com"} />,
      )}

      <section className="rounded-md border border-border">
        <button type="button" onClick={() => setAdvanced((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium">
          <span>
            Advanced
            {advancedCount > 0 && <span className="ml-2 font-normal text-muted-foreground">{advancedCount} changed</span>}
          </span>
          <span className="text-muted-foreground">{advanced ? "▲" : "▼"}</span>
        </button>
        {advanced && (
          <div className="space-y-4 border-t border-border p-3">
            {deployMode === "image" && (
              <div className="grid gap-4 sm:grid-cols-2">
                {field("Dockerfile", buildHint, <Input value={dockerfile} onChange={(e) => setDockerfile(e.target.value)} placeholder="Dockerfile" />)}
                {field(
                  "Port",
                  info?.exposedPort
                    ? `From EXPOSE in the Dockerfile. Traefik routes the domain here.`
                    : info && !info.hasDockerfile
                      ? "Passed to the app as $PORT; Traefik routes the domain here."
                      : "The app listens on; Traefik routes the domain here.",
                  <Input value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />,
                )}
              </div>
            )}
            {field(
              "Wait for CI workflow",
              "Auto-deploy starts when this GitHub Actions workflow succeeds on the branch instead of on the push itself.",
              info && info.workflows.length > 0 ? (
                <select value={workflow} onChange={(e) => setWorkflow(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
                  <option value="">(deploy on push, don&apos;t wait)</option>
                  {info.workflows.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              ) : (
                <Input value={workflow} onChange={(e) => setWorkflow(e.target.value)} placeholder="(deploy on push)" />
              ),
            )}
          </div>
        )}
      </section>

      {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</p>}
      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : servers.length ? "Deploy" : "Create project"}
        </Button>
      </div>
    </form>
  );
}

/** Имя папки /opt/apps/<name> из имени репозитория — те же правила, что у NAME_RE сервиса. */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "")
      .slice(0, 60) || "app"
  );
}
