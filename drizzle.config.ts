import { defineConfig } from "drizzle-kit";

// Схема control-plane (организации, проекты, серверы, сервисы, деплои).
// Миграции генерируются `npm run db:generate` в ./drizzle и применяются
// самим приложением на старте (src/db/migrate.ts), поэтому drizzle-kit
// в рантайме не нужен.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/scalefield",
  },
});
