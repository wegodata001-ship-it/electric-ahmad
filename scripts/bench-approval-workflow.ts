/**
 * Approval workflow performance benchmark — real wall-clock timings.
 * Uses fire-and-forget scheduleBackground (same as Next.js `after` on API routes)
 * so measured times reflect the critical mutation path.
 */
import { prisma } from "../src/lib/prisma";
import { MeasurementSheetsRepository } from "../src/repositories/measurement-sheets.repository";
import { WorkDiariesRepository } from "../src/repositories/work-diaries.repository";
import { OpsDeliveryNotesRepository } from "../src/repositories/ops-delivery-notes.repository";
import type { ScheduleBackground } from "../src/lib/async/schedule-background";

const bgTasks: Promise<void>[] = [];
const schedule: ScheduleBackground = (task) => {
  bgTasks.push(
    Promise.resolve()
      .then(task)
      .catch((err) => console.error("[bench-bg]", err))
  );
};

async function drainBg() {
  while (bgTasks.length) {
    const batch = bgTasks.splice(0, bgTasks.length);
    await Promise.allSettled(batch);
  }
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const start = performance.now();
  const result = await fn();
  return { ms: Math.round(performance.now() - start), result };
}

async function main() {
  const approver = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      role: { in: ["SYSTEM_MANAGER", "ADMIN", "מנהל מערכת"] },
    },
    select: { id: true, name: true, role: true },
  });
  if (!approver) throw new Error("No system approver");

  const secondApprover = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      id: { not: approver.id },
      role: {
        in: ["PROJECT_MANAGER", "OPERATIONS_MANAGER", "SYSTEM_MANAGER"],
      },
    },
    select: { id: true },
  });

  const runs: Record<string, unknown>[] = [];

  const smallSheet = await prisma.measurementSheet.findFirst({
    where: { status: "draft" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      createdById: true,
      _count: { select: { rows: true, cells: true, events: true } },
    },
  });

  const largeSheet = await prisma.measurementSheet.findFirst({
    where: { status: "draft" },
    orderBy: { cells: { _count: "desc" } },
    select: {
      id: true,
      createdById: true,
      _count: { select: { rows: true, cells: true, events: true } },
    },
  });

  async function measureGetById(sheetId: string, label: string) {
    const a = await timed(() => MeasurementSheetsRepository.getById(sheetId));
    const b = await timed(() => MeasurementSheetsRepository.getById(sheetId));
    const snap = a.result ? JSON.stringify(a.result).length : 0;
    runs.push({
      action: "getById",
      label,
      coldMs: a.ms,
      warmMs: b.ms,
      snapshotBytes: snap,
    });
  }

  async function cycleMs(
    sheetId: string,
    createdById: string,
    label: string,
    counts: { rows: number; cells: number; events: number }
  ) {
    await prisma.measurementSheet.update({
      where: { id: sheetId },
      data: {
        status: "draft",
        approvedAt: null,
        returnedAt: null,
        lastReturnComment: null,
      },
    });
    await prisma.measurementSheetApproval.updateMany({
      where: { sheetId, status: "pending" },
      data: { status: "cancelled" },
    });
    await drainBg();

    const approverIds = [
      approver.id,
      ...(secondApprover ? [secondApprover.id] : []),
    ];

    const submit = await timed(() =>
      MeasurementSheetsRepository.submitForApproval(
        sheetId,
        approverIds,
        createdById,
        undefined,
        schedule
      )
    );
    await drainBg();

    const approve = await timed(() =>
      MeasurementSheetsRepository.decideApproval(
        sheetId,
        approver.id,
        "approved",
        "QA approve",
        "note",
        undefined,
        undefined,
        schedule
      )
    );
    await drainBg();

    await prisma.measurementSheet.update({
      where: { id: sheetId },
      data: { status: "draft", approvedAt: null },
    });
    await prisma.measurementSheetApproval.updateMany({
      where: { sheetId, status: "pending" },
      data: { status: "cancelled" },
    });

    await MeasurementSheetsRepository.submitForApproval(
      sheetId,
      [approver.id],
      createdById,
      undefined,
      schedule
    );
    await drainBg();

    const reject = await timed(() =>
      MeasurementSheetsRepository.decideApproval(
        sheetId,
        approver.id,
        "rejected",
        "חסרים נתונים במדידה — QA",
        "note",
        undefined,
        undefined,
        schedule
      )
    );
    await drainBg();

    const resubmit = await timed(() =>
      MeasurementSheetsRepository.submitForApproval(
        sheetId,
        [approver.id],
        createdById,
        undefined,
        schedule
      )
    );
    await drainBg();

    const ensure = await timed(() =>
      MeasurementSheetsRepository.ensureDocument(
        sheetId,
        createdById,
        "pending_approval"
      )
    );

    await prisma.measurementSheetApproval.updateMany({
      where: { sheetId, status: "pending" },
      data: { status: "cancelled" },
    });
    await prisma.measurementSheet.update({
      where: { id: sheetId },
      data: {
        status: "draft",
        approvedAt: null,
        returnedAt: null,
        lastReturnComment: null,
      },
    });

    runs.push({
      kind: "measurement_sheet",
      label,
      counts,
      sendForApprovalMs: submit.ms,
      approveMs: approve.ms,
      returnForCorrectionMs: reject.ms,
      resubmitMs: resubmit.ms,
      ensureDocumentMs: ensure.ms,
      approverCount: approverIds.length,
      mode: "critical_path_with_deferred_side_effects",
    });
  }

  if (smallSheet) {
    await measureGetById(
      smallSheet.id,
      `MS-small cells=${smallSheet._count.cells}`
    );
    await cycleMs(
      smallSheet.id,
      smallSheet.createdById,
      `MS-small cells=${smallSheet._count.cells}`,
      smallSheet._count
    );
  }

  if (largeSheet && largeSheet.id !== smallSheet?.id) {
    await measureGetById(
      largeSheet.id,
      `MS-large cells=${largeSheet._count.cells}`
    );
    await cycleMs(
      largeSheet.id,
      largeSheet.createdById,
      `MS-large cells=${largeSheet._count.cells}`,
      largeSheet._count
    );
  }

  const diary = await prisma.workDiary.findFirst({
    where: {
      deletedAt: null,
      workflowDocumentId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (diary) {
    try {
      if (diary.workflowDocumentId) {
        await prisma.workflowDocument.update({
          where: { id: diary.workflowDocumentId },
          data: { status: "draft" },
        });
        await prisma.workflowApproval.updateMany({
          where: { documentId: diary.workflowDocumentId, status: "pending" },
          data: { status: "cancelled" },
        });
      }
      await prisma.workDiary.update({
        where: { id: diary.id },
        data: { status: "draft" },
      });

      const submit = await timed(() =>
        WorkDiariesRepository.submitForApproval(
          diary.id,
          [approver.id],
          diary.createdById,
          schedule
        )
      );
      await drainBg();
      const reject = await timed(() =>
        WorkDiariesRepository.decideApproval(
          diary.id,
          approver.id,
          "rejected",
          "QA return",
          "note",
          schedule
        )
      );
      await drainBg();
      const resubmit = await timed(() =>
        WorkDiariesRepository.submitForApproval(
          diary.id,
          [approver.id],
          diary.createdById,
          schedule
        )
      );
      await drainBg();
      const approve = await timed(() =>
        WorkDiariesRepository.decideApproval(
          diary.id,
          approver.id,
          "approved",
          "QA",
          undefined,
          schedule
        )
      );
      await drainBg();
      if (diary.workflowDocumentId) {
        await prisma.workflowDocument.update({
          where: { id: diary.workflowDocumentId },
          data: { status: "draft" },
        });
      }
      await prisma.workDiary.update({
        where: { id: diary.id },
        data: { status: "draft" },
      });
      runs.push({
        kind: "work_diary",
        label: diary.documentNumber,
        sendForApprovalMs: submit.ms,
        returnForCorrectionMs: reject.ms,
        resubmitMs: resubmit.ms,
        approveMs: approve.ms,
        mode: "critical_path_with_deferred_side_effects",
      });
    } catch (e) {
      runs.push({
        kind: "work_diary",
        label: diary.documentNumber,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const dn = await prisma.opsDeliveryNote.findFirst({
    where: { deletedAt: null, status: { in: ["draft", "revision"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (dn) {
    try {
      await prisma.opsDeliveryNote.update({
        where: { id: dn.id },
        data: { status: "draft" },
      });
      await prisma.opsDeliveryNoteApproval.updateMany({
        where: { opsDeliveryNoteId: dn.id, status: "pending" },
        data: { status: "cancelled" },
      });

      const submit = await timed(() =>
        OpsDeliveryNotesRepository.submitForApproval(
          dn.id,
          [approver.id],
          dn.createdById,
          schedule
        )
      );
      await drainBg();
      const reject = await timed(() =>
        OpsDeliveryNotesRepository.decideApproval(
          dn.id,
          approver.id,
          "rejected",
          "QA return",
          "note",
          schedule
        )
      );
      await drainBg();
      const resubmit = await timed(() =>
        OpsDeliveryNotesRepository.submitForApproval(
          dn.id,
          [approver.id],
          dn.createdById,
          schedule
        )
      );
      await drainBg();
      const approve = await timed(() =>
        OpsDeliveryNotesRepository.decideApproval(
          dn.id,
          approver.id,
          "approved",
          "QA",
          undefined,
          schedule
        )
      );
      await drainBg();
      await prisma.opsDeliveryNote.update({
        where: { id: dn.id },
        data: { status: "draft" },
      });
      runs.push({
        kind: "delivery_note",
        label: dn.documentNumber,
        sendForApprovalMs: submit.ms,
        returnForCorrectionMs: reject.ms,
        resubmitMs: resubmit.ms,
        approveMs: approve.ms,
        mode: "critical_path_with_deferred_side_effects",
      });
    } catch (e) {
      runs.push({
        kind: "delivery_note",
        label: dn.documentNumber,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (largeSheet) {
    const sheet = await timed(() =>
      MeasurementSheetsRepository.getById(largeSheet.id)
    );
    const jsonStart = performance.now();
    const bytes = sheet.result ? JSON.stringify(sheet.result).length : 0;
    runs.push({
      action: "ms-submit-components",
      getByIdMs: sheet.ms,
      jsonStringifyMs: Math.round(performance.now() - jsonStart),
      snapshotBytes: bytes,
    });
  }

  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), approver: approver.name, runs }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
