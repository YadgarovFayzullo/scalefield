import { redirect } from "next/navigation";
import { PanelHeader } from "@/components/panel-header";
import { InvitesBoard } from "@/components/dashboard/invites-board";
import { currentUser } from "@/lib/auth";
import { listInvites } from "@/lib/invites";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Приглашения в Scalefield — только владелец платформы: регистрация закрыта, пока продукт сырой. */
export default async function InvitesPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.isPlatformAdmin) redirect("/dashboard");
  const [invites, teams] = await Promise.all([
    listInvites(),
    user.orgIds.length
      ? db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations).where(inArray(schema.organizations.id, user.orgIds))
      : Promise.resolve([]),
  ]);
  return (
    <div className="min-h-screen bg-background">
      <PanelHeader active="/settings" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <InvitesBoard initial={invites} teams={teams} />
      </main>
    </div>
  );
}
