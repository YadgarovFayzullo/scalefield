import { notFound } from "next/navigation";
import Image from "next/image";
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
  const [project, all] = await Promise.all([getProject(slug), listProjects()]);
  if (!project) notFound();

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
                <button className="w-7 h-7 rounded-full overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ring-2 ring-border">
                  <Image
                    src="/user_avatar.avif"
                    alt="User avatar"
                    width={26}
                    height={26}
                    className="w-full h-full object-cover"
                  />
                </button>
              </div>
            </div>
            <main className="flex-1">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProjectProvider>
  );
}
