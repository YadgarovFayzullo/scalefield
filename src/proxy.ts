import { NextRequest, NextResponse } from "next/server";
import { canAccessProject, canAccessServer, COOKIE_NAME, getSessionUser } from "@/lib/auth";

// Гейт всей панели (в Next 16 proxy выполняется в Node — база доступна).
// 1) Без сессии пускаем только вход, регистрацию по приглашению и публичные
//    ручки; API отвечает 401 JSON, страницы уезжают на /login.
// 2) Проект и сервер видны только участникам их организации: чужой slug/id —
//    404, как будто его нет (не 403 — не подтверждаем, что он существует).
//    Route handler'ам остаётся проверять лишь то, что специфично для них.
const PROJECT_RE = /^\/(?:p|api\/projects)\/([^/]+)/;
const SERVER_RE = /^\/(?:servers|api\/servers)\/([0-9a-f-]{36})(?:\/|$)/;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Webhook GitHub приходит без сессии — его защищает подпись секретом.
  // Маячок клиентского трекера тоже без сессии — с чужого сайта её и не будет.
  // /api/internal/* зовёт relay — по общему секрету (src/lib/relay.ts).
  const isPublic =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname === "/api/signup" ||
    pathname === "/api/invites/lookup" ||
    pathname === "/api/collect" ||
    pathname.startsWith("/api/hooks/") ||
    pathname.startsWith("/api/internal/");
  if (isPublic) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  const user = await getSessionUser(req.cookies.get(COOKIE_NAME)?.value);
  if (!user) {
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" || pathname === "/dashboard" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  const project = PROJECT_RE.exec(pathname);
  if (project && !(await canAccessProject(user, decodeURIComponent(project[1])))) return notFound(req, isApi);
  const server = SERVER_RE.exec(pathname);
  if (server && !(await canAccessServer(user, server[1]))) return notFound(req, isApi);

  return NextResponse.next();
}

function notFound(req: NextRequest, isApi: boolean) {
  if (isApi) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = req.nextUrl.clone();
  url.pathname = "/dashboard";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Статика и картинки из public открыты — иначе логин-страница без логотипа.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|avif|webp|ico)$).*)"],
};
