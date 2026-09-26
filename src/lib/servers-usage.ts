import "server-only";
import { db, schema } from "@/db";
import { agentRef, agentRequest } from "@/lib/agent";
import type { ServerData } from "@/lib/status";
import type { Server } from "@/db/schema";

/**
 * Использование ресурсов по каждому серверу — для карточки «Usage» на
 * списке проектов (аналог полосок Vercel/ISR/Function Duration, только по
 * реальным метрикам своего VPS: CPU/память/диск/база вместо квот платформы,
 * которых у self-host просто нет).
 */
export type ServerUsage = { server: Pick<Server, "id" | "name" | "host">; data: ServerData | null; error: string | null };

export async function listServersUsage(): Promise<ServerUsage[]> {
  const servers = await db.select().from(schema.servers);
  return Promise.all(
    servers.map(async (s): Promise<ServerUsage> => {
      try {
        const data = await agentRequest<ServerData>(agentRef(s), "/status/server", { timeoutMs: 8000 });
        return { server: { id: s.id, name: s.name, host: s.host }, data, error: null };
      } catch (e) {
        return { server: { id: s.id, name: s.name, host: s.host }, data: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}
