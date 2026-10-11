"use client";

import { usePortalSession } from "@/apps/shared/use-portal-session";
import { PortalCard, PortalPage } from "@/apps/subcontractor/portal-ui";
import { PORTAL_ROLE_LABELS } from "@/lib/subcontractors/constants";

export default function Page() {
  const { userName, username, companyName, portalRole, logout, loggingOut } =
    usePortalSession("subcontractor");
  const displayName =
    companyName && !/portal-|@|cm[a-z0-9]{8}/i.test(companyName)
      ? companyName
      : userName || "קבלן משנה";

  return (
    <PortalPage title="הפרופיל שלי" subtitle="פרטי הכניסה לפורטל קבלני המשנה">
      <PortalCard>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] text-[#5B6470]">שם הקבלן</dt>
            <dd className="font-black">{displayName}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[#5B6470]">משתמש</dt>
            <dd className="font-black">{userName || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[#5B6470]">שם משתמש</dt>
            <dd className="font-black">{username || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[#5B6470]">תפקיד בפורטל</dt>
            <dd className="font-black">
              {PORTAL_ROLE_LABELS[portalRole || ""] || portalRole || "—"}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          className="mt-5 min-h-12 rounded-xl border border-[#E6E8EB] px-4 text-sm font-bold text-red-700"
          onClick={() => void logout()}
          disabled={loggingOut}
        >
          יציאה
        </button>
      </PortalCard>
    </PortalPage>
  );
}
