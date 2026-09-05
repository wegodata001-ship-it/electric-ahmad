"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { approvalsService } from "@/features/work-diaries/services/work-diaries.service";
import { SendClientLinkModal } from "@/features/signatures/send-client-link-modal";
import { fetchClientMe } from "@/lib/auth/client-me";
import { hasDocumentPermission } from "@/lib/auth/document-permissions";
import { SIGNED_STATUS_LABEL } from "@/lib/signatures";

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  revision: "נדחה",
  pending_approval: "נשלח לאישור",
  in_approval: "בתהליך אישור",
  approved: "מאושר",
  sent_to_client: "נשלח ללקוח",
  signed: SIGNED_STATUS_LABEL,
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
  const [canSend, setCanSend] = useState(false);
  const [sendResult, setSendResult] = useState<{
    url: string;
    documentNumber: string;
    kind: "delivery_note" | "work_diary";
  } | null>(null);

  useEffect(() => {
    fetchClientMe("/api/auth/me")
      .then((json) => {
        if (json.success) {
          setCanSend(
            hasDocumentPermission(json.data?.role as string, "send_to_client")
          );
        }
      })
      .catch(() => setCanSend(false));
  }, []);

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
      setSendResult({
        url: res.url,
        documentNumber: item.documentNumber,
        kind: item.kind === "work_diary" ? "work_diary" : "delivery_note",
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#03142F]">ארכיון מסמכים</h1>
        <p className="text-sm text-gray-500 mt-1">
          יומני עבודה ותעודות משלוח · שליחה ללקוח לחתימה דיגיטלית
        </p>
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

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}
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
            {canSend &&
              (item.status === "approved" ||
                item.status === "sent_to_client") && (
                <button
                  type="button"
                  onClick={() => void sendToClient(item)}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
                >
                  <Link2 className="h-4 w-4" />
                  שלח ללקוח
                </button>
              )}
          </div>
        ))}
      </div>

      <SendClientLinkModal
        open={!!sendResult}
        onClose={() => setSendResult(null)}
        url={sendResult?.url || ""}
        documentNumber={sendResult?.documentNumber || ""}
        kind={sendResult?.kind || "delivery_note"}
      />
    </div>
  );
}
