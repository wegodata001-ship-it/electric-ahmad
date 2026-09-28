"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  workDiariesService,
  type WorkDiaryListItem,
} from "@/features/work-diaries/services/work-diaries.service";
import { FieldEmptyState, FieldPageHeader, field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; cls: string }> = {
  assigned: { label: "חדש", cls: field.badge.yellow },
  in_progress: { label: "בטיפול", cls: field.badge.orange },
  approved: { label: "הושלם", cls: field.badge.green },
  completed: { label: "הושלם", cls: field.badge.green },
  pending_approval: { label: "ממתין", cls: field.badge.yellow },
  in_approval: { label: "ממתין", cls: field.badge.yellow },
  revision: { label: "הוחזר", cls: field.badge.orange },
  draft: { label: "טיוטה", cls: field.badge.gray },
  signed: { label: "הושלם", cls: field.badge.green },
  client_signed: { label: "הושלם", cls: field.badge.green },
  sent_to_client: { label: "הושלם", cls: field.badge.green },
};

type Bucket = "new" | "progress" | "done";

function bucketOf(status: string): Bucket {
  if (status === "assigned") return "new";
  if (
    status === "approved" ||
    status === "completed" ||
    status === "signed" ||
    status === "client_signed" ||
    status === "sent_to_client" ||
    status === "locked" ||
    status.startsWith("used_")
  ) {
    return "done";
  }
  return "progress";
}

const BUCKETS: { id: Bucket; label: string }[] = [
  { id: "new", label: "חדש" },
  { id: "progress", label: "בטיפול" },
  { id: "done", label: "הושלם" },
];

export function FieldDiariesList() {
  const [items, setItems] = useState<WorkDiaryListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("new");

  useEffect(() => {
    workDiariesService
      .list()
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map: Record<Bucket, WorkDiaryListItem[]> = {
      new: [],
      progress: [],
      done: [],
    };
    for (const item of items) map[bucketOf(item.status)].push(item);
    return map;
  }, [items]);

  const visible = grouped[bucket];

  return (
    <div className="space-y-5">
      <FieldPageHeader
        title="יומני עבודה שלי"
        subtitle="רק יומנים שהוקצו אליך"
        action={
          <Link
            href="/field/work-diaries/new"
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

      <div className="grid grid-cols-3 gap-2">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBucket(b.id)}
            className={cn(
              "rounded-2xl px-2 py-3 text-sm font-black",
              bucket === b.id
                ? "bg-blue-600 text-white"
                : "bg-white text-[#374151]"
            )}
          >
            {b.label}
            <span className="mt-1 block text-xs font-semibold opacity-80">
              {grouped[b.id].length}
            </span>
          </button>
        ))}
      </div>

      {!loading && !visible.length && (
        <FieldEmptyState
          emoji="📘"
          title="אין יומנים בקטגוריה זו"
          description="יומנים שהוקצו אליך יופיעו כאן."
          actionHref="/field/work-diaries/new"
          actionLabel="יומן עבודה חדש"
        />
      )}

      <div className="space-y-4">
        {visible.map((item) => {
          const ui = STATUS[item.status] || {
            label: item.statusLabel || item.status,
            cls: field.badge.gray,
          };
          const fix = item.status === "revision";
          return (
            <Link
              key={item.id}
              href={
                fix
                  ? `/field/work-diaries/new?reviseId=${item.id}`
                  : `/field/work-diaries/${item.id}`
              }
              className={cn(field.cardInteractive, "block overflow-hidden p-0")}
            >
              {fix && <div className="h-1.5 w-full bg-orange-500" />}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black text-[#111827]">
                      {item.project?.name || item.siteLabel || "פרויקט"}
                    </p>
                    <p className="mt-2 text-base text-[#6B7280]">
                      {new Date(item.workDate).toLocaleDateString("he-IL")}
                    </p>
                    {!!item.workItems?.length && (
                      <p className="mt-1 text-sm text-[#6B7280]">
                        {item.workItems.map((w) => w.description).join(" · ")}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-[#9CA3AF]">
                      נשלח ע״י {item.createdBy?.name || "—"}
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
