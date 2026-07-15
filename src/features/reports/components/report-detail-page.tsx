"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { reportService } from "@/features/reports/services/report.service";
import type { DailyReport } from "@/types";
import { Badge, Button, Card, Input } from "@/components/ui";
import { formatDate, formatNumber } from "@/utils/format";
import { ArrowRight, CheckCircle2, Download, Printer } from "lucide-react";
import Image from "next/image";

export function ReportDetailPage({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    reportService
      .getById(reportId)
      .then((r) => {
        setReport(r);
        setNotes(r.officeNotes || "");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      );
  }, [reportId]);

  if (error) {
    return (
      <Card padding="lg">
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  if (!report) {
    return <p className="text-sm text-gray-400">טוען דיווח...</p>;
  }

  async function approve() {
    setSaving(true);
    try {
      const updated = await reportService.approve(reportId);
      setReport(updated);
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    setSaving(true);
    try {
      const updated = await reportService.update(reportId, {
        officeNotes: notes,
      });
      setReport(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => router.push("/reports")}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה לדיווחים
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              דיווח יומי · {formatDate(report.date)}
            </h1>
            <Badge className="bg-amber-50 text-amber-800">{report.status}</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            נשלח {new Date(report.submittedAt).toLocaleString("he-IL")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(`/print/reports/${report.id}`, "_blank")
            }
          >
            <Printer className="h-3.5 w-3.5" />
            הדפסה
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                `/print/reports/${report.id}?download=1`,
                "_blank"
              )
            }
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
          {report.status !== "approved" && (
            <Button size="sm" onClick={approve} loading={saving}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              אישור
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="lg">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            מנהל עבודה
          </h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="שם" value={report.foremanName} />
            <Row label="טלפון" value={report.foremanPhone} ltr />
            <Row label="סטטוס" value={report.foremanStatus} />
          </dl>
        </Card>
        <Card padding="lg">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">פרויקט</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="שם" value={report.projectName} />
            <Row label="לקוח" value={report.clientName} />
            <Row label="כתובת" value={report.address} />
            <Row label="תאריך" value={formatDate(report.date)} />
          </dl>
        </Card>
      </div>

      <Card padding="lg">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">יומן עבודה</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
          <Mini label="התחלה" value={report.startTime || "—"} />
          <Mini label="סיום" value={report.endTime || "—"} />
          <Mini
            label="משך"
            value={`${formatNumber(report.totalHours, 1)} ש׳`}
          />
          <Mini
            label="הסתיים"
            value={report.dayCompleted ? "כן" : "לא"}
          />
        </div>
        {report.actionsPerformed && (
          <Block title="עבודות שבוצעו" text={report.actionsPerformed} />
        )}
        {report.notes && <Block title="הערות" text={report.notes} />}
        {report.exceptions && (
          <Block title="חריגות" text={report.exceptions} />
        )}
        {report.equipment && <Block title="ציוד" text={report.equipment} />}
      </Card>

      <Card padding="lg">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">עובדים</h2>
        {report.workers.length === 0 ? (
          <p className="text-sm text-gray-400">לא תועדו עובדים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="text-right py-2">שם</th>
                  <th className="text-right py-2">כניסה</th>
                  <th className="text-right py-2">יציאה</th>
                  <th className="text-right py-2">שעות</th>
                  <th className="text-right py-2">הערות</th>
                </tr>
              </thead>
              <tbody>
                {report.workers.map((w) => (
                  <tr key={w.id} className="border-t border-gray-50">
                    <td className="py-2 font-medium">{w.name}</td>
                    <td className="py-2">{w.startTime || "—"}</td>
                    <td className="py-2">{w.endTime || "—"}</td>
                    <td className="py-2">{formatNumber(w.totalHours, 1)}</td>
                    <td className="py-2 text-gray-500">{w.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {report.photoUrls.length > 0 && (
        <Card padding="lg">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">תמונות</h2>
          <div className="flex flex-wrap gap-2">
            {report.photoUrls.map((url) => (
              <div
                key={url}
                className="relative h-24 w-24 rounded-lg overflow-hidden border border-gray-100"
              >
                <Image src={url} alt="" fill className="object-cover" unoptimized />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padding="lg">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          הערות משרד
        </h2>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הערות..."
        />
        <div className="mt-3">
          <Button size="sm" onClick={saveNotes} loading={saving}>
            שמור הערות
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 text-left" dir={ltr ? "ltr" : undefined}>
        {value || "—"}
      </dd>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs text-gray-500 mb-1">{title}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
        {text}
      </p>
    </div>
  );
}
