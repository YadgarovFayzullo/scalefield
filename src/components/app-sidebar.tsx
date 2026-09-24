"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare02Icon,
  GroupLayersIcon,
  ChartLineData01Icon,
  FileScriptIcon,
  Activity03Icon,
  EditTableIcon,
} from "@hugeicons/core-free-icons";

// Разделы проекта; href относительно /p/<slug>.
const navItems = [
  { title: "Overview", href: "", icon: DashboardSquare02Icon },
  { title: "Deployments", href: "/deployments", icon: GroupLayersIcon },
  { title: "Monitoring", href: "/monitoring", icon: Activity03Icon },
  { title: "Analytics", href: "/analytics", icon: ChartLineData01Icon },
  { title: "Logs", href: "/logs", icon: FileScriptIcon },
  { title: "Database", href: "/database", icon: EditTableIcon },
];

type ProjectRef = { slug: string; name: string };

export function AppSidebar({ project, projects }: { project: ProjectRef; projects: ProjectRef[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/p/${project.slug}`;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border px-4 py-6">
        <Link href="/dashboard" className="flex items-center gap-3 group" title="All projects">
          <div className="w-11 h-11 bg-primary rounded-lg flex items-center justify-center">
            <Image
              src="/scalefield.svg"
              alt="Scalefield Logo"
              width={44}
              height={44}
              className="rounded-4xl"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-lg">Scalefield</span>
            <span className="text-sm text-muted-foreground">{project.name}</span>
          </div>
        </Link>
        {projects.length > 1 && (
          <select
            aria-label="Project"
            className="mt-3 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={project.slug}
            onChange={(e) => router.push(`/p/${e.target.value}`)}
          >
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {navItems.map((item) => {
                const href = base + item.href;
                const isActive = pathname === href;

                return (
                  <SidebarMenuItem key={href}>
                    <Link href={href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        className="h-11 px-3 cursor-pointer"
                      >
                        <HugeiconsIcon icon={item.icon} className="h-5 w-5" />
                        <span className="text-base">{item.title}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto border-t border-border p-4">
        <SidebarTrigger className="w-full cursor-pointer " />
      </div>
      <SidebarRail />
    </Sidebar>
  );
}
