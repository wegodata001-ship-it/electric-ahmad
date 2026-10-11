"use client";

import { useState } from "react";
import { COMPANY_PROFILE } from "@/config/company";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  height?: number;
  maxWidth?: number;
};

export function BrandLogo({ className, height = 40, maxWidth }: Props) {
  const [failed, setFailed] = useState(!COMPANY_PROFILE.logoUrl);

  if (failed) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-[var(--brand-border)] bg-white px-3 py-2 text-center",
          className
        )}
        role="status"
      >
        <p className="text-[11px] font-semibold text-[var(--brand-text-muted)]">
          הלוגו חסר — יש להעלות את הקובץ
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-[var(--brand-text-muted)]">
          public/client-logo.png
        </p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={COMPANY_PROFILE.logoUrl}
      alt={COMPANY_PROFILE.name}
      className={cn("w-auto max-w-full object-contain object-right", className)}
      style={{ height, maxWidth: maxWidth ?? "100%" }}
      onError={() => setFailed(true)}
    />
  );
}

export function BrandWordmark({
  compact = false,
  align = "start",
}: {
  compact?: boolean;
  align?: "start" | "center";
}) {
  return (
    <div className={cn("min-w-0", align === "center" && "text-center")}>
      <p className="truncate text-sm font-black leading-tight text-[var(--brand-text)]">
        {COMPANY_PROFILE.name}
      </p>
      {!compact && (
        <p className="truncate text-[11px] leading-tight text-[var(--brand-text-muted)]">
          {COMPANY_PROFILE.tagline}
        </p>
      )}
    </div>
  );
}
