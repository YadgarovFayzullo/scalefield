import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/session";

// Гейт всего дашборда: без сессии пускаем только логин и его API.
// API отвечает 401 JSON, страницы уезжают на /login.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/login" || pathname === "/api/login" || pathname === "/api/logout";
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
