import "server-only";
import type { ServiceView } from "@/lib/services";

/**
 * Какие контейнеры хоста принадлежат проекту.
 *
 * Агент отдаёт ВСЕ контейнеры сервера через docker.sock — на локальной
 * машине разработчика это буквально все запущенные проекты, на реальном
 * сервере это контейнеры ДРУГИХ клиентов/стеков, если сервер общий. Как в
 * Vercel и Supabase, проект не должен видеть чужие ресурсы, поэтому список
 * фильтруется на сервере ДО того, как уйдёт в браузер — а не в UI, иначе
 * имена чужих контейнеров всё равно утекли бы в ответ API.
 *
 * Правило: контейнер принадлежит проекту, если он либо явно привязан к
 * одному из сервисов проекта (`services.container` — так помечаются старые,
 * задеплоенные руками стеки), либо назван по конвенции агента-деплоя
 * `<project-slug>-<service>` (так называет свои контейнеры `agent/app/deploy.py`).
 */
export function projectContainerFilter(slug: string, services: ServiceView[]) {
  const exact = new Set(services.map((s) => s.container).filter((c): c is string => Boolean(c)));
  const prefix = `${slug}-`;
  return (containerName: string) => exact.has(containerName) || containerName.startsWith(prefix);
}
