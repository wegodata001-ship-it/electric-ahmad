"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileArchive, FileSignature, Link2 } from "lucide-react";
import { DocumentsHubV2Page } from "./documents-hub-v2-page";
import { ProjectSignatures } from "@/apps/project/project-signatures";
import { ShareLinksHubPage } from "@/features/platform/components/share-links-hub-page";
import { fetchClientMe } from "@/lib/auth/client-me";
import { hasDocumentPermission } from "@/lib/auth/document-permissions";
import { cn } from "@/lib/utils";

type DocumentCenterTab = "archive" | "signatures" | "shares";

const TABS = [
  {
    id: "archive" as const,
    label: "ארכיון מסמכים",
    icon: FileArchive,
  },
  {
    id: "signatures" as const,
    label: "חתימות",
    icon: FileSignature,
  },
  {
    id: "shares" as const,
    label: "קישורי שיתוף",
    icon: Link2,
  },
];

function isTab(value: string | null): value is DocumentCenterTab {
  return value === "archive" || value === "signatures" || value === "shares";
}

export function DocumentCenterPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const [role, setRole] = useState<string | null>(null);
  const [permissionsReady, setPermissionsReady] = useState(false);

  useEffect(() => {
    fetchClientMe("/api/auth/me")
      .then((json) => setRole(json.success ? json.data?.role ?? null : null))
      .catch(() => setRole(null))
      .finally(() => setPermissionsReady(true));
  }, []);

  const visibleTabs = useMemo(() => {
    if (!permissionsReady) return TABS.filter((tab) => tab.id === "archive");
    const canViewHistory = hasDocumentPermission(role, "view_history");
    return TABS.filter(
      (tab) => tab.id === "archive" || canViewHistory
    );
  }, [permissionsReady, role]);

  const activeTab: DocumentCenterTab =
    isTab(requested) && visibleTabs.some((tab) => tab.id === requested)
      ? requested
      : "archive";

  function selectTab(tab: DocumentCenterTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-slate-950">מרכז מסמכים</h1>
        <p className="mt-1 text-sm text-slate-500">
          ארכיון, חתימות וקישורי שיתוף במקום אחד
        </p>
      </div>

      <div
        className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1.5"
        role="tablist"
        aria-label="מרכז מסמכים"
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(tab.id)}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition sm:flex-none",
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <section role="tabpanel">
        {activeTab === "archive" && <DocumentsHubV2Page embedded />}
        {activeTab === "signatures" && <ProjectSignatures embedded />}
        {activeTab === "shares" && <ShareLinksHubPage embedded />}
      </section>
    </div>
  );
}
