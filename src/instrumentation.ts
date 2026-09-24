// Старт сервера: миграции control-plane и бутстрап из env. Только в node-рантайме
// (edge-бандл proxy.ts сюда тоже заходит, но базы там нет).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SCALEFIELD_SKIP_MIGRATIONS === "1") return;
  const { runMigrations } = await import("./db/migrate");
  const { bootstrapFromEnv } = await import("./lib/bootstrap");
  try {
    await runMigrations();
    await bootstrapFromEnv();
  } catch (e) {
    // Без базы панель бесполезна, но падать на старте тоже нельзя — иначе
    // не увидеть логи. Страницы покажут ошибку подключения.
    console.error("[scalefield] миграции/бутстрап не выполнены:", e);
  }
}
