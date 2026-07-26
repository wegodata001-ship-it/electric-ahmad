"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";
import { approvalsService } from "@/features/work-diaries/services/work-diaries.service";

function kindLabel(kind: string) {
  if (kind === "work_diary") return "יומן עבודה";
  if (kind === "delivery_note") return "תעודת משלוח";
  if (kind === "measurement_sheet") return "דף מדידה";
  return kind;
}

function portalBase(pathname: string) {
  if (pathname.startsWith("/project")) return "/project";
  if (pathname.startsWith("/field")) return "/field";
  return "/operations";
}

export function ApprovalsInboxPage() {
  const pathname = usePathname();
  const base = portalBase(pathname);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    approvalsService
      .pending()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-0 sm:p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-[#03142F]">ממתינים לאישור</h1>
        <p className="mt-1 text-sm text-gray-500">
          פתחו את המסמך המלא — רק אחרי קריאה אפשר לאשר או להחזיר לתיקון
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">טוען…</p>}

      {!loading && !items.length && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          אין מסמכים ממתינים לאישור
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const href = `${base}/approvals/review/${item.kind}/${item.documentId}`;
          return (
            <Link
              key={`${item.kind}-${item.approvalId}`}
              href={href}
              className="block rounded-2xl border-2 border-amber-200 bg-white p-4 transition hover:border-amber-400 hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-800">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-amber-700">
                    {kindLabel(item.kind)}
                  </p>
                  <p className="truncate text-lg font-black text-[#03142F]">
                    {item.documentNumber || item.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {item.projectName || item.project?.name || "ללא פרויקט"}
                    {item.createdByName ? ` · ${item.createdByName}` : ""}
                    {item.foremanName ? ` · ${item.foremanName}` : ""}
                    {item.version ? ` · V${item.version}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    נשלח: {new Date(item.sentAt).toLocaleString("he-IL")}
                  </p>
                </div>
                <span className="shrink-0 self-center rounded-xl bg-stone-900 px-3 py-2 text-xs font-black text-white">
                  פתח לאישור
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
