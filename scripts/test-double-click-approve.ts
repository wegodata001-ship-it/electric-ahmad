import { prisma } from "../src/lib/prisma";
import { MeasurementSheetsRepository } from "../src/repositories/measurement-sheets.repository";

async function main() {
  const sheet = await prisma.measurementSheet.findFirst({
    where: { status: "draft" },
    select: { id: true, createdById: true },
  });
  if (!sheet) throw new Error("no draft");
  const approver = await prisma.user.findFirst({
    where: { role: "SYSTEM_MANAGER", status: "ACTIVE" },
    select: { id: true },
  });
  if (!approver) throw new Error("no approver");
  const schedule = (t: () => Promise<void>) => {
    void t().catch(() => {});
  };

  await MeasurementSheetsRepository.submitForApproval(
    sheet.id,
    [approver.id],
    sheet.createdById,
    undefined,
    schedule
  );

  const beforeApprovedEvents = await prisma.measurementSheetEvent.count({
    where: { sheetId: sheet.id, type: "approved" },
  });

  const [a, b] = await Promise.allSettled([
    MeasurementSheetsRepository.decideApproval(
      sheet.id,
      approver.id,
      "approved",
      "d1",
      "note",
      undefined,
      undefined,
      schedule
    ),
    MeasurementSheetsRepository.decideApproval(
      sheet.id,
      approver.id,
      "approved",
      "d2",
      "note",
      undefined,
      undefined,
      schedule
    ),
  ]);

  const approvals = await prisma.measurementSheetApproval.findMany({
    where: { sheetId: sheet.id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const afterApprovedEvents = await prisma.measurementSheetEvent.count({
    where: { sheetId: sheet.id, type: "approved" },
  });
  const status = await prisma.measurementSheet.findUnique({
    where: { id: sheet.id },
    select: { status: true },
  });

  console.log(
    JSON.stringify(
      {
        parallel: [a.status, b.status],
        errors: [
          a.status === "rejected"
            ? String((a as PromiseRejectedResult).reason?.message)
            : null,
          b.status === "rejected"
            ? String((b as PromiseRejectedResult).reason?.message)
            : null,
        ],
        approvedApprovalRows: approvals.filter((x) => x.status === "approved")
          .length,
        newApprovedEvents: afterApprovedEvents - beforeApprovedEvents,
        sheetStatus: status?.status,
      },
      null,
      2
    )
  );

  await prisma.measurementSheet.update({
    where: { id: sheet.id },
    data: { status: "draft", approvedAt: null },
  });
  await prisma.measurementSheetApproval.updateMany({
    where: { sheetId: sheet.id, status: "pending" },
    data: { status: "cancelled" },
  });
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
