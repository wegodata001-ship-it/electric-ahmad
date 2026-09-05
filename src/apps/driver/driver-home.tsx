"use client";

import Link from "next/link";
import { FilePlus2, Files, UserRound, LogOut } from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";

export function DriverHome() {
  const { loggingOut, logout } = usePortalSession("driver");

  return (
    <div className="space-y-4">
      <section className="text-center">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          מה עושים עכשיו?
        </h1>
        <p className="mt-1 text-sm text-slate-500">תעודות משלוח בלבד</p>
      </section>

      <nav className="grid gap-3">
        <HomeBtn
          href="/driver/delivery-notes/new"
          icon={FilePlus2}
          title="תעודת משלוח חדשה"
          accent="bg-slate-900 text-white"
        />
        <HomeBtn
          href="/driver/delivery-notes"
          icon={Files}
          title="תעודות משלוח שלי"
          accent="bg-white text-slate-900 border-2 border-slate-200"
        />
        <HomeBtn
          href="/driver/profile"
          icon={UserRound}
          title="פרופיל"
          accent="bg-white text-slate-900 border-2 border-slate-200"
        />
        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
          className="flex min-h-[4.5rem] items-center gap-4 rounded-3xl border-2 border-slate-200 bg-white px-5 py-4 text-right shadow-sm active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <LogOut className="h-7 w-7" />
          </span>
          <span className="text-lg font-black">התנתקות</span>
        </button>
      </nav>
    </div>
  );
}

function HomeBtn({
  href,
  icon: Icon,
  title,
  accent,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[4.5rem] items-center gap-4 rounded-3xl px-5 py-4 shadow-sm transition active:scale-[0.99] ${accent}`}
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
          accent.includes("bg-slate-900")
            ? "bg-white/15 text-white"
            : "bg-slate-100 text-slate-800"
        }`}
      >
        <Icon className="h-7 w-7" />
      </span>
      <span className="text-lg font-black">{title}</span>
    </Link>
  );
}
