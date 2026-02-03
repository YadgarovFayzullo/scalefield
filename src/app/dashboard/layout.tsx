import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
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
  );
}
