import { redirect } from "next/navigation";
import { PanelHeader } from "@/components/panel-header";
import { ImportRepository } from "@/components/dashboard/import-repository";
import { currentUser, primaryOrgId } from "@/lib/auth";
import { listServers } from "@/lib/servers";

export const dynamic = "force-dynamic";

/** «Import Git Repository» (как New Project у Vercel): репозитории команды → проект на своём сервере. */
export default async function NewProjectPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const orgId = primaryOrgId(user);
  const servers = orgId ? (await listServers([orgId])).map((s) => ({ id: s.id, name: s.name, online: s.online })) : [];
  return (
    <div className="min-h-screen bg-background">
      <PanelHeader active="/dashboard" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <ImportRepository servers={servers} />
      </main>
    </div>
  );
}
