import { PanelHeader } from "@/components/panel-header";
import { ServersList } from "@/components/dashboard/servers-list";
import { listServers, orgSshPublicKey } from "@/lib/servers";

export const dynamic = "force-dynamic";

/**
 * Серверы организации: где стоят агенты, кто онлайн, кнопка «Добавить сервер»
 * (установка по SSH из панели — как «Create server» у Forge/Ploi). Список
 * отдаётся сервером, дальше клиент обновляет его сам.
 */
export default async function ServersPage() {
  let servers: Awaited<ReturnType<typeof listServers>> = [];
  let sshPublicKey = "";
  let error: string | null = null;
  try {
    [servers, sshPublicKey] = await Promise.all([listServers(), orgSshPublicKey()]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="min-h-screen bg-background">
      <PanelHeader active="/servers" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            Control-plane database is unreachable: <span className="font-mono">{error}</span>
          </div>
        ) : (
          <ServersList initial={servers} sshPublicKey={sshPublicKey} />
        )}
      </main>
    </div>
  );
}
