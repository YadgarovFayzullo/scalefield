import { notFound, redirect } from "next/navigation";
import { PanelHeader } from "@/components/panel-header";
import { ServerDetail } from "@/components/dashboard/server-detail";
import { canAccessServer, currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Страница сервера: шапка с аккаунтом (сервер) + статус и живой лог установки (клиент). Чужой сервер — 404. */
export default async function ServerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!(await canAccessServer(user, id))) notFound();
  return (
    <div className="min-h-screen bg-background">
      <PanelHeader active="/servers" />
      <ServerDetail />
    </div>
  );
}
