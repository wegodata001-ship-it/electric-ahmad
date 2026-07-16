"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useAppStore } from "@/store/app.store";
import { cn } from "@/lib/utils";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header />
      <main
        className={cn(
          "pt-[116px] min-h-screen transition-all duration-300 lg:pt-16",
          sidebarCollapsed ? "lg:mr-[72px]" : "lg:mr-[260px]"
        )}
      >
        <div className="p-3 sm:p-4 lg:p-6 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
