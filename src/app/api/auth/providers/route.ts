import { NextResponse } from "next/server";
import { getGithubApp } from "@/lib/github-app";
import { signupOpen } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Публичная: какие способы входа включены (кнопка GitHub — только когда приложение создано) и открыта ли регистрация через GitHub. */
export async function GET() {
  const github = Boolean(await getGithubApp());
  return NextResponse.json({ github, signupOpen: signupOpen() });
}
