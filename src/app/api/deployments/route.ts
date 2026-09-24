import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";
import type { Deployment, DeploymentsData } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// История деплоев = прогоны GitHub Actions по репозиториям из GITHUB_REPOS
// (через запятую, `owner/name`). Приватным репо нужен GITHUB_TOKEN с правом
// actions:read. Ответ кэшируем на 30 с в памяти процесса: страницу поллят,
// а лимит GitHub API — 5000 запросов в час на токен.
const REPOS = (process.env.GITHUB_REPOS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const TOKEN = process.env.GITHUB_TOKEN || "";
const CACHE_MS = 30_000;

let cache: { at: number; data: DeploymentsData } | null = null;

type Run = {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  display_title: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  run_started_at?: string;
  html_url: string;
  actor?: { login?: string; avatar_url?: string };
  event: string;
};

async function fetchRepo(repo: string): Promise<Deployment[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/runs?per_page=25`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) {
    throw new Error(`${repo}: GitHub API ${res.status}`);
  }
  const json = (await res.json()) as { workflow_runs: Run[] };
  return json.workflow_runs.map((r) => {
    const started = new Date(r.run_started_at || r.created_at).getTime();
    const ended = new Date(r.updated_at).getTime();
    return {
      id: `${repo}#${r.id}`,
      repo,
      workflow: r.name,
      branch: r.head_branch,
      sha: r.head_sha.slice(0, 7),
      title: r.display_title,
      status: r.status,
      conclusion: r.conclusion,
      event: r.event,
      created_at: r.created_at,
      updated_at: r.updated_at,
      duration_s:
        r.status === "completed" ? Math.max(0, Math.round((ended - started) / 1000)) : null,
      url: r.html_url,
      actor: r.actor?.login || "",
      actor_avatar: r.actor?.avatar_url || "",
    };
  });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (REPOS.length === 0) {
    return NextResponse.json({ configured: false, items: [], errors: [] } satisfies DeploymentsData);
  }
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.data);
  }

  const results = await Promise.allSettled(REPOS.map(fetchRepo));
  const items: Deployment[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
    else errors.push(String(r.reason?.message || r.reason));
  }
  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const data: DeploymentsData = { configured: true, items, errors };
  cache = { at: Date.now(), data };
  return NextResponse.json(data);
}
