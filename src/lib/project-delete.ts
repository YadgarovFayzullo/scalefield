import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getProject } from "@/lib/projects";
import { removeService } from "@/lib/services";

/**
 * Удаление проекта (Settings → Danger zone). По умолчанию — только из панели:
 * контейнеры на сервере продолжают работать, как у Vercel «удалить проект»
 * не трогает ваш домен у регистратора. Так нельзя случайно положить прод,
 * заведённый в панель задним числом (bootstrap researcher-uz). С
 * `removeContainers` агент сначала останавливает и убирает контейнеры
 * сервисов (тот же путь, что удаление сервиса), и только потом — запись.
 * Деплои, домены, базы, бакеты и аналитика уходят каскадом.
 */
export class ProjectDeleteError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function deleteProject(slug: string, opts: { removeContainers: boolean }): Promise<{ removed: string[] }> {
  const project = await getProject(slug);
  if (!project) throw new ProjectDeleteError("Unknown project", 404);
  const removed: string[] = [];
  if (opts.removeContainers) {
    for (const s of project.services) {
      if (!s.container) continue;
      try {
        await removeService(slug, project.id, s.id);
        removed.push(s.container);
      } catch (e) {
        // Проект не удаляем: часть контейнеров уже убрана, а запись нужна,
        // чтобы повторить или убрать остальное руками.
        throw new ProjectDeleteError(
          `Could not remove ${s.container}: ${e instanceof Error ? e.message : String(e)}. ${removed.length ? `Already removed: ${removed.join(", ")}. ` : ""}The project was kept.`,
          502,
        );
      }
    }
  }
  await db.delete(schema.projects).where(eq(schema.projects.id, project.id));
  return { removed };
}
