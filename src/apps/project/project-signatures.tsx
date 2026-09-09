"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Copy,
  Download,
  Eye,
  FileText,
  Link2,
  RefreshCw,
  Signature,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatRelative } from "@/utils/format";
import { Button, Modal, useToast } from "@/components/ui";

type ShareLinkItem = {
  id: string;
  kind: "work_diary" | "delivery_note" | string;
  documentNumber: string;
  status: "active" | "used" | "revoked" | "expired";
  createdAt: string;
  usedAt: string | null;
  expiresAt: string | null;
  projectName: string | null;
  documentUrl: string;
  pdfUrl: string | null;
  downloadUrl: string | null;
  signatureDetailsUrl: string | null;
  signUrl: string | null;
  canCopy: boolean;
  signerName: string | null;
  signedAt: string | null;
};

const KIND: Record<string, string> = {
  work_diary: "יומן עבודה",
  delivery_note: "תעודת משלוח",
  measurement_sheet: "דף מדידה",
};

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "ממתין לחתימה", cls: "bg-amber-100 text-amber-900" },
  used: { label: "נחתם", cls: "bg-emerald-100 text-emerald-900" },
  revoked: { label: "בוטל", cls: "bg-slate-100 text-slate-600" },
  expired: { label: "פג תוקף", cls: "bg-red-100 text-red-800" },
};

/** Existing signatures tracker, reusable inside the unified document center. */
export function ProjectSignatures({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const pathname = usePathname();
  const documentsPath = pathname.startsWith("/system")
    ? "/system/documents"
    : pathname.startsWith("/operations")
      ? "/operations/documents"
      : "/project/documents";
  const [items, setItems] = useState<ShareLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ShareLinkItem | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    apiClient
      .get<{ items: ShareLinkItem[] }>("/api/share-links")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);

  async function copySignLink(item: ShareLinkItem) {
    if (!item.signUrl) {
      toast.error("לא ניתן לשחזר token של קישור ישן. יש ליצור קישור חדש ממסך המסמך.");
      return;
    }
    const url = new URL(item.signUrl, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast.success("הקישור הועתק");
    } catch {
      toast.error("העתקת הקישור נכשלה");
    }
  }

  async function renewSignLink(item: ShareLinkItem) {
    try {
      const created = await apiClient.post<{ url: string }>(
        `/api/share-links/${item.kind}/${item.id}/renew`,
        {}
      );
      await navigator.clipboard.writeText(created.url);
      toast.success("נוצר קישור חדש והקישור הועתק");
      setSelected(null);
      reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "יצירת הקישור נכשלה"
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-black">חתימות</h1>
            <p className="mt-1 text-sm text-slate-500">
              מי קיבל קישור · מי חתם · מי עדיין לא
            </p>
          </div>
        )}
        {embedded && (
          <p className="text-sm text-slate-500">
            מי קיבל קישור · מי חתם · מי עדיין לא
          </p>
        )}
        <button
          type="button"
          onClick={reload}
          className="rounded-xl border border-blue-200 bg-white p-2.5"
        >
          <RefreshCw className="h-5 w-5 text-blue-700" />
        </button>
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && <p className="py-10 text-center text-slate-400">טוען…</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-3xl border border-dashed border-blue-200 bg-white py-12 text-center">
          <Link2 className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">אין קישורי חתימה עדיין</p>
          <a
            href={`${documentsPath}?tab=shares`}
            className="mt-4 inline-flex min-h-12 items-center rounded-2xl bg-blue-700 px-5 text-sm font-black text-white"
          >
            מעבר ל־Share Links
          </a>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const st = STATUS[item.status] || STATUS.active;
          return (
            <article
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setSelected(item);
                }
              }}
              className="cursor-pointer rounded-2xl border border-blue-100 bg-white px-4 py-3 transition hover:border-blue-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-400">
                    {KIND[item.kind] || item.kind}
                  </p>
                  <p className="mt-1 font-black">{item.documentNumber}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.projectName ? `${item.projectName} · ` : ""}
                    נוצר {formatRelative(item.createdAt)}
                    {item.usedAt
                      ? ` · נחתם ${formatRelative(item.usedAt)}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}
                >
                  {st.label}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-2 text-xs font-bold text-blue-700">
                <span>צפייה</span>
                <span>PDF</span>
                {item.status === "active" && <span>העתק קישור</span>}
                {item.status === "used" && <span>פרטי חתימה</span>}
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.documentNumber ?? "מסמך"}
        description={
          selected
            ? `${KIND[selected.kind] || selected.kind} · ${
                STATUS[selected.status]?.label || selected.status
              }`
            : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm">
              <p>
                <span className="text-slate-500">פרויקט: </span>
                <strong>{selected.projectName || "—"}</strong>
              </p>
              {selected.signerName && (
                <p className="mt-2">
                  <span className="text-slate-500">שם החותם: </span>
                  <strong>{selected.signerName}</strong>
                </p>
              )}
              {selected.signedAt && (
                <p className="mt-2">
                  <span className="text-slate-500">נחתם: </span>
                  <strong>
                    {new Date(selected.signedAt).toLocaleString("he-IL")}
                  </strong>
                </p>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => window.open(selected.documentUrl, "_blank")}
              >
                <Eye className="h-4 w-4" />
                צפייה במסמך
              </Button>
              {selected.pdfUrl && (
                <Button
                  variant="outline"
                  onClick={() => window.open(selected.pdfUrl!, "_blank")}
                >
                  <FileText className="h-4 w-4" />
                  {selected.status === "used"
                    ? "צפייה ב־PDF החתום"
                    : "צפייה ב־PDF"}
                </Button>
              )}
              {selected.downloadUrl && (
                <Button
                  variant="outline"
                  onClick={() => window.open(selected.downloadUrl!, "_blank")}
                >
                  <Download className="h-4 w-4" />
                  {selected.status === "used"
                    ? "הורדת PDF חתום"
                    : "הורדת PDF"}
                </Button>
              )}
              {selected.status === "active" && (
                <Button
                  onClick={() =>
                    selected.canCopy
                      ? void copySignLink(selected)
                      : void renewSignLink(selected)
                  }
                >
                  <Copy className="h-4 w-4" />
                  {selected.canCopy
                    ? "העתקת קישור לחתימה"
                    : "צור קישור חתימה חדש"}
                </Button>
              )}
              {selected.status === "used" &&
                selected.signatureDetailsUrl && (
                <Button
                  onClick={() =>
                    window.open(selected.signatureDetailsUrl!, "_blank")
                  }
                >
                  <Signature className="h-4 w-4" />
                  צפייה בפרטי החתימה
                </Button>
                )}
            </div>
            {selected.status === "active" && !selected.canCopy && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                זהו קישור בפורמט ישן שה־token שלו אינו ניתן לשחזור. הקישור
                המקורי ממשיך לעבוד. יצירת קישור חדש תבטל את הקישור הפעיל הישן
                ותעתיק קישור מאובטח חדש.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
