/**
 * Разбор User-Agent — компактный классификатор без внешней зависимости для
 * приёмника аналитики (/api/collect): устройство/браузер/ОС и список ботов.
 * Незнакомое уходит в "Other", а не выдумывается. Единственная копия: разбор
 * лога прокси для посетителей убран, аналитика идёт только от скрипта.
 */

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|python-requests|curl\/|wget\/|go-http-client|okhttp|scrapy|headless|phantomjs|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|libwww/i;

export function isBotUa(ua: string | null | undefined): boolean {
  return BOT_UA.test(ua || "");
}

export type UaInfo = { device: string; browser: string; os: string };

export function classifyUa(ua: string | null | undefined): UaInfo {
  const ul = (ua || "").toLowerCase();

  let device: string;
  if (ul.includes("ipad") || ul.includes("tablet")) device = "Tablet";
  else if (ul.includes("mobi") || ul.includes("iphone") || ul.includes("android")) device = "Mobile";
  else device = "Desktop";

  let browser: string;
  if (ul.includes("edg/")) browser = "Edge";
  else if (ul.includes("opr/") || ul.includes("opera")) browser = "Opera";
  else if (ul.includes("yabrowser")) browser = "Yandex Browser";
  else if (ul.includes("firefox")) browser = "Firefox";
  else if (ul.includes("chrome") || ul.includes("crios")) browser = "Chrome";
  else if (ul.includes("safari") && ul.includes("version")) browser = "Safari";
  else browser = "Other";

  let os: string;
  if (ul.includes("windows")) os = "Windows";
  else if (ul.includes("android")) os = "Android";
  else if (ul.includes("iphone") || ul.includes("ipad") || ul.includes("ios")) os = "iOS";
  else if (ul.includes("mac os") || ul.includes("macintosh")) os = "macOS";
  else if (ul.includes("linux")) os = "Linux";
  else os = "Other";

  return { device, browser, os };
}

/**
 * Служебные разделы сайта — админка (под любым префиксом локали) и панель
 * Telegram: посещения редакторов, не аудитория, /api/collect их не пишет.
 * Сайт может исключить и свои пути сам — `data-exclude` у public/script.js;
 * здесь — общий минимум и страховка от закэшированных старых бандлов.
 */
const SERVICE_PATH = /^\/(?:[a-z]{2}\/)?(?:admin|tg)(?:\/|$)/;

export function isServicePath(path: string): boolean {
  return SERVICE_PATH.test(path.split("?", 1)[0]);
}
