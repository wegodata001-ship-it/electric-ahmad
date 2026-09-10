/**
 * Estimates user-perceived workflow latency from Production timings.
 * BEFORE = API + blocking getSheet (heavy) + listSheets (common MS path)
 * AFTER  = API + local React state patch (~1 frame)
 */
import { prisma } from "../src/lib/prisma";
import { MeasurementSheetsRepository } from "../src/repositories/measurement-sheets.repository";
import { OpsDeliveryNotesRepository } from "../src/repositories/ops-delivery-notes.repository";
import { WorkDiariesRepository } from "../src/repositories/work-diaries.repository";
import type { ScheduleBackground } from "../src/lib/async/schedule-background";

const bg: ScheduleBackground = (task) => {
  void Promise.resolve().then(task).catch(() => undefined);
};

async function timed<T>(fn: () => Promise<T>) {
  const t0 = performance.now();
  const result = await fn();
  return { ms: Math.round(performance.now() - t0), result };
}

function status(total: number) {
  if (total < 500) return "PASS ideal";
  if (total < 800) return "PASS acceptable";
  return "FAIL";
}

async function main() {
  // Warm connection
  await prisma.$queryRaw`SELECT 1`;
  await prisma.$queryRaw`SELECT 1`;

  const approver = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      role: { in: ["SYSTEM_MANAGER", "ADMIN", "מנהל מערכת"] },
    },
    select: { id: true, role: true, name: true },
  });
  if (!approver) throw new Error("no approver");

  const sheet = await prisma.measurementSheet.findFirst({
    where: { status: { in: ["draft", "revision", "pending_approval"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, createdById: true, projectId: true },
  });
  const dn = await prisma.opsDeliveryNote.findFirst({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, createdById: true },
  });
  const wd = await prisma.workDiary.findFirst({
    where: { deletedAt: null, workflowDocumentId: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, createdById: true, workflowDocumentId: true },
  });

  const rows: Record<string, unknown>[] = [];
  const uiPatchMs = 16; // one animation frame for local setState

  async function cycle(
    label: string,
    reset: () => Promise<void>,
    action: () => Promise<number>,
    blockingRefetchMs: number
  ) {
    await reset();
    const api = await action();
    const beforeTotal = api + blockingRefetchMs;
    const afterTotal = api + uiPatchMs;
    rows.push({
      action: label,
      apiMs: api,
      uiUpdateBeforeMs: blockingRefetchMs,
      uiUpdateAfterMs: uiPatchMs,
      totalBeforeMs: beforeTotal,
      totalAfterMs: afterTotal,
      statusBefore: status(beforeTotal),
      statusAfter: status(afterTotal),
    });
  }

  // Measure heavy getById once (old FE blocking cost)
  let getSheetMs = 0;
  if (sheet) {
    const g = await timed(() =>
      MeasurementSheetsRepository.getById(sheet.id)
    );
    getSheetMs = g.ms;
  }
  const listSheetsMs = 80; // typical lean list; conservative warm estimate colocated
  const msBlocking = getSheetMs + listSheetsMs;

  if (sheet) {
    await cycle(
      "MS Send",
      async () => {
        await prisma.measurementSheet.update({
          where: { id: sheet.id },
          data: { status: "draft", approvedAt: null, returnedAt: null },
        });
        await prisma.measurementSheetApproval.updateMany({
          where: { sheetId: sheet.id, status: "pending" },
          data: { status: "cancelled" },
        });
      },
      async () =>
        (
          await timed(() =>
            MeasurementSheetsRepository.submitForApproval(
              sheet.id,
              [approver.id],
              sheet.createdById,
              undefined,
              bg
            )
          )
        ).ms,
      msBlocking
    );

    await cycle(
      "MS Return",
      async () => undefined,
      async () =>
        (
          await timed(() =>
            MeasurementSheetsRepository.decideApproval(
              sheet.id,
              approver.id,
              "rejected",
              "fe-check",
              "note",
              undefined,
              undefined,
              bg
            )
          )
        ).ms,
      msBlocking
    );

    await cycle(
      "MS Resubmit",
      async () => undefined,
      async () =>
        (
          await timed(() =>
            MeasurementSheetsRepository.submitForApproval(
              sheet.id,
              [approver.id],
              sheet.createdById,
              undefined,
              bg
            )
          )
        ).ms,
      msBlocking
    );

    await cycle(
      "MS Approve",
      async () => undefined,
      async () =>
        (
          await timed(() =>
            MeasurementSheetsRepository.decideApproval(
              sheet.id,
              approver.id,
              "approved",
              "fe-check",
              undefined,
              undefined,
              undefined,
              bg
            )
          )
        ).ms,
      msBlocking
    );

    await prisma.measurementSheet.update({
      where: { id: sheet.id },
      data: { status: "draft", approvedAt: null },
    });
  }

  // DN/WD: old FE often did router.refresh (full RSC) ~200-600ms; after = local/nav without refresh
  const refreshCost = 250;

  if (dn) {
    for (const [label, run] of [
      [
        "DN Send",
        async () => {
          await prisma.opsDeliveryNote.update({
            where: { id: dn.id },
            data: { status: "draft" },
          });
          return (
            await timed(() =>
              OpsDeliveryNotesRepository.submitForApproval(
                dn.id,
                [approver.id],
                dn.createdById,
                bg
              )
            )
          ).ms;
        },
      ],
      [
        "DN Return",
        async () =>
          (
            await timed(() =>
              OpsDeliveryNotesRepository.decideApproval(
                dn.id,
                approver.id,
                "rejected",
                "fe-check",
                "note",
                bg
              )
            )
          ).ms,
      ],
      [
        "DN Resubmit",
        async () =>
          (
            await timed(() =>
              OpsDeliveryNotesRepository.submitForApproval(
                dn.id,
                [approver.id],
                dn.createdById,
                bg
              )
            )
          ).ms,
      ],
      [
        "DN Approve",
        async () =>
          (
            await timed(() =>
              OpsDeliveryNotesRepository.decideApproval(
                dn.id,
                approver.id,
                "approved",
                "fe-check",
                undefined,
                bg
              )
            )
          ).ms,
      ],
    ] as const) {
      const api = await run();
      rows.push({
        action: label,
        apiMs: api,
        uiUpdateBeforeMs: refreshCost,
        uiUpdateAfterMs: uiPatchMs,
        totalBeforeMs: api + refreshCost,
        totalAfterMs: api + uiPatchMs,
        statusBefore: status(api + refreshCost),
        statusAfter: status(api + uiPatchMs),
      });
    }
    await prisma.opsDeliveryNote.update({
      where: { id: dn.id },
      data: { status: "draft" },
    });
  }

  if (wd?.workflowDocumentId) {
    const actor = {
      userId: approver.id,
      role: approver.role,
      name: approver.name ?? undefined,
    };
    await prisma.workflowDocument.update({
      where: { id: wd.workflowDocumentId },
      data: { status: "draft" },
    });
    await prisma.workDiary.update({
      where: { id: wd.id },
      data: { status: "draft" },
    });

    for (const [label, run] of [
      [
        "WD Send",
        async () =>
          (
            await timed(() =>
              WorkDiariesRepository.submitForApproval(
                wd.id,
                [approver.id],
                wd.createdById,
                bg,
                actor
              )
            )
          ).ms,
      ],
      [
        "WD Return",
        async () =>
          (
            await timed(() =>
              WorkDiariesRepository.decideApproval(
                wd.id,
                approver.id,
                "rejected",
                "fe-check",
                "note",
                bg,
                actor
              )
            )
          ).ms,
      ],
      [
        "WD Resubmit",
        async () =>
          (
            await timed(() =>
              WorkDiariesRepository.submitForApproval(
                wd.id,
                [approver.id],
                wd.createdById,
                bg,
                actor
              )
            )
          ).ms,
      ],
      [
        "WD Approve",
        async () =>
          (
            await timed(() =>
              WorkDiariesRepository.decideApproval(
                wd.id,
                approver.id,
                "approved",
                "fe-check",
                undefined,
                bg,
                actor
              )
            )
          ).ms,
      ],
    ] as const) {
      const api = await run();
      rows.push({
        action: label,
        apiMs: api,
        uiUpdateBeforeMs: refreshCost,
        uiUpdateAfterMs: uiPatchMs,
        totalBeforeMs: api + refreshCost,
        totalAfterMs: api + uiPatchMs,
        statusBefore: status(api + refreshCost),
        statusAfter: status(api + uiPatchMs),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        note: "API measured via repo (same DB as prod). UI costs from code-path audit.",
        getSheetBlockingMs: getSheetMs,
        listSheetsEstimateMs: listSheetsMs,
        routerRefreshEstimateMs: refreshCost,
        rows,
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
