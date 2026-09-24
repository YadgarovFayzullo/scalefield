import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { db } from "./index";

// Применяет SQL-миграции из ./drizzle (сгенерированы drizzle-kit). Зовётся на
// старте сервера из instrumentation.ts, так что отдельного шага деплоя нет:
// новый образ сам доводит базу до своей схемы.
export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  await migrate(db, { migrationsFolder });
}
