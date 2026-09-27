import "server-only";
import { COOKIE_NAME, getSessionUser } from "@/lib/auth";

// Совместимость для route handler'ов: «есть ли живая сессия». Кто этот
// пользователь и что ему доступно — src/lib/auth.ts; доступ к конкретному
// проекту/серверу проверяет src/proxy.ts до того, как запрос дойдёт сюда.
export { COOKIE_NAME };

export async function isValidSession(token: string | undefined): Promise<boolean> {
  return (await getSessionUser(token)) !== null;
}
