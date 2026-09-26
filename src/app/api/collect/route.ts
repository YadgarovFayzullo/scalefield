import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getProjectByDomain } from "@/lib/services";
import { classifyUa, isBotUa } from "@/lib/ua";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Приёмник событий клиентского трекера (`<Analytics />`, см.
 * scalefield-analytics.tsx) — публичный, без сессии и без токена в коде
 * сайта: проект узнаётся по домену страницы, откуда пришёл маячок (Origin/
 * Referer запроса), точно как у Vercel Analytics компонент ничего не
 * настраивает, площадка узнаётся сама. Это не защита от подделки Origin
 * сервером — это идентификация, а не авторизация; данные аналитики не
 * секрет, и худшее, что можно сделать поддельным Origin, — исказить
 * собственную аналитику чужого проекта, а не прочитать чужие данные.
 *
 * Тело шлётся `navigator.sendBeacon` Blob'ом с `type: "text/plain"`
 * специально, чтобы избежать CORS-preflight (простой POST не требует
 * OPTIONS); поэтому Content-Type тела — не JSON, парсим текст сами.
 *
 * IP не хранится: только необратимый хеш (соль + IP + UA + сутки) — этого
 * достаточно, чтобы посчитать уникальных посетителей, не храня ничего
 * похожего на персональные данные.
 */
const RATE_LIMIT = 60; // событий с одного IP за окно
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}
// Изредка подчищаем карту, иначе она растёт, пока процесс жив.
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of rateBuckets) if (b.resetAt <= now) rateBuckets.delete(ip);
}, 5 * 60_000);

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "0.0.0.0";
}

function originHost(req: NextRequest): string | null {
  const raw = req.headers.get("origin") || req.headers.get("referer");
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function corsHeaders(req: NextRequest): HeadersInit {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";

  // Молча проглатываем всё, что не выглядит валидным маячком — это
  // публичный write-only эндпоинт, отвечать 4xx на мусор нет смысла, а
  // страница-отправитель к ответу всё равно не приглядывается.
  if (isBotUa(ua) || rateLimited(ip)) {
    return new NextResponse(null, { status: 204, headers });
  }

  const host = originHost(req);
  if (!host) return new NextResponse(null, { status: 204, headers });

  let body: { path?: string; referrer?: string | null };
  try {
    const text = await req.text();
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204, headers });
  }
  const path = typeof body.path === "string" ? body.path.slice(0, 500) : null;
  if (!path) return new NextResponse(null, { status: 204, headers });

  const project = await getProjectByDomain(host);
  if (!project) return new NextResponse(null, { status: 204, headers });

  const day = Math.floor(Date.now() / 86_400_000);
  const salt = process.env.ANALYTICS_SALT || process.env.SESSION_SECRET || "scalefield";
  const visitorHash = createHash("sha256").update(`${salt}:${ip}:${ua}:${day}`).digest("hex");
  const { device, browser, os } = classifyUa(ua);
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;

  try {
    await db.insert(schema.pageViews).values({
      projectId: project.id,
      path,
      referrer,
      visitorHash,
      device,
      browser,
      os,
    });
  } catch {
    // База недоступна — маячок всё равно отвечает 204, страница-отправитель
    // не должна ничего заметить.
  }

  return new NextResponse(null, { status: 204, headers });
}
