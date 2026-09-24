import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as tables from "./schema";
import * as rels from "./relations";

const schema = { ...tables, ...rels };

// Один пул на процесс. Next в dev перезагружает модули, поэтому клиент
// кладём в globalThis — иначе на каждый hot reload открывался бы новый пул.
const g = globalThis as unknown as { __scalefieldSql?: ReturnType<typeof postgres> };

export function databaseUrl(): string {
  return process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/scalefield";
}

function sqlClient() {
  if (!g.__scalefieldSql) {
    g.__scalefieldSql = postgres(databaseUrl(), { max: 5, prepare: false });
  }
  return g.__scalefieldSql;
}

export const db = drizzle({ client: sqlClient(), schema });
export type Db = typeof db;
export { schema };
