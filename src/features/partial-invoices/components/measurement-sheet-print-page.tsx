"use client";

import { useEffect, useState, Suspense } from "react";
import { invoicesWorkspaceService } from "@/features/partial-invoices/services/invoices-workspace.service";
import {
  MeasurementTemplate,
  PdfPrintShell,
} from "@/lib/pdf-engine";

/** Thin loader — measurement PDF via central engine */
export function MeasurementSheetPrintPage({ sheetId }: { sheetId: string }) {
  return (
    <Suspense
      fallback={
        <p className="p-10 text-center text-sm text-gray-400" dir="rtl">
          טוען דף מדידה…
        </p>
      }
    >
      <MeasurementSheetPrintInner sheetId={sheetId} />
    </Suspense>
  );
}

function MeasurementSheetPrintInner({ sheetId }: { sheetId: string }) {
  const [sheet, setSheet] = useState<any>(null);

  useEffect(() => {
    invoicesWorkspaceService.getSheet(sheetId).then(setSheet);
  }, [sheetId]);

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
    <PdfPrintShell title="דף מדידה" pageSize="A4-landscape">
      <MeasurementTemplate
        model={{
          title: sheet.title,
          projectName: sheet.project?.name,
          contractor: sheet.project?.contractor,
          version: sheet.currentVersion,
          rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
          sections: sections.map((s) => ({
            id: s.id,
            code: s.code,
            description: s.description,
            unit: s.unit,
            contractQuantity: s.contractQuantity,
            invoicedQuantity: s.invoicedQuantity,
          })),
          qty,
          clientSignedAt: sheet.clientSignedAt,
          clientSignedName: sheet.clientSignedName,
          clientSignatureUrl: sheet.clientSignatureUrl,
        }}
      />
    </PdfPrintShell>
  );
}
