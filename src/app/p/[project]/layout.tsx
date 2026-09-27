import { notFound, redirect } from "next/navigation";
import { AccountMenu } from "@/components/account-menu";
import { currentUser } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProjectProvider, type ProjectContextValue } from "@/lib/project-context";
import { getProject, listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

// Раскладка проекта: резолвит slug из URL в control-plane, отдаёт проект
// клиентским компонентам через контекст и список проектов — в переключатель
// сайдбара. Несуществующий slug — честный 404.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project: slug } = await params;
  const user = await currentUser();
  if (!user) redirect("/login");
  const [project, all] = await Promise.all([getProject(slug), listProjects(user.orgIds)]);
  // Чужой проект — как несуществующий (proxy.ts уже отсёк, это вторая линия).
  if (!project || !user.orgIds.includes(project.orgId)) notFound();

  const domains = Array.from(new Set(project.services.flatMap((s) => s.domains.map((d) => d.hostname))));
  const ctx: ProjectContextValue = {
    slug: project.slug,
    name: project.name,
    serverName: project.server?.name ?? null,
    contentMetrics: Boolean(project.settings.contentMetrics),
    domains,
    apiBase: `/api/projects/${project.slug}`,
    pathBase: `/p/${project.slug}`,
  };
  const switcher = all.map((p) => ({ slug: p.slug, name: p.name }));

  return (
    <ProjectProvider value={ctx}>
      <SidebarProvider>
        <AppSidebar project={{ slug: project.slug, name: project.name }} projects={switcher} />
        <div className="flex-1 flex flex-col bg-background p-2">
          <SidebarInset className="border border-border/90">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-2 bg-sidebar border-b border-border rounded-t-xl">
              <div className="flex-1" />
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <AccountMenu account={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl, isPlatformAdmin: user.isPlatformAdmin }} />
              </div>
            </div>
            <main className="flex-1">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProjectProvider>
  );
}
