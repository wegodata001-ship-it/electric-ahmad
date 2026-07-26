export type MeasurementExcelColumn = {
  id: string;
  code: string;
  description: string;
  unit?: string;
  contractQuantity: number;
  invoicedQuantity: number;
  doneQuantity: number;
  remainingQuantity: number;
};

export type MeasurementExcelRow = {
  name: string;
  floor?: string | null;
  quantities: Record<string, number>;
  roomTotal: number;
};

/**
 * Builds an .xlsx matching the on-screen measurement matrix
 * (rooms × BOQ sections + room/column totals + remaining).
 */
export async function buildMeasurementSheetExcel(input: {
  title: string;
  projectName?: string;
  clientName?: string;
  address?: string;
  version?: number | string;
  statusLabel?: string;
  columns: MeasurementExcelColumn[];
  rows: MeasurementExcelRow[];
}): Promise<Blob> {
  // Lazy-load exceljs only when an export is requested (keeps it out of initial chunks).
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "מערכת חשמל הזם";
  wb.created = new Date();

  const ws = wb.addWorksheet("דף מדידה", {
    views: [{ rightToLeft: true }],
  });

  let r = 1;
  ws.getCell(r, 1).value = input.title;
  ws.getCell(r, 1).font = { bold: true, size: 14 };
  r += 1;
  ws.getCell(r, 1).value = [
    input.projectName && `פרויקט: ${input.projectName}`,
    input.clientName && `לקוח: ${input.clientName}`,
    input.address && `כתובת: ${input.address}`,
    input.version != null && `גרסה: V${input.version}`,
    input.statusLabel && `סטטוס: ${input.statusLabel}`,
  ]
    .filter(Boolean)
    .join(" · ");
  r += 2;

  // Header row 1: codes
  const headerRow = r;
  ws.getCell(r, 1).value = "חדר / יחידה";
  input.columns.forEach((col, i) => {
    const cell = ws.getCell(r, i + 2);
    cell.value = col.code;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", wrapText: true };
  });
  ws.getCell(r, input.columns.length + 2).value = "סה״כ חדר";
  ws.getCell(r, input.columns.length + 2).font = { bold: true };
  r += 1;

  // Header row 2: descriptions
  ws.getCell(r, 1).value = "סעיף";
  input.columns.forEach((col, i) => {
    const cell = ws.getCell(r, i + 2);
    cell.value = col.description;
    cell.alignment = { horizontal: "center", wrapText: true };
  });
  r += 1;

  // Header row 3: approved / done / remaining
  ws.getCell(r, 1).value = "מאושר / בוצע / יתרה";
  input.columns.forEach((col, i) => {
    const cell = ws.getCell(r, i + 2);
    cell.value = `מאושר ${col.contractQuantity}\nבוצע ${col.doneQuantity}\nיתרה ${col.remainingQuantity}${col.unit ? ` ${col.unit}` : ""}`;
    cell.alignment = { horizontal: "center", wrapText: true, vertical: "top" };
    if (col.remainingQuantity > 0) {
      cell.font = { color: { argb: "FFDC2626" }, bold: true };
    } else {
      cell.font = { color: { argb: "FF059669" }, bold: true };
    }
  });
  r += 1;

  const dataStart = r;
  for (const row of input.rows) {
    ws.getCell(r, 1).value = row.floor
      ? `${row.name} (קומה ${row.floor})`
      : row.name;
    input.columns.forEach((col, i) => {
      ws.getCell(r, i + 2).value = row.quantities[col.id] ?? 0;
      ws.getCell(r, i + 2).alignment = { horizontal: "center" };
    });
    ws.getCell(r, input.columns.length + 2).value = row.roomTotal;
    ws.getCell(r, input.columns.length + 2).font = { bold: true };
    r += 1;
  }

  // Totals footer
  ws.getCell(r, 1).value = "סה״כ שבוצע";
  ws.getCell(r, 1).font = { bold: true };
  input.columns.forEach((col, i) => {
    const cell = ws.getCell(r, i + 2);
    cell.value = col.doneQuantity;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center" };
  });
  r += 1;
  ws.getCell(r, 1).value = "יתרה";
  ws.getCell(r, 1).font = { bold: true };
  input.columns.forEach((col, i) => {
    const cell = ws.getCell(r, i + 2);
    cell.value = col.remainingQuantity;
    cell.font = {
      bold: true,
      color: {
        argb: col.remainingQuantity > 0 ? "FFDC2626" : "FF059669",
      },
    };
    cell.alignment = { horizontal: "center" };
  });

  ws.getColumn(1).width = 28;
  input.columns.forEach((_, i) => {
    ws.getColumn(i + 2).width = 16;
  });
  ws.getColumn(input.columns.length + 2).width = 12;

  // Style header block
  for (let hr = headerRow; hr < dataStart; hr++) {
    for (let c = 1; c <= input.columns.length + 2; c++) {
      const cell = ws.getCell(hr, c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
