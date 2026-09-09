import "dotenv/config";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/prisma";
import { MeasurementSheetsRepository } from "../src/repositories/measurement-sheets.repository";
import {
  calculateMeasurementQuantity,
  hasMeasurementData,
} from "../src/lib/measurement/quantities";
import { buildMeasurementSheetExcel } from "../src/lib/measurement/export-excel";
import { MeasurementTemplate } from "../src/lib/pdf-engine/templates/measurement";

const results: Record<string, boolean> = {};
let sheetId: string | null = null;

function check(name: string, condition: unknown): asserts condition {
  results[name] = Boolean(condition);
  if (!condition) throw new Error(`${name}: FAIL`);
}

function assertPresent<T>(
  value: T,
  message: string
): asserts value is NonNullable<T> {
  if (value == null) throw new Error(message);
}

async function main() {
  const actor = await prisma.user.findFirst({
    where: { status: "ACTIVE", role: "SYSTEM_MANAGER" },
    select: { id: true },
  });
  if (!actor) throw new Error("Active SYSTEM_MANAGER required");
  await prisma.notification.deleteMany({
    where: {
      message: { contains: "מדידת עבודות חשמל – בניין A" },
      createdAt: { gte: new Date("2026-09-09T12:15:00Z") },
    },
  });

  const project = await prisma.project.findFirst({
    where: {
      deletedAt: null,
      boqItems: { some: { deletedAt: null } },
    },
    select: {
      id: true,
      boqItems: {
        where: { deletedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!project?.boqItems[0]) throw new Error("Project with BOQ required");
  const boqItemId = project.boqItems[0].id;

  const created = await MeasurementSheetsRepository.create(
    {
      projectId: project.id,
      title: `QA Measurement ${Date.now()}`,
      rowNames: ["שורה בסיסית"],
      boqItemIds: [boqItemId],
    },
    actor.id
  );
  if (!created) throw new Error("Sheet creation failed");
  sheetId = created.id;

  const afterAdd = await MeasurementSheetsRepository.addRows(
    created.id,
    ["שורה חדשה"],
    actor.id
  );
  const added = afterAdd?.rows.find((row: any) => row.name === "שורה חדשה");
  check("ADD ROW", added);

  const afterRename = await MeasurementSheetsRepository.renameRow(
    created.id,
    added.id,
    "אזור A",
    actor.id
  );
  check(
    "RENAME ROW",
    afterRename?.rows.some(
      (row: any) => row.id === added.id && row.name === "אזור A"
    )
  );

  await MeasurementSheetsRepository.deleteRow(created.id, added.id, actor.id);
  const afterEmptyDelete = await MeasurementSheetsRepository.getById(created.id);
  check(
    "DELETE EMPTY ROW",
    !afterEmptyDelete?.rows.some((row: any) => row.id === added.id)
  );

  const withData = await MeasurementSheetsRepository.addRows(
    created.id,
    ["שורה עם נתונים"],
    actor.id
  );
  const dataRow = withData?.rows.find(
    (row: any) => row.name === "שורה עם נתונים"
  );
  assertPresent(dataRow, "Data row was not created");
  await MeasurementSheetsRepository.setCellQuantity(
    created.id,
    { rowId: dataRow.id, boqItemId, quantity: 12.5 },
    actor.id
  );
  check("DELETE ROW WITH DATA WARNING", hasMeasurementData([0, 12.5]));
  await MeasurementSheetsRepository.deleteRow(created.id, dataRow.id, actor.id);
  const deletionEvent = await prisma.measurementSheetEvent.findFirst({
    where: { sheetId: created.id, type: "row_deleted" },
    orderBy: { createdAt: "desc" },
  });
  const deletionMeta = JSON.parse(deletionEvent?.metadata || "{}");
  check(
    "ROW DELETE AUDIT",
    deletionMeta.rowId === dataRow.id &&
      deletionMeta.hadMeasurements === true &&
      deletionMeta.quantities?.[0]?.quantity === 12.5
  );

  const titled = await MeasurementSheetsRepository.updateMeta(
    created.id,
    { title: "מדידת עבודות חשמל – בניין A" },
    actor.id
  );
  check(
    "EDIT MEASUREMENT TITLE",
    titled?.title === "מדידת עבודות חשמל – בניין A"
  );

  const protectedSheet = await MeasurementSheetsRepository.addRows(
    created.id,
    ["שורה מוגנת"],
    actor.id
  );
  const protectedRow = protectedSheet?.rows.find(
    (row: any) => row.name === "שורה מוגנת"
  );
  assertPresent(protectedRow, "Protected row was not created");
  await MeasurementSheetsRepository.setCellQuantity(
    created.id,
    { rowId: protectedRow.id, boqItemId, quantity: 300 },
    actor.id
  );

  const m250 = calculateMeasurementQuantity({
    contractQuantity: 280,
    currentQuantity: 250,
  });
  const m280 = calculateMeasurementQuantity({
    contractQuantity: 280,
    currentQuantity: 280,
  });
  const m300 = calculateMeasurementQuantity({
    contractQuantity: 280,
    currentQuantity: 300,
  });
  const previous = calculateMeasurementQuantity({
    contractQuantity: 280,
    previousApprovedQuantity: 250,
    currentQuantity: 50,
  });
  check("CONTRACT 280 EXECUTED 250 REMAINING 30", m250.remainingQuantity === 30);
  check("CONTRACT 280 EXECUTED 280 REMAINING 0", m280.remainingQuantity === 0);
  check("CONTRACT 280 EXECUTED 300 REMAINING -20", m300.remainingQuantity === -20);
  check(
    "PREVIOUS 250 CURRENT 50 CUMULATIVE 300 REMAINING -20",
    previous.cumulativeQuantity === 300 && previous.remainingQuantity === -20
  );
  check("OVERRUN WARNING", m300.isOverrun && m300.overrunQuantity === 20);

  await MeasurementSheetsRepository.submitForApproval(
    created.id,
    [actor.id],
    actor.id,
    "http://localhost"
  );
  const submitted = await MeasurementSheetsRepository.getById(created.id);
  check("SEND FOR APPROVAL WITH OVERRUN", submitted?.status === "pending_approval");
  check(
    "APPROVER SEES OVERRUN",
    calculateMeasurementQuantity({
      contractQuantity: 280,
      currentQuantity: 300,
    }).isOverrun
  );

  await prisma.measurementSheet.update({
    where: { id: created.id },
    data: { status: "approved", approvedAt: new Date() },
  });
  let protectedDeleteRejected = false;
  try {
    await MeasurementSheetsRepository.deleteRow(
      created.id,
      protectedRow.id,
      actor.id
    );
  } catch {
    protectedDeleteRejected = true;
  }
  const protectedStillExists = await prisma.measurementSheetRow.findUnique({
    where: { id: protectedRow.id },
  });
  check(
    "APPROVED HISTORY PRESERVED",
    protectedDeleteRejected && protectedStillExists
  );

  const exportInput = {
    title: "QA overrun",
    columns: [
      {
        id: "b1",
        code: "1",
        description: "כבלים",
        unit: "מ׳",
        contractQuantity: 280,
        invoicedQuantity: 0,
        previousApprovedQuantity: 250,
        currentQuantity: 50,
        doneQuantity: 300,
        remainingQuantity: -20,
      },
    ],
    rows: [
      {
        name: "אזור A",
        quantities: { b1: 50 },
        roomTotal: 50,
      },
    ],
  };
  const excelBlob = await buildMeasurementSheetExcel(exportInput);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await excelBlob.arrayBuffer());
  const excelText: string[] = [];
  workbook.worksheets[0]?.eachRow((row) =>
    row.eachCell((cell) => excelText.push(String(cell.value ?? "")))
  );
  check(
    "EXCEL MATCHES",
    excelText.some((value) => value.includes("יתרה -20")) &&
      excelText.includes("-20")
  );

  const pdfHtml = renderToStaticMarkup(
    <MeasurementTemplate
      model={{
        title: "QA overrun",
        rooms: [{ id: "r1", name: "אזור A" }],
        sections: [
          {
            id: "b1",
            code: "1",
            description: "כבלים",
            unit: "מ׳",
            contractQuantity: 280,
            previousApprovedQuantity: 250,
          },
        ],
        qty: () => 50,
      }}
    />
  );
  check(
    "PDF MATCHES",
    pdfHtml.includes("-20") && pdfHtml.includes("חריגה מכמות חוזה")
  );
}

main()
  .then(() => {
    for (const [name, passed] of Object.entries(results)) {
      console.log(`${name}: ${passed ? "PASS" : "FAIL"}`);
    }
  })
  .finally(async () => {
    if (sheetId) {
      await prisma.notification.deleteMany({
        where: { link: { contains: sheetId } },
      });
      await prisma.measurementSheet.delete({ where: { id: sheetId } }).catch(() => {});
    }
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
