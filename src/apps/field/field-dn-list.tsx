"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { opsDeliveryNotesService } from "@/features/work-diaries/services/work-diaries.service";
import { FieldEmptyState, FieldPageHeader, field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; cls: string }> = {
  approved: { label: "אושר", cls: field.badge.green },
  pending_approval: { label: "ממתין", cls: field.badge.yellow },
  revision: { label: "הוחזר", cls: field.badge.orange },
  draft: { label: "טיוטה", cls: field.badge.gray },
};

export function FieldDnList() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    opsDeliveryNotesService
      .list()
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <FieldPageHeader
        title="תעודות משלוח"
        subtitle="התעודות שלך"
        action={
          <Link
            href="/field/delivery-notes/new"
            className="inline-flex min-h-14 items-center gap-1 rounded-2xl bg-blue-600 px-4 text-base font-black text-white"
          >
            <Plus className="h-5 w-5" />
            חדש
          </Link>
        }
      />

      {error && <p className={field.error}>{error}</p>}
      {loading && (
        <p className="py-10 text-center text-lg text-[#6B7280]">טוען…</p>
      )}
      {!loading && !items.length && (
        <FieldEmptyState
          emoji="🚚"
          title="אין תעודות משלוח"
          description="צרו תעודה חדשה כשמוציאים ציוד מהמחסן או לאתר."
          actionHref="/field/delivery-notes/new"
          actionLabel="צור תעודת משלוח"
        />
      )}

      <div className="space-y-4">
        {items.map((item) => {
          const ui = STATUS[item.status] || {
            label: item.status,
            cls: field.badge.gray,
          };
          const fix = item.status === "revision";
          return (
            <Link
              key={item.id}
              href={
                fix
                  ? `/field/delivery-notes/new?reviseId=${item.id}`
                  : `/field/delivery-notes/${item.id}`
              }
              className={cn(field.cardInteractive, "block overflow-hidden p-0")}
            >
              {fix && <div className="h-1.5 w-full bg-orange-500" />}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black text-[#111827]">
                      {item.documentNumber || "תעודה"}
                    </p>
                    <p className="mt-2 text-base text-[#6B7280]">
                      {item.project?.name || item.clientName || "—"}
                    </p>
                  </div>
                  <span className={ui.cls}>{ui.label}</span>
                </div>
                {fix && (
                  <p className={cn(field.btnDanger, "mt-5 bg-orange-500")}>
                    תקן ושלח שוב
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
