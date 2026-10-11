"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { workerNavigation } from "@/config/navigation";
import { BrandLogo, BrandWordmark } from "@/components/brand/brand-logo";

export function WorkerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background" data-layout="portal" data-app="worker">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200/80">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/worker" className="flex items-center gap-2">
            <BrandLogo height={28} maxWidth={110} />
            <BrandWordmark compact />
          </Link>
          <Link href="/dashboard" className="text-xs text-primary-600 hover:text-primary-700">
            ממשק ניהול
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200/80 z-30">
        <div className="max-w-lg mx-auto flex">
          {workerNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors",
                  isActive ? "text-primary-600" : "text-gray-400"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
