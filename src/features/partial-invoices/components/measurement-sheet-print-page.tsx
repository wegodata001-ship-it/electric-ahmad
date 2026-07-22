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
          </div>
        </header>

        <div className="overflow-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr style={{ background: blue, color: "#fff" }}>
                <th className="border border-gray-400 px-2 py-2 text-right sticky right-0">
                  חדר / יחידה
                </th>
                {sections.map((s) => (
                  <th
                    key={s.id}
                    className="border border-gray-400 px-1 py-2 text-center min-w-[56px] max-w-[90px]"
                  >
                    <div className="font-mono text-[9px] opacity-90">{s.code}</div>
                    <div className="line-clamp-2 leading-tight">{s.description}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room, i) => (
                <tr
                  key={room.id}
                  style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                >
                  <td className="border border-gray-300 px-2 py-1.5 font-semibold sticky right-0 bg-inherit">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
