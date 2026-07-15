"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { reportService } from "@/features/reports/services/report.service";
import type { DailyReport, DailyReportStatus } from "@/types";
import { Badge, Button, Card, Modal, Input } from "@/components/ui";
import { formatDate, formatNumber } from "@/utils/format";
import {
  Eye,
  Printer,
  Download,
  MessageSquare,
  CheckCircle2,
  Send,
} from "lucide-react";

const STATUS_LABEL: Record<DailyReportStatus, string> = {
  submitted: "נשלח",
  approved: "מאושר",
  rejected: "נדחה",
  archived: "בארכיון",
};

export function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const foremanFilter = searchParams.get("foremanId");
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [notesFor, setNotesFor] = useState<DailyReport | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const req = foremanFilter
      ? reportService.getByForeman(foremanFilter)
      : reportService.getAll();
    req.then(setReports).finally(() => setLoading(false));
  }, [foremanFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toDateString();
  const filtered =
    filter === "today"
      ? reports.filter((r) => new Date(r.submittedAt).toDateString() === today)
      : filter === "week"
        ? reports.filter((r) => {
            const d = new Date(r.submittedAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return d > weekAgo;
          })
        : reports;

  async function approve(id: string) {
    await reportService.approve(id);
    load();
  }

  async function saveNotes() {
    if (!notesFor) return;
    setSavingNotes(true);
    try {
      await reportService.update(notesFor.id, { officeNotes: notesText });
      setNotesFor(null);
      load();
    } finally {
      setSavingNotes(false);
    }
  }

  function openPrint(id: string, download?: boolean) {
    const q = download ? "?download=1" : "";
    window.open(`/print/reports/${id}${q}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">דיווחים</h1>
        <p className="text-sm text-gray-500 mt-1">
          דיווחים יומיים ממנהלי עבודה · {filtered.length} דיווחים
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { id: "all", label: "הכל" },
          { id: "today", label: "היום" },
          { id: "week", label: "שבוע אחרון" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f.id
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead className="bg-gray-50/80 text-xs text-gray-500">
              <tr>
                <th className="text-right px-4 py-3 font-medium">תאריך</th>
                <th className="text-right px-4 py-3 font-medium">פרויקט</th>
                <th className="text-right px-4 py-3 font-medium">מנהל עבודה</th>
                <th className="text-right px-4 py-3 font-medium">עובדים</th>
                <th className="text-right px-4 py-3 font-medium">שעות</th>
                <th className="text-right px-4 py-3 font-medium">סטטוס</th>
                <th className="text-right px-4 py-3 font-medium">זמן שליחה</th>
                <th className="text-right px-4 py-3 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.projectName}</p>
                    <p className="text-xs text-gray-400">{r.clientName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{r.foremanName}</p>
                    <p className="text-xs text-gray-400" dir="ltr">
                      {r.foremanPhone}
                    </p>
                  </td>
                  <td className="px-4 py-3">{r.workersCount}</td>
                  <td className="px-4 py-3">
                    {formatNumber(r.totalHours, 1)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        r.status === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : r.status === "rejected"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-800"
                      }
                    >
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(r.submittedAt).toLocaleString("he-IL")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <IconBtn
                        title="צפייה"
                        onClick={() => router.push(`/reports/${r.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn title="הדפסה" onClick={() => openPrint(r.id)}>
                        <Printer className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        title="הורדת PDF"
                        onClick={() => openPrint(r.id, true)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        title="הערות"
                        onClick={() => {
                          setNotesFor(r);
                          setNotesText(r.officeNotes || "");
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </IconBtn>
                      {r.status !== "approved" && (
                        <IconBtn title="אישור" onClick={() => approve(r.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        </IconBtn>
                      )}
                      <IconBtn title="שליחה ללקוח (בקרוב)" disabled>
                        <Send className="h-3.5 w-3.5" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">אין דיווחים להצגה</p>
            <p className="text-xs text-gray-400 mt-1">
              כשמנהל עבודה שולח יומן עבודה — הדיווח יופיע כאן אוטומטית
            </p>
          </div>
        )}
        {loading && (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">טוען...</p>
        )}
      </Card>

      <Modal
        open={Boolean(notesFor)}
        onClose={() => setNotesFor(null)}
        title="הערות משרד"
        description={
          notesFor
            ? `${notesFor.projectName} · ${notesFor.foremanName}`
            : undefined
        }
      >
        <div className="space-y-3">
          <Input
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="הערות פנימיות לדיווח..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNotesFor(null)}>
              ביטול
            </Button>
            <Button onClick={saveNotes} loading={savingNotes}>
              שמור
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-white hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
