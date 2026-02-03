"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
  Folder01Icon,
  GroupLayersIcon,
  ChartLineData01Icon,
  Settings05Icon,
  FileScriptIcon,
  LinkSquare02Icon,
  UserMultiple02Icon,
  Activity03Icon,
  Invoice01Icon,
  LockPasswordIcon,
  EditTableIcon,
} from "@hugeicons/core-free-icons";

// Navigation items with hugeicons
const navItems = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: DashboardSquare02Icon,
  },
  {
    title: "Table Editor",
    href: "/dashboard/database",
    icon: EditTableIcon,
  },
  {
    title: "Projects",
    href: "/dashboard/projects",
    icon: Folder01Icon,
  },
  {
    title: "Deployments",
    href: "/dashboard/deployments",
    icon: GroupLayersIcon,
  },
  {
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: ChartLineData01Icon,
  },
  {
    title: "Monitoring",
    href: "/dashboard/monitoring",
    icon: Activity03Icon,
  },
  {
    title: "Logs",
    href: "/dashboard/logs",
    icon: FileScriptIcon,
  },
  {
    title: "Webhooks",
    href: "/dashboard/webhooks",
    icon: LinkSquare02Icon,
  },
  {
    title: "API Keys",
    href: "/dashboard/api-keys",
    icon: LockPasswordIcon,
  },
  {
    title: "Team",
    href: "/dashboard/team",
    icon: UserMultiple02Icon,
  },
  {
    title: "Billing",
    href: "/dashboard/billing",
    icon: Invoice01Icon,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings05Icon,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border px-4 py-6">
        <Link href="/dashboard" className="flex items-center gap-3 group">
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
            <span className="text-sm text-muted-foreground">Dashboard</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {navItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <SidebarMenuItem key={item.href}>
                    <Link href={item.href}>
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
