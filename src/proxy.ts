import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";

// Гейт всего дашборда: без сессии пускаем только логин и его API.
// API отвечает 401 JSON, страницы уезжают на /login.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Webhook GitHub приходит без сессии — его защищает подпись секретом.
  // Маячок клиентского трекера тоже без сессии — с чужого сайта её и не будет.
  // /api/internal/* зовёт relay — по общему секрету (src/lib/relay.ts).
  const isPublic =
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname === "/api/collect" ||
    pathname.startsWith("/api/hooks/") ||
    pathname.startsWith("/api/internal/");
  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (await isValidSession(token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Статика и картинки из public открыты — иначе логин-страница без логотипа.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|avif|webp|ico)$).*)"],
};
