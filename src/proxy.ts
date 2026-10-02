import { NextRequest, NextResponse } from "next/server";

// Гейт всей панели — первая линия. Proxy в продакшн-сборке Next 16
// собирается под edge (без net/tls — драйвер Postgres не работает), поэтому
// здесь только «есть ли cookie сессии нужного формата»; живость сессии и
// членство в организации проверяют сами ручки (`projectAllowed`,
// `serverAllowed`, `requestUser` в src/lib/auth.ts) и страницы
// (`currentUser`). Dev-сервер гоняет proxy в Node и этой разницы не
// показывает — проверять сборкой.
const COOKIE_NAME = "scalefield_session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Webhook GitHub приходит без сессии — его защищает подпись секретом.
  // Маячок клиентского трекера тоже без сессии — с чужого сайта её и не будет.
  // /api/internal/* зовёт relay — по общему секрету (src/lib/relay.ts).
  // Вход через GitHub и webhook GitHub App — без сессии (state/подпись).
  const isPublic =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname === "/api/signup" ||
    pathname === "/api/invites/lookup" ||
    pathname === "/api/auth/providers" ||
    pathname === "/api/auth/github/start" ||
    pathname === "/api/auth/github/callback" ||
    pathname === "/api/github/webhook" ||
    pathname === "/api/collect" ||
    pathname.startsWith("/api/hooks/") ||
    pathname.startsWith("/api/install/") ||
    pathname.startsWith("/api/internal/");
  if (isPublic) return NextResponse.next();

  if (req.cookies.get(COOKIE_NAME)?.value?.startsWith("sfs_")) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" || pathname === "/dashboard" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Статика и картинки из public открыты — иначе логин-страница без логотипа.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|avif|webp|ico)$).*)"],
};
