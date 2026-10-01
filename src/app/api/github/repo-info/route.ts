import { NextRequest, NextResponse } from "next/server";
import { primaryOrgId, requestUser } from "@/lib/auth";
import { repoInsights } from "@/lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** Ветки, CI-workflow и признаки стека репозитория — для автонастройки сервиса при подключении. */
export async function GET(req: NextRequest) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = primaryOrgId(user);
  if (!orgId) return NextResponse.json({ error: "You are not a member of any team" }, { status: 403 });
  const repo = req.nextUrl.searchParams.get("repo") || "";
  if (!REPO_RE.test(repo)) return NextResponse.json({ error: "repo must be owner/name" }, { status: 400 });
  try {
    return NextResponse.json({ repo: await repoInsights(orgId, repo) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 404 });
  }
}
