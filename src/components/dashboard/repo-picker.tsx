"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/tables";
import { fmtAgo } from "@/lib/format";
import type { RepoInsights, RepoView } from "@/lib/github-app";

type ReposResult = { app: boolean; installed: boolean; repos: RepoView[]; errors: string[] };

/**
 * Подключение репозитория к сервису, как у Vercel: список репозиториев,
 * открытых GitHub App команды, с поиском. После выбора Scalefield смотрит в
 * репозиторий (ветки, CI-workflow, Dockerfile, скрипт деплоя) и отдаёт это
 * наверх через `onInsights`, чтобы форма подставила настройки. Ручной ввод
 * owner/name или git-URL остаётся — для GitLab и self-hosted.
 */
export function RepoPicker({
  value,
  initialRepo,
  onChange,
  onInsights,
}: {
  value: string;
  /** Репозиторий, уже сохранённый у сервиса: для него только подсказки, без автоподстановки. */
  initialRepo: string;
  onChange: (repo: string) => void;
  onInsights: (info: RepoInsights | null, picked: boolean) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [manual, setManual] = React.useState(false);
  const [data, setData] = React.useState<ReposResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [checking, setChecking] = React.useState(false);

  const inspect = React.useCallback(
    async (repo: string, picked: boolean) => {
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
        onInsights(null, picked);
        return;
      }
      setChecking(true);
      try {
        const res = await api<{ repo: RepoInsights }>(`/api/github/repo-info?repo=${encodeURIComponent(repo)}`);
        onInsights(res.repo, picked);
        setError(null);
      } catch (e) {
        onInsights(null, picked);
        if (picked) setError(e instanceof Error ? e.message : String(e));
      } finally {
        setChecking(false);
      }
    },
    [onInsights],
  );

  // Уже подключённый репозиторий: подтягиваем ветки и workflow для подсказок, но ничего не меняем.
  React.useEffect(() => {
    if (initialRepo) void inspect(initialRepo, false);
  }, [initialRepo, inspect]);

  const openList = () => {
    setOpen(true);
    if (!data) {
      api<ReposResult>("/api/github/repositories")
        .then(setData)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }
  };

  const pick = (repo: string) => {
    onChange(repo);
    setOpen(false);
    setQ("");
    void inspect(repo, true);
  };

  const repos = (data?.repos ?? []).filter((r) => r.fullName.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <label className="font-medium">Git repository</label>
        <button type="button" className="text-[11px] text-muted-foreground underline-offset-4 hover:underline" onClick={() => setManual((m) => !m)}>
          {manual ? "Pick from GitHub" : "Enter manually"}
        </button>
      </div>

      {manual ? (
        <Input
          className="h-8 font-mono text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => void inspect(value.trim(), true)}
          placeholder="owner/name or https://git…"
        />
      ) : value ? (
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
          <GithubMark />
          <a
            href={/^[^/]+\/[^/]+$/.test(value) ? `https://github.com/${value}` : value}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate font-mono hover:underline"
          >
            {value}
          </a>
          {checking && <span className="text-muted-foreground">checking…</span>}
          <Button size="sm" variant="ghost" onClick={openList}>
            Change
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onChange("");
              onInsights(null, true);
            }}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={openList}>
          <GithubMark />
          Connect GitHub repository
        </Button>
      )}

      {open && !manual && (
        <div className="rounded-md border border-border">
          <div className="flex items-center gap-2 border-b border-border p-2">
            <Input autoFocus className="h-8 text-xs" placeholder="Search repositories…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!data ? (
              <div className="p-3 text-muted-foreground">{error ?? "Loading repositories…"}</div>
            ) : !data.app ? (
              <div className="p-3 text-muted-foreground">
                GitHub isn&apos;t set up yet —{" "}
                <Link href="/settings/github" className="underline underline-offset-4">
                  Settings → GitHub
                </Link>
                .
              </div>
            ) : !data.installed ? (
              <div className="p-3 text-muted-foreground">
                Install the GitHub App on your account or organization in{" "}
                <Link href="/settings/github" className="underline underline-offset-4">
                  Settings → GitHub
                </Link>{" "}
                to see repositories here.
              </div>
            ) : repos.length === 0 ? (
              <div className="p-3 text-muted-foreground">
                No repositories match. Missing one? Give the GitHub App access to it in{" "}
                <Link href="/settings/github" className="underline underline-offset-4">
                  Settings → GitHub
                </Link>
                .
              </div>
            ) : (
              repos.map((r) => (
                <button
                  key={r.fullName}
                  type="button"
                  onClick={() => pick(r.fullName)}
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted"
                >
                  <GithubMark />
                  <span className="min-w-0 flex-1 truncate font-mono">{r.fullName}</span>
                  {r.private && <span className="rounded border border-border px-1 text-[10px] text-muted-foreground">private</span>}
                  {r.updatedAt && <span className="shrink-0 text-muted-foreground">{fmtAgo(r.updatedAt)}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {error && data && <div className="text-[11px] text-destructive">{error}</div>}
    </div>
  );
}

function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
