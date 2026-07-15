"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { reportService } from "@/features/reports/services/report.service";
import type { DailyReport } from "@/types";
import { formatDate, formatNumber } from "@/utils/format";
import { COMPANY_PROFILE } from "@/config/company";

export function ReportPrintPage({ reportId }: { reportId: string }) {
  const searchParams = useSearchParams();
  const [report, setReport] = useState<DailyReport | null>(null);

  useEffect(() => {
    reportService.getById(reportId).then((data) => {
      setReport(data);
      window.setTimeout(() => {
        if (searchParams.get("download") || searchParams.get("autoprint")) {
          window.print();
        }
      }, 400);
    });
  }, [reportId, searchParams]);

  if (!report) {
    return (
      <div className="p-10 text-center text-sm text-gray-400" dir="rtl">
        טוען דיווח...
      </div>
    );
  }

  const blue = COMPANY_PROFILE.brandBlue;

  return (
    <div className="min-h-screen bg-[#eef1f5] print:bg-white" dir="rtl">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white border-b px-4 py-3 flex gap-2 justify-end">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm text-white rounded-lg"
          style={{ background: blue }}
        >
          הדפסה / PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 text-sm border rounded-lg bg-white"
        >
          סגור
        </button>
      </div>

      <div className="max-w-[210mm] mx-auto my-6 bg-white shadow-lg print:shadow-none print:my-0 px-8 py-7 text-[12px]">
        <header
          className="flex justify-between gap-4 pb-4 mb-4"
          style={{ borderBottom: `2px solid ${blue}` }}
        >
          <div>
            <p className="text-[16px] font-bold" style={{ color: blue }}>
              {COMPANY_PROFILE.name}
            </p>
            <p>{COMPANY_PROFILE.address}</p>
            <p dir="ltr">{COMPANY_PROFILE.phone}</p>
          </div>
          <div className="text-left">
            <p className="text-[20px] font-bold" style={{ color: blue }}>
              דיווח יומי
            </p>
            <p>תאריך: {formatDate(report.date)}</p>
            <p>
              נשלח: {new Date(report.submittedAt).toLocaleString("he-IL")}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-bold mb-1">מנהל עבודה</p>
            <p>{report.foremanName}</p>
            <p dir="ltr">{report.foremanPhone}</p>
          </div>
          <div>
            <p className="font-bold mb-1">פרויקט</p>
            <p>{report.projectName}</p>
            <p>{report.clientName}</p>
            <p>{report.address}</p>
          </div>
        </section>

        <section className="mb-4">
          <p className="font-bold mb-1">זמנים</p>
          <p>
            {report.startTime || "—"} – {report.endTime || "—"} ·{" "}
            {formatNumber(report.totalHours, 1)} שעות
          </p>
        </section>

        {report.actionsPerformed && (
          <section className="mb-4">
            <p className="font-bold mb-1">עבודות שבוצעו</p>
            <p className="whitespace-pre-wrap">{report.actionsPerformed}</p>
          </section>
        )}

        <section className="mb-4">
          <p className="font-bold mb-2">עובדים</p>
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th className="border p-1.5 text-right">שם</th>
                <th className="border p-1.5 text-right">כניסה</th>
                <th className="border p-1.5 text-right">יציאה</th>
                <th className="border p-1.5 text-right">שעות</th>
                <th className="border p-1.5 text-right">הערות</th>
              </tr>
            </thead>
            <tbody>
              {report.workers.map((w) => (
                <tr key={w.id}>
                  <td className="border p-1.5">{w.name}</td>
                  <td className="border p-1.5">{w.startTime || "—"}</td>
                  <td className="border p-1.5">{w.endTime || "—"}</td>
                  <td className="border p-1.5">
                    {formatNumber(w.totalHours, 1)}
                  </td>
                  <td className="border p-1.5">{w.note || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {report.notes && (
          <section className="mb-4">
            <p className="font-bold mb-1">הערות מנהל עבודה</p>
            <p className="whitespace-pre-wrap">{report.notes}</p>
          </section>
        )}

        <footer className="pt-3 text-[10px] text-gray-500 border-t">
          {COMPANY_PROFILE.name} · דיווח {report.id.slice(0, 8)}
        </footer>
      </div>
    </div>
  );
}
