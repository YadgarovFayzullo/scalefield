"use client";

/**
 * Scalefield Analytics — клиентский трекер, аналог `<Analytics />` из
 * `@vercel/analytics/react`. Это НЕ пакет из node_modules (Scalefield и сайт,
 * который он отслеживает, — разные репозитории и разные деплои): файл
 * копируется в проект как есть и рендерится один раз в корневом layout.
 *
 * Как это работает:
 *  - на каждый переход (первую загрузку и клиентскую навигацию — next/link,
 *    router.push, вкладки без полной перезагрузки) шлёт маячок на
 *    `NEXT_PUBLIC_SCALEFIELD_ANALYTICS_URL` c текущим путём и document.referrer;
 *  - площадка узнаётся сама — по домену страницы, откуда пришёл маячок
 *    (см. src/app/api/collect/route.ts в Scalefield), в компоненте не нужно
 *    настраивать никакой ID проекта, только адрес эндпоинта;
 *  - без переменной окружения компонент рендерит null и ничего не шлёт —
 *    как Turnstile и другие опциональные интеграции в этом проекте:
 *    отсутствие ключа выключает фичу тихо, а не ломает сборку;
 *  - `navigator.sendBeacon` в приоритете (не блокирует переход, шлёт с
 *    закрывающейся вкладки), `fetch(..., {keepalive:true})` — запасной путь
 *    для браузеров без sendBeacon. Тело — `Blob` с `type: "text/plain"`,
 *    а не `application/json`: так POST остаётся «простым запросом» и не
 *    требует CORS-preflight (OPTIONS), хотя сервер его всё равно понимает
 *    как JSON.
 *
 * Использование (в корневом layout, рядом с другими опциональными скриптами):
 *   import { ScalefieldAnalytics } from "@/components/ScalefieldAnalytics";
 *   ...
 *   <Suspense fallback={null}>
 *     <ScalefieldAnalytics />
 *   </Suspense>
 * Suspense обязателен: useSearchParams без границы переводит статические
 * страницы в клиентский рендер целиком (та же оговорка, что у
 * NavigationProgress в этом же layout).
 */
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const ENDPOINT = process.env.NEXT_PUBLIC_SCALEFIELD_ANALYTICS_URL;

function send(path: string) {
  if (!ENDPOINT) return;
  const body = JSON.stringify({ path, referrer: document.referrer || null });
  const blob = new Blob([body], { type: "text/plain" });
  const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, blob);
  if (!sent) {
    fetch(ENDPOINT, { method: "POST", body, keepalive: true, mode: "cors" }).catch(() => {
      /* аналитика необязательна — сбой не должен быть заметен странице */
    });
  }
}

export function ScalefieldAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!ENDPOINT) return;
    const qs = searchParams?.toString();
    send(qs ? `${pathname}?${qs}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- шлём ровно на смену маршрута, не на каждый рендер
  }, [pathname, searchParams]);

  return null;
}
