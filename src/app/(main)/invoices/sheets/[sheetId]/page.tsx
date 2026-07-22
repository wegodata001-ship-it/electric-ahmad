import { MeasurementSheetEditorPage } from "@/features/partial-invoices/components/measurement-sheet-editor-page";

export default async function Page({
  params,
}: {
  params: Promise<{ sheetId: string }>;
}) {
  const { sheetId } = await params;
  return <MeasurementSheetEditorPage sheetId={sheetId} />;
}
