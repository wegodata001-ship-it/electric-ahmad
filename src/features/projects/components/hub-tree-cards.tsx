"use client";

import {
  Building2,
  FolderKanban,
  HardHat,
  Landmark,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";
import type { HubNodeKind } from "./hub-tree-types";

const KIND: Record<
  HubNodeKind,
  { label: string; icon: typeof Building2; accent: string; soft: string }
> = {
  company: {
    label: "חברה",
    icon: Landmark,
    accent: "#C8102E",
    soft: "#FDECEE",
  },
  region: {
    label: "אזור עבודה",
    icon: MapPin,
    accent: "#9B0C24",
    soft: "#FFF1F3",
  },
  project: {
    label: "פרויקט",
    icon: FolderKanban,
    accent: "#111827",
    soft: "#F3F4F6",
  },
  site: {
    label: "סניף עבודה",
    icon: Building2,
    accent: "#0F766E",
    soft: "#CCFBF1",
  },
  contractor: {
    label: "קבלן משנה",
    icon: HardHat,
    accent: "#9A3412",
    soft: "#FFEDD5",
  },
};

export function HubEntityCard({
  kind,
  title,
  lines,
  status,
  selected,
  expanded,
  hasChildren,
  onOpen,
  onDetails,
}: {
  kind: HubNodeKind;
  title: string;
  lines: string[];
  status?: string;
  selected?: boolean;
  expanded?: boolean;
  hasChildren?: boolean;
  onOpen?: () => void;
  onDetails?: () => void;
}) {
  const meta = KIND[kind];
  const Icon = meta.icon;
  const company = kind === "company";

  return (
    <article
      dir="rtl"
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white text-right shadow-[0_4px_14px_rgba(17,17,17,0.06)]",
        selected ? "border-[#C8102E]" : "border-[#E6E8EB]",
        company && "shadow-[0_8px_22px_rgba(200,16,46,0.12)]"
      )}
    >
      <span
        className={cn("absolute inset-y-0 right-0", company ? "w-1.5" : "w-1")}
        style={{ background: meta.accent }}
        aria-hidden
      />
      <button
        type="button"
        className="min-h-0 flex-1 px-3 py-2.5 pr-4 text-right"
        onClick={onOpen}
        disabled={!onOpen}
      >
        <div className="flex items-start gap-2">
          {company ? (
            <BrandLogo height={34} maxWidth={88} />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: meta.soft, color: meta.accent }}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold" style={{ color: meta.accent }}>
              {meta.label}
            </p>
            <p
              className={cn(
                "font-black leading-tight text-[#111111]",
                company ? "line-clamp-2 text-[15px]" : "line-clamp-2 text-[13px]"
              )}
            >
              {title}
            </p>
          </div>
        </div>
        <div className="mt-1.5 space-y-0.5">
          {lines.filter(Boolean).slice(0, 3).map((line) => (
            <p key={line} className="truncate text-[12px] text-[#5B6470]">
              {line}
            </p>
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {status ? (
            <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-bold text-[#111827]">
              {status}
            </span>
          ) : (
            <span />
          )}
          {hasChildren && (
            <span className="text-[11px] font-bold text-[#C8102E]">
              {expanded ? "כווץ" : "הרחב"}
            </span>
          )}
        </div>
      </button>
      {onDetails && (
        <button
          type="button"
          className="border-t border-[#F3F4F6] px-3 py-1.5 text-[11px] font-bold text-[#C8102E] hover:bg-[#FDECEE]"
          onClick={(e) => {
            e.stopPropagation();
            onDetails();
          }}
        >
          פתח פרטים
        </button>
      )}
    </article>
  );
}
