"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deliveryNoteService } from "@/features/delivery-notes/services/delivery-note.service";
import type { DeliveryNote, DeliveryNoteVersion } from "@/types";
import { Badge, Button, Card, Tabs } from "@/components/ui";
import { formatDate, formatNumber } from "@/utils/format";
import {
  ArrowRight,
  Download,
  Printer,
  Send,
  Paperclip,
  FileText,
  Pencil,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  issued: "הונפקה",
  in_transit: "בדרך",
  delivered: "נמסרה",
  cancelled: "בוטלה",
};

export function DeliveryNoteDetailPage({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [note, setNote] = useState<DeliveryNote | null>(null);
  const [versions, setVersions] = useState<DeliveryNoteVersion[]>([]);
  const [tab, setTab] = useState("details");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function reload() {
    deliveryNoteService
      .getById(noteId)
      .then(setNote)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      );
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    if (tab === "history") {
      deliveryNoteService
        .getVersions(noteId)
        .then(setVersions)
        .catch(() => setVersions([]));
    }
  }, [tab, noteId]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const attachment = await deliveryNoteService.uploadAttachment(
        noteId,
        file
      );
      setNote((prev) =>
        prev
          ? { ...prev, attachments: [...(prev.attachments ?? []), attachment] }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאה");
    } finally {
      setUploading(false);
    }
  }

  if (error && !note) {
    return (
      <Card padding="lg">
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  if (!note) {
    return <p className="text-sm text-gray-400">טוען תעודה...</p>;
  }

  const printUrl = `/print/delivery-notes/${note.id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => router.push("/delivery-notes")}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה לתעודות משלוח
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              {note.noteNumber}
            </h1>
            <Badge className="bg-primary-50 text-primary-700 border-primary-200">
              {STATUS_LABELS[note.status] ?? note.status}
            </Badge>
            <Badge className="bg-gray-100 text-gray-600">
              גרסה {note.currentVersion ?? 1}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {note.client} · {formatDate(note.date)}
            {note.departureTime ? ` · ${note.departureTime}` : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => router.push(`/delivery-notes/${note.id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            עריכת תעודת משלוח
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.open(printUrl, "_blank")}
          >
            צפייה / PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.open(printUrl, "_blank")}
          >
            <Printer className="h-4 w-4" />
            הדפסה
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.open(`${printUrl}?download=1`, "_blank")}
          >
            <Download className="h-4 w-4" />
            הורדה
          </Button>
          <Button
            variant="outline"
            disabled
            title="שליחה במייל / WhatsApp בעתיד"
          >
            <Send className="h-4 w-4" />
            שליחה
          </Button>
        </div>
      </div>

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: "details", label: "פרטי התעודה" },
          {
            id: "history",
            label: "היסטוריית שינויים",
            count: versions.length || undefined,
          },
        ]}
      />

      {tab === "details" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card padding="md">
              <p className="text-xs text-gray-500">איש קשר</p>
              <p className="text-sm font-medium mt-1">
                {note.contactName || "—"}
              </p>
            </Card>
            <Card padding="md">
              <p className="text-xs text-gray-500">טלפון</p>
              <p className="text-sm font-medium mt-1" dir="ltr">
                {note.phone || "—"}
              </p>
            </Card>
            <Card padding="md">
              <p className="text-xs text-gray-500">פרויקט</p>
              <p className="text-sm font-medium mt-1">
                {note.projectName || "—"}
              </p>
            </Card>
            <Card padding="md">
              <p className="text-xs text-gray-500">נהג / רכב</p>
              <p className="text-sm font-medium mt-1">
                {[note.driverName, note.vehicleNumber]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </Card>
          </div>

          <Card padding="none">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">פריטים</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50/80 text-xs text-gray-500">
                  <tr>
                    <th className="text-right px-4 py-3">#</th>
                    <th className="text-right px-4 py-3">מק״ט</th>
                    <th className="text-right px-4 py-3">תיאור</th>
                    <th className="text-right px-4 py-3">יחידה</th>
                    <th className="text-right px-4 py-3">כמות</th>
                    <th className="text-right px-4 py-3">ארגז</th>
                    <th className="text-right px-4 py-3">הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {note.items.map((item, index) => (
                    <tr key={item.id} className="border-t border-gray-50">
                      <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {item.sku || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {item.description}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                      <td className="px-4 py-3">
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="px-4 py-3">
                        {item.packageNumber || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {item.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card padding="lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">קבצים</h2>
              <label className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium border border-primary-200 text-primary-700 rounded-lg hover:bg-primary-50 cursor-pointer">
                <Paperclip className="h-3.5 w-3.5" />
                {uploading ? "מעלה..." : "הוסף קובץ"}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(file);
                  }}
                />
              </label>
            </div>
            {(note.attachments?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400">אין קבצים מצורפים</p>
            ) : (
              <div className="space-y-2">
                {note.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-primary-700 hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {a.name}
                  </a>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {tab === "history" && (
        <Card padding="lg">
          <h2 className="text-base font-semibold mb-4">היסטוריית שינויים</h2>
          {versions.length === 0 ? (
            <p className="text-sm text-gray-400">אין היסטוריה עדיין</p>
          ) : (
            <div className="space-y-4">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="border border-gray-100 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <p className="font-semibold text-gray-900">
                      גרסה {v.version}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(v.createdAt).toLocaleString("he-IL")} ·{" "}
                      {v.editedByName}
                    </p>
                  </div>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {v.changes.map((c, i) => (
                      <li key={i}>
                        <span className="text-gray-500">{c.label}: </span>
                        {c.from && c.to ? (
                          <>
                            <span className="line-through text-gray-400">
                              {c.from}
                            </span>
                            {" → "}
                            <span className="font-medium">{c.to}</span>
                          </>
                        ) : (
                          <span>{c.to || c.from}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
