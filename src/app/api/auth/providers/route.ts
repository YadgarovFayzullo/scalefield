import { NextResponse } from "next/server";
import { getGithubApp } from "@/lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Публичная: какие способы входа включены (кнопка GitHub — только когда приложение создано). */
export async function GET() {
  return NextResponse.json({ github: Boolean(await getGithubApp()) });
}
