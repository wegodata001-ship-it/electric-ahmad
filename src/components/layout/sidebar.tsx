"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mainNavigation } from "@/config/navigation";
import { useAppStore } from "@/store/app.store";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Drawer } from "@/components/ui";
import { BrandLogo, BrandWordmark } from "@/components/brand/brand-logo";

export function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    toggleSidebar,
    mobileNavOpen,
    setMobileNavOpen,
  } = useAppStore();

  const navigation = (mobile = false) => (
    <nav className={cn("flex-1 py-4 px-3 space-y-1 overflow-y-auto", mobile && "py-2")}>
      {mainNavigation.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => mobile && setMobileNavOpen(false)}
            className={cn(
              "flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon
              className={cn(
                "h-5 w-5 flex-shrink-0",
                isActive ? "text-primary-600" : "text-gray-400"
              )}
            />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed top-0 right-0 hidden h-full bg-white border-l border-gray-200/80 z-40 transition-all duration-300 lg:flex lg:flex-col",
          sidebarCollapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        <div className="h-16 flex items-center px-4 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-3">
            <BrandLogo height={sidebarCollapsed ? 28 : 36} maxWidth={sidebarCollapsed ? 36 : 140} />
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <BrandWordmark />
              </motion.div>
            )}
          </Link>
        </div>

        {sidebarCollapsed ? (
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {mainNavigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.name}
                  className={cn(
                    "flex min-h-11 items-center justify-center rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-primary-600" : "text-gray-400"
                    )}
                  />
                </Link>
              );
            })}
          </nav>
        ) : (
          navigation()
        )}

        <div className="p-3 border-t border-gray-100">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center h-9 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                sidebarCollapsed && "rotate-180"
              )}
            />
          </button>
        </div>
      </aside>

      <Drawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        title="ניווט"
        side="right"
      >
        {navigation(true)}
      </Drawer>
    </>
  );
}
