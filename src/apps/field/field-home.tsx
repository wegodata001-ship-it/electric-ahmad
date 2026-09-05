"use client";

import Link from "next/link";
import { BookOpen, Clock, Truck, UserRound } from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

/**
 * Site Manager home — 4 big actions only. No dashboard / tree / lists.
 */
export function FieldHome() {
  const { userName } = usePortalSession("field");
  const firstName = (userName || "מנהל").split(" ")[0];

  return (
    <div className="space-y-5">
      <section>
        <h1 className={field.title}>שלום, {firstName}</h1>
        <p className={field.subtitle}>עבודה בשטח · דיווח ושליחה לאישור</p>
      </section>

      <nav className="grid gap-3">
        <HomeBtn
          href="/field/attendance"
          icon={Clock}
          title="נוכחות"
          accent="emerald"
        />
        <HomeBtn
          href="/field/work-diaries/new"
          icon={BookOpen}
          title="יומן עבודה"
          accent="slate"
        />
        <HomeBtn
          href="/field/delivery-notes/new"
          icon={Truck}
          title="תעודת משלוח"
          accent="slate"
        />
        <HomeBtn
          href="/field/profile"
          icon={UserRound}
          title="פרופיל"
          accent="white"
        />
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
  accent: "emerald" | "slate" | "white";
}) {
  const styles =
    accent === "emerald"
      ? "bg-emerald-600 text-white border-emerald-600"
      : accent === "slate"
        ? "bg-slate-900 text-white border-slate-900"
        : "bg-white text-slate-900 border-slate-200";

  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[4.75rem] items-center gap-4 rounded-3xl border-2 px-5 py-4 shadow-sm transition active:scale-[0.99]",
        styles
      )}
    >
      <span
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
          accent === "white"
            ? "bg-slate-100 text-slate-800"
            : "bg-white/15 text-white"
        )}
      >
        <Icon className="h-7 w-7" />
      </span>
      <span className="text-lg font-black">{title}</span>
    </Link>
  );
}
