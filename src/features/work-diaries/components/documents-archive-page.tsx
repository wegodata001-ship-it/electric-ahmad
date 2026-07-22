"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { approvalsService } from "@/features/work-diaries/services/work-diaries.service";

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  revision: "טיוטה לתיקון",
  pending_approval: "ממתין לאישור",
  in_approval: "בתהליך אישור",
  approved: "אושר",
  sent_to_client: "נשלח ללקוח",
  signed: "נחתם",
  completed: "הושלם",
  closed: "נסגר",
};

export function DocumentsArchivePage() {
  const [items, setItems] = useState<any[]>([]);
  const [documentNumber, setDocumentNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendResult, setSendResult] = useState<{ url: string; whatsappUrl: string } | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (kind !== "all") q.set("kind", kind);
      if (documentNumber) q.set("documentNumber", documentNumber);
      if (clientName) q.set("clientName", clientName);
      if (status) q.set("status", status);
      const data = await apiClient.get<{ items: any[] }>(
        `/api/documents-archive?${q.toString()}`
      );
      setItems(data.items);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendToClient(item: any) {
    try {
      const res =
        item.kind === "work_diary"
          ? await approvalsService.sendWorkDiaryToClient(item.id)
          : await approvalsService.sendDeliveryNoteToClient(item.id);
      setSendResult({ url: res.url, whatsappUrl: res.whatsappUrl });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#03142F]">ארכיון מסמכים</h1>
        <p className="text-sm text-gray-500 mt-1">יומני עבודה ותעודות משלוח</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <input
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          placeholder="מספר מסמך"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
        />
        <input
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          placeholder="לקוח"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />
        <select
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">כל הסוגים</option>
          <option value="work_diary">יומן עבודה</option>
          <option value="delivery_note">תעודת משלוח</option>
        </select>
        <select
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">כל הסטטוסים</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={load}
        className="rounded-xl bg-[#1e40af] px-4 py-2 text-sm font-semibold text-white"
      >
        סנן
      </button>

      {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
      {loading && <p className="text-sm text-gray-500">טוען…</p>}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.kind}-${item.id}`}
            className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-wrap justify-between gap-3"
          >
            <div>
              <p className="text-xs text-gray-400">
                {item.kind === "work_diary" ? "יומן עבודה" : "תעודת משלוח"}
              </p>
              <p className="font-bold">{item.documentNumber}</p>
              <p className="text-sm text-gray-600">
                {item.project?.name ?? "—"} · {item.clientName || "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {STATUS_LABEL[item.status] ?? item.status} · {item.workDate}
              </p>
            </div>
            {(item.status === "approved" || item.status === "sent_to_client") && (
              <button
                type="button"
                onClick={() => sendToClient(item)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#25D366] px-3 py-2 text-sm font-semibold text-[#128C7E]"
              >
                <MessageCircle className="h-4 w-4" />
                שלח ללקוח
              </button>
            )}
          </div>
        ))}
      </div>

      {sendResult && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 space-y-4">
            <h3 className="font-bold text-lg">קישור מאובטח ללקוח</h3>
            <p className="text-xs break-all bg-gray-50 p-3 rounded-xl">{sendResult.url}</p>
            <a
              href={sendResult.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" />
              שלח ב־WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setSendResult(null)}
              className="w-full rounded-xl border py-2.5 text-sm font-semibold"
            >
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
