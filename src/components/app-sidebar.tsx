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
import * as React from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "@/components/ui/types";
import LayoutDashboardIcon from "@/components/ui/layout-dashboard-icon";
import PlugConnectedIcon from "@/components/ui/plug-connected-icon";
import RocketIcon from "@/components/ui/rocket-icon";
import GaugeIcon from "@/components/ui/gauge-icon";
import ChartLineIcon from "@/components/ui/chart-line-icon";
import FileDescriptionIcon from "@/components/ui/file-description-icon";
import Stack3Icon from "@/components/ui/stack-3-icon";
import UnorderedListIcon from "@/components/ui/unordered-list-icon";
import CodeIcon from "@/components/ui/code-icon";
import GearIcon from "@/components/ui/gear-icon";

type AnimatedIcon = React.ForwardRefExoticComponent<AnimatedIconProps & React.RefAttributes<AnimatedIconHandle>>;

// Разделы проекта; href относительно /p/<slug>. Иконки — анимированные
// (itshover.com): анимация запускается наведением на всю строку меню.
const navItems: { title: string; href: string; icon: AnimatedIcon }[] = [
  { title: "Overview", href: "", icon: LayoutDashboardIcon },
  { title: "Services", href: "/services", icon: PlugConnectedIcon },
  { title: "Deployments", href: "/deployments", icon: RocketIcon },
  { title: "Monitoring", href: "/monitoring", icon: GaugeIcon },
  { title: "Analytics", href: "/analytics", icon: ChartLineIcon },
  { title: "Logs", href: "/logs", icon: FileDescriptionIcon },
  { title: "Database", href: "/database", icon: Stack3Icon },
  { title: "Table Editor", href: "/tables", icon: UnorderedListIcon },
  { title: "SQL Editor", href: "/sql", icon: CodeIcon },
  { title: "Settings", href: "/settings", icon: GearIcon },
];

function NavItem({ title, href, icon: Icon, isActive }: { title: string; href: string; icon: AnimatedIcon; isActive: boolean }) {
  const iconRef = React.useRef<AnimatedIconHandle>(null);

  return (
    <SidebarMenuItem>
      <Link href={href}>
        <SidebarMenuButton
          isActive={isActive}
          tooltip={title}
          className="h-11 px-3 cursor-pointer [&_svg]:size-5 group-data-[collapsible=icon]:p-1.5!"
          onMouseEnter={() => iconRef.current?.startAnimation()}
          onMouseLeave={() => iconRef.current?.stopAnimation()}
        >
          <Icon ref={iconRef} size={20} className="shrink-0" />
          <span className="text-base">{title}</span>
        </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
  );
}

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
                return <NavItem key={href} title={item.title} href={href} icon={item.icon} isActive={pathname === href} />;
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
