"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { invoicesWorkspaceService } from "@/features/partial-invoices/services/invoices-workspace.service";
import { formatNumber } from "@/utils/format";
import { COMPANY_PROFILE } from "@/config/company";

/** Print layout: rooms = rows, BOQ sections = columns */
export function MeasurementSheetPrintPage({ sheetId }: { sheetId: string }) {
  const searchParams = useSearchParams();
  const [sheet, setSheet] = useState<any>(null);
  const blue = COMPANY_PROFILE.brandBlue;

  useEffect(() => {
    invoicesWorkspaceService.getSheet(sheetId).then((data) => {
      setSheet(data);
      window.setTimeout(() => {
        if (searchParams.get("download") || searchParams.get("autoprint")) {
          window.print();
        }
      }, 450);
    });
  }, [sheetId, searchParams]);

  if (!sheet) {
    return (
      <div className="p-10 text-center text-sm text-gray-400" dir="rtl">
        טוען דף מדידה…
      </div>
    );
  }

  const rooms: any[] = sheet.rows ?? [];
  const boqMap = new Map<string, any>();
  for (const c of sheet.cells ?? []) {
    if (c.boqItem) boqMap.set(c.boqItemId, c.boqItem);
  }
  const sections = [...boqMap.values()].sort((a, b) =>
    String(a.code).localeCompare(String(b.code), "he")
  );

  const qty = (rowId: string, boqId: string) => {
    const cell = (sheet.cells ?? []).find(
      (c: any) => c.rowId === rowId && c.boqItemId === boqId
    );
    return Number(cell?.quantity ?? 0);
  };

  const sectionTotal = (boqId: string) =>
    rooms.reduce((s: number, room: any) => s + qty(room.id, boqId), 0);

  const sectionRemain = (s: any) => {
    const contract = Number(s.contractQuantity) || 0;
    const invoiced = Number(s.invoicedQuantity) || 0;
    return Math.max(0, contract - invoiced - sectionTotal(s.id));
  };

  return (
    <div className="ms-doc min-h-screen bg-[#eef1f5] print:bg-white" dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap');
        .ms-doc { font-family: 'Assistant', Arial, sans-serif; }
        @page { size: A4 landscape; margin: 8mm; }
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex justify-end gap-2 border-b border-gray-200 bg-white/95 px-4 py-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg px-4 py-2 text-sm text-white"
          style={{ background: blue }}
        >
          הדפסה / שמירה כ-PDF
        </button>
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm"
        >
          סגור
        </button>
      </div>

      <div className="mx-auto my-4 max-w-[297mm] bg-white p-6 shadow print:my-0 print:shadow-none">
        <header
          className="mb-4 flex justify-between gap-4 pb-3"
          style={{ borderBottom: `2px solid ${blue}` }}
        >
          <div>
            <p className="text-lg font-bold" style={{ color: blue }}>
              {COMPANY_PROFILE.name}
            </p>
            <p className="text-sm text-gray-600">דף מדידה</p>
          </div>
          <div className="text-left text-sm">
            <p className="font-bold text-gray-900">{sheet.title}</p>
            {sheet.project?.name && (
              <p className="text-gray-600">פרויקט: {sheet.project.name}</p>
            )}
            {sheet.project?.contractor && (
              <p className="text-gray-600">לקוח: {sheet.project.contractor}</p>
            )}
            {sheet.currentVersion != null && (
              <p className="text-gray-600">גרסה: V{sheet.currentVersion}</p>
            )}
          </div>
        </header>

        <div className="overflow-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr style={{ background: blue, color: "#fff" }}>
                <th className="sticky right-0 border border-gray-400 px-2 py-2 text-right">
                  חדר / יחידה
                </th>
                {sections.map((s) => (
                  <th
                    key={s.id}
                    className="min-w-[56px] max-w-[90px] border border-gray-400 px-1 py-2 text-center"
                  >
                    <div className="font-mono text-[9px] opacity-90">{s.code}</div>
                    <div className="line-clamp-2 leading-tight">{s.description}</div>
                    <div className="mt-0.5 text-[8px] opacity-90">
                      מאושר {formatNumber(Number(s.contractQuantity) || 0)}
                    </div>
                  </th>
                ))}
                <th className="border border-gray-400 px-2 py-2 text-center">
                  סה״כ חדר
                </th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room, i) => {
                const roomSum = sections.reduce(
                  (acc, s) => acc + qty(room.id, s.id),
                  0
                );
                return (
                  <tr
                    key={room.id}
                    style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                  >
                    <td className="sticky right-0 border border-gray-300 bg-inherit px-2 py-1.5 font-semibold">
                      {room.name}
                    </td>
                    {sections.map((s) => (
                      <td
                        key={s.id}
                        className="border border-gray-300 px-1 py-1.5 text-center"
                      >
                        {formatNumber(qty(room.id, s.id)) || ""}
                      </td>
                    ))}
                    <td className="border border-gray-300 px-1 py-1.5 text-center font-bold">
                      {formatNumber(roomSum) || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td className="sticky right-0 border border-gray-400 bg-gray-100 px-2 py-1.5">
                  סה״כ שבוצע
                </td>
                {sections.map((s) => (
                  <td
                    key={`t-${s.id}`}
                    className="border border-gray-400 px-1 py-1.5 text-center"
                  >
                    {formatNumber(sectionTotal(s.id))}
                  </td>
                ))}
                <td className="border border-gray-400 px-1 py-1.5 text-center">
                  {formatNumber(
                    rooms.reduce(
                      (acc: number, room: any) =>
                        acc +
                        sections.reduce(
                          (a, s) => a + qty(room.id, s.id),
                          0
                        ),
                      0
                    )
                  )}
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="sticky right-0 border border-gray-400 bg-gray-50 px-2 py-1.5 font-bold">
                  יתרה
                </td>
                {sections.map((s) => {
                  const rem = sectionRemain(s);
                  return (
                    <td
                      key={`r-${s.id}`}
                      className="border border-gray-400 px-1 py-1.5 text-center font-bold"
                      style={{ color: rem > 0 ? "#dc2626" : "#059669" }}
                    >
                      {formatNumber(rem)}
                    </td>
                  );
                })}
                <td className="border border-gray-400" />
              </tr>
            </tfoot>
          </table>
        </div>

        {sheet.clientSignedAt && (
          <section
            className="mt-6 rounded-xl border-2 p-4"
            style={{ borderColor: blue }}
          >
            <p className="mb-2 text-sm font-bold" style={{ color: blue }}>
              חתימת לקוח
            </p>
            <p className="text-sm">
              שם: <strong>{sheet.clientSignedName || "—"}</strong>
            </p>
            <p className="text-sm text-gray-600">
              תאריך:{" "}
              {new Date(sheet.clientSignedAt).toLocaleString("he-IL")}
            </p>
            {sheet.clientSignatureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sheet.clientSignatureUrl}
                alt="חתימה"
                className="mt-3 h-20 max-w-xs object-contain bg-white border rounded"
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
}
