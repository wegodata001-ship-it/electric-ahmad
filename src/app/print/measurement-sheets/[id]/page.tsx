import { Suspense } from "react";
import { MeasurementSheetPrintPage } from "@/features/partial-invoices/components/measurement-sheet-print-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="p-8 text-sm text-gray-400">טוען...</p>}>
      <MeasurementSheetPrintPage sheetId={id} />
    </Suspense>
  );
}
