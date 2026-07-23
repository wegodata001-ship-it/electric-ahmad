"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export type DocumentAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  hidden?: boolean;
  variant?: "primary" | "default" | "danger";
};

type Props = {
  actions: DocumentAction[];
};

const variantClass: Record<NonNullable<DocumentAction["variant"]>, string> = {
  primary:
    "border-transparent bg-[var(--portal-accent,#1d4ed8)] text-white hover:opacity-90",
  default:
    "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
  danger: "border-red-200 bg-white text-red-600 hover:bg-red-50",
};

export function DocumentActionBar({ actions }: Props) {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((action) => {
        const Icon = action.icon;
        const className = `inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
          variantClass[action.variant ?? "default"]
        }`;

        if (action.href) {
          return (
            <Link key={action.id} href={action.href} className={className}>
              {Icon && <Icon className="h-4 w-4" />}
              {action.label}
            </Link>
          );
        }

        return (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            className={className}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
