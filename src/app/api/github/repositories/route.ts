import { NextRequest, NextResponse } from "next/server";
import { primaryOrgId, requestUser } from "@/lib/auth";
import { getGithubApp, listRepositories } from "@/lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Репозитории для «Import Git Repository»: всё, что открыто установкам GitHub App команды. */
export async function GET(req: NextRequest) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = primaryOrgId(user);
  if (!orgId) return NextResponse.json({ error: "You are not a member of any team" }, { status: 403 });
  if (!(await getGithubApp())) return NextResponse.json({ app: false, installed: false, repos: [], errors: [] });
  return NextResponse.json({ app: true, orgId, ...(await listRepositories(orgId)) });
}
