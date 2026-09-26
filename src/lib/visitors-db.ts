import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { VisitorsData } from "@/lib/status";

/**
 * Посетители из событий клиентского трекера (`page_views`) — точнее, чем
 * разбор лога прокси (agent/status/visitors): ловит клиентские SPA-переходы
 * и не зависит от того, какой заголовок пишет Traefik. Форма ответа —
 * ровно `VisitorsData`, чтобы страница `/analytics` не различала источник.
 */

type Row = { path: string; referrer: string | null; visitorHash: string; device: string | null; browser: string | null; os: string | null; createdAt: Date };

function top(counter: Map<string, number>, n = 10) {
  return Array.from(counter, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function referrerHost(raw: string | null): string {
  if (!raw) return "Direct";
  try {
    return new URL(raw).hostname || "Direct";
  } catch {
    return "Direct";
  }
}

function aggregate(rows: Row[]) {
  const visitorViews = new Map<string, number>();
  const pages = new Map<string, { views: number; visitors: Set<string> }>();
  const referrers = new Map<string, number>();
  const devices = new Map<string, number>();
  const browsers = new Map<string, number>();
  const oses = new Map<string, number>();
  const daily = new Map<number, { visitors: Set<string>; views: number }>();

  for (const r of rows) {
    visitorViews.set(r.visitorHash, (visitorViews.get(r.visitorHash) ?? 0) + 1);
    const page = pages.get(r.path) ?? { views: 0, visitors: new Set<string>() };
    page.views += 1;
    page.visitors.add(r.visitorHash);
    pages.set(r.path, page);
    if (r.device) devices.set(r.device, (devices.get(r.device) ?? 0) + 1);
    if (r.browser) browsers.set(r.browser, (browsers.get(r.browser) ?? 0) + 1);
    if (r.os) oses.set(r.os, (oses.get(r.os) ?? 0) + 1);
    const ref = referrerHost(r.referrer);
    referrers.set(ref, (referrers.get(ref) ?? 0) + 1);
    const day = Math.floor(r.createdAt.getTime() / 86_400_000) * 86_400;
    const d = daily.get(day) ?? { visitors: new Set<string>(), views: 0 };
    d.visitors.add(r.visitorHash);
    d.views += 1;
    daily.set(day, d);
  }

  const visitors = visitorViews.size;
  const bounces = Array.from(visitorViews.values()).filter((v) => v === 1).length;
  const topPages = Array.from(pages, ([path, v]) => ({ path, views: v.views, visitors: v.visitors.size }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);
  const topReferrers = Array.from(referrers, ([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const series = Array.from(daily, ([day, v]) => ({ day, visitors: v.visitors.size, views: v.views })).sort((a, b) => a.day - b.day);

  return {
    visitors,
    page_views: rows.length,
    bounce_rate: visitors ? Math.round((bounces / visitors) * 10000) / 10000 : 0,
    top_pages: topPages,
    referrers: topReferrers,
    devices: top(devices),
    browsers: top(browsers),
    operating_systems: top(oses),
    series,
  };
}

function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export async function hasTrackedViews(projectId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.pageViews.id })
    .from(schema.pageViews)
    .where(eq(schema.pageViews.projectId, projectId))
    .limit(1);
  return rows.length > 0;
}

export async function visitorsFromDb(projectId: string, days: number): Promise<VisitorsData> {
  const now = Date.now();
  const windowMs = days * 86_400_000;
  const cutoffCurrent = new Date(now - windowMs);
  const cutoffPrevious = new Date(now - 2 * windowMs);

  const rows = await db
    .select({
      path: schema.pageViews.path,
      referrer: schema.pageViews.referrer,
      visitorHash: schema.pageViews.visitorHash,
      device: schema.pageViews.device,
      browser: schema.pageViews.browser,
      os: schema.pageViews.os,
      createdAt: schema.pageViews.createdAt,
    })
    .from(schema.pageViews)
    .where(and(eq(schema.pageViews.projectId, projectId), gte(schema.pageViews.createdAt, cutoffPrevious)));

  const current = rows.filter((r) => r.createdAt >= cutoffCurrent);
  const previous = rows.filter((r) => r.createdAt < cutoffCurrent);
  const curAgg = aggregate(current);
  const prevAgg = aggregate(previous);

  return {
    configured: true,
    window_days: days,
    visitors: curAgg.visitors,
    page_views: curAgg.page_views,
    bounce_rate: curAgg.bounce_rate,
    changes: {
      visitors: pctChange(curAgg.visitors, prevAgg.visitors),
      page_views: pctChange(curAgg.page_views, prevAgg.page_views),
      bounce_rate: pctChange(curAgg.bounce_rate, prevAgg.bounce_rate),
    },
    series: curAgg.series,
    top_pages: curAgg.top_pages,
    referrers: curAgg.referrers,
    referrer_capture_available: true,
    devices: curAgg.devices,
    browsers: curAgg.browsers,
    operating_systems: curAgg.operating_systems,
  };
}
