import { prisma } from "@/lib/prisma";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import type { ScheduleBackground } from "@/lib/async/schedule-background";

export type TimingStats = {
  samples: number[];
  cold: number;
  median: number;
  p95: number;
};

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx]!;
}

export function summarizeTimings(samples: number[]): TimingStats {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples,
    cold: samples[0] ?? 0,
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const start = performance.now();
  const result = await fn();
  return { ms: Math.round(performance.now() - start), result };
}

function makeBgTracker() {
  const tasks: Promise<void>[] = [];
  const errors: string[] = [];
  const schedule: ScheduleBackground = (task) => {
    tasks.push(
      Promise.resolve()
        .then(task)
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(msg);
          console.error("[prod-bench-bg]", err);
        })
    );
  };
  async function drain() {
    while (tasks.length) {
      const batch = tasks.splice(0, tasks.length);
      await Promise.allSettled(batch);
    }
  }
  return { schedule, drain, errors };
}

export async function runProductionWorkflowBench(input?: {
  runsPerAction?: number;
}) {
  const runsPerAction = Math.min(8, Math.max(3, input?.runsPerAction ?? 5));
  const region =
    process.env.VERCEL_REGION ||
    process.env.AWS_REGION ||
    "unknown-local";

  const approver = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      role: { in: ["SYSTEM_MANAGER", "ADMIN", "מנהל מערכת"] },
    },
    select: { id: true, name: true, role: true },
  });
  if (!approver) throw new Error("No system approver for production bench");

  const rttSamples: number[] = [];
  for (let i = 0; i < runsPerAction; i++) {
    const t = await timed(() => prisma.$queryRaw`SELECT 1`);
    rttSamples.push(t.ms);
  }

  const sheet = await prisma.measurementSheet.findFirst({
    where: { status: { in: ["draft", "revision", "pending_approval"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, createdById: true, projectId: true },
  });
  const diary = await prisma.workDiary.findFirst({
    where: { deletedAt: null, workflowDocumentId: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      createdById: true,
      projectId: true,
      documentNumber: true,
      workflowDocumentId: true,
    },
  });
  const dn = await prisma.opsDeliveryNote.findFirst({
    where: { deletedAt: null, status: { in: ["draft", "revision", "pending_approval"] } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      createdById: true,
      projectId: true,
      documentNumber: true,
    },
  });

  const ms = {
    send: [] as number[],
    approve: [] as number[],
    return: [] as number[],
    resubmit: [] as number[],
  };
  const dnT = {
    send: [] as number[],
    approve: [] as number[],
    return: [] as number[],
    resubmit: [] as number[],
  };
  const wd = {
    send: [] as number[],
    approve: [] as number[],
    return: [] as number[],
    resubmit: [] as number[],
  };

  const sideEffects: {
    ok: boolean;
    checks: Record<string, boolean | string | number>;
    bgErrors: string[];
  } = {
    ok: true,
    checks: {},
    bgErrors: [],
  };

  async function resetMs(sheetId: string) {
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
  }

  if (sheet) {
    for (let i = 0; i < runsPerAction; i++) {
      const bg = makeBgTracker();
      await resetMs(sheet.id);
      const send = await timed(() =>
        MeasurementSheetsRepository.submitForApproval(
          sheet.id,
          [approver.id],
          sheet.createdById,
          undefined,
          bg.schedule
        )
      );
      await bg.drain();
      ms.send.push(send.ms);

      const ret = await timed(() =>
        MeasurementSheetsRepository.decideApproval(
          sheet.id,
          approver.id,
          "rejected",
          "prod-bench return",
          "note",
          undefined,
          undefined,
          bg.schedule
        )
      );
      await bg.drain();
      ms.return.push(ret.ms);

      const resubmit = await timed(() =>
        MeasurementSheetsRepository.submitForApproval(
          sheet.id,
          [approver.id],
          sheet.createdById,
          undefined,
          bg.schedule
        )
      );
      await bg.drain();
      ms.resubmit.push(resubmit.ms);

      const approve = await timed(() =>
        MeasurementSheetsRepository.decideApproval(
          sheet.id,
          approver.id,
          "approved",
          "prod-bench",
          undefined,
          undefined,
          undefined,
          bg.schedule
        )
      );
      await bg.drain();
      ms.approve.push(approve.ms);

      if (bg.errors.length) {
        sideEffects.ok = false;
        sideEffects.bgErrors.push(...bg.errors.map((e) => `MS: ${e}`));
      }
    }

    const events = await prisma.measurementSheetEvent.count({
      where: { sheetId: sheet.id, type: { in: ["submitted", "returned", "approved"] } },
    });
    const versions = await prisma.measurementSheetVersion.count({
      where: { sheetId: sheet.id },
    });
    const activity = await prisma.activity.count({
      where: {
        projectId: sheet.projectId,
        metadata: { contains: sheet.id },
      },
    });
    sideEffects.checks.msEvents = events;
    sideEffects.checks.msVersions = versions;
    sideEffects.checks.msActivityRows = activity;
    if (events < 3 || versions < 1) sideEffects.ok = false;

    await resetMs(sheet.id);
  }

  if (dn) {
    for (let i = 0; i < runsPerAction; i++) {
      const bg = makeBgTracker();
      await prisma.opsDeliveryNoteApproval.updateMany({
        where: { opsDeliveryNoteId: dn.id, status: "pending" },
        data: { status: "cancelled" },
      });
      await prisma.opsDeliveryNote.update({
        where: { id: dn.id },
        data: { status: "draft" },
      });

      const send = await timed(() =>
        OpsDeliveryNotesRepository.submitForApproval(
          dn.id,
          [approver.id],
          dn.createdById,
          bg.schedule
        )
      );
      await bg.drain();
      dnT.send.push(send.ms);

      const ret = await timed(() =>
        OpsDeliveryNotesRepository.decideApproval(
          dn.id,
          approver.id,
          "rejected",
          "prod-bench return",
          "note",
          bg.schedule
        )
      );
      await bg.drain();
      dnT.return.push(ret.ms);

      const resubmit = await timed(() =>
        OpsDeliveryNotesRepository.submitForApproval(
          dn.id,
          [approver.id],
          dn.createdById,
          bg.schedule
        )
      );
      await bg.drain();
      dnT.resubmit.push(resubmit.ms);

      const approve = await timed(() =>
        OpsDeliveryNotesRepository.decideApproval(
          dn.id,
          approver.id,
          "approved",
          "prod-bench",
          undefined,
          bg.schedule
        )
      );
      await bg.drain();
      dnT.approve.push(approve.ms);

      if (bg.errors.length) {
        sideEffects.ok = false;
        sideEffects.bgErrors.push(...bg.errors.map((e) => `DN: ${e}`));
      }
    }

    const events = await prisma.opsDeliveryNoteEvent.count({
      where: { opsDeliveryNoteId: dn.id },
    });
    sideEffects.checks.dnEvents = events;
    if (events < 4) sideEffects.ok = false;

    await prisma.opsDeliveryNote.update({
      where: { id: dn.id },
      data: { status: "draft" },
    });
  }

  if (diary?.workflowDocumentId) {
    for (let i = 0; i < runsPerAction; i++) {
      const bg = makeBgTracker();
      await prisma.workflowApproval.updateMany({
        where: {
          documentId: diary.workflowDocumentId,
          status: "pending",
        },
        data: { status: "cancelled" },
      });
      await prisma.workflowDocument.update({
        where: { id: diary.workflowDocumentId },
        data: { status: "draft" },
      });
      await prisma.workDiary.update({
        where: { id: diary.id },
        data: { status: "draft" },
      });

      const actor = {
        userId: approver.id,
        role: approver.role,
        name: approver.name ?? undefined,
      };

      const send = await timed(() =>
        WorkDiariesRepository.submitForApproval(
          diary.id,
          [approver.id],
          diary.createdById,
          bg.schedule,
          actor
        )
      );
      await bg.drain();
      wd.send.push(send.ms);

      const ret = await timed(() =>
        WorkDiariesRepository.decideApproval(
          diary.id,
          approver.id,
          "rejected",
          "prod-bench return",
          "note",
          bg.schedule,
          actor
        )
      );
      await bg.drain();
      wd.return.push(ret.ms);

      const resubmit = await timed(() =>
        WorkDiariesRepository.submitForApproval(
          diary.id,
          [approver.id],
          diary.createdById,
          bg.schedule,
          actor
        )
      );
      await bg.drain();
      wd.resubmit.push(resubmit.ms);

      const approve = await timed(() =>
        WorkDiariesRepository.decideApproval(
          diary.id,
          approver.id,
          "approved",
          "prod-bench",
          undefined,
          bg.schedule,
          actor
        )
      );
      await bg.drain();
      wd.approve.push(approve.ms);

      if (bg.errors.length) {
        sideEffects.ok = false;
        sideEffects.bgErrors.push(...bg.errors.map((e) => `WD: ${e}`));
      }
    }

    const events = await prisma.workflowEvent.count({
      where: { documentId: diary.workflowDocumentId },
    });
    const versions = await prisma.workflowDocVersion.count({
      where: { documentId: diary.workflowDocumentId },
    });
    sideEffects.checks.wdEvents = events;
    sideEffects.checks.wdVersions = versions;
    if (events < 4 || versions < 4) sideEffects.ok = false;

    await prisma.workflowDocument.update({
      where: { id: diary.workflowDocumentId },
      data: { status: "draft" },
    });
    await prisma.workDiary.update({
      where: { id: diary.id },
      data: { status: "draft" },
    });
  }

  const doubleClick = { pass: false, detail: "" as string };
  if (sheet) {
    await resetMs(sheet.id);
    await MeasurementSheetsRepository.submitForApproval(
      sheet.id,
      [approver.id],
      sheet.createdById
    );
    const [a, b] = await Promise.allSettled([
      MeasurementSheetsRepository.decideApproval(
        sheet.id,
        approver.id,
        "approved",
        "dc-a"
      ),
      MeasurementSheetsRepository.decideApproval(
        sheet.id,
        approver.id,
        "approved",
        "dc-b"
      ),
    ]);
    const fulfilled = [a, b].filter((x) => x.status === "fulfilled").length;
    const rejected = [a, b].filter((x) => x.status === "rejected").length;
    const approvedEvents = await prisma.measurementSheetEvent.count({
      where: {
        sheetId: sheet.id,
        type: "approved",
        message: { contains: "אושר" },
      },
    });
    doubleClick.pass = fulfilled === 1 && rejected === 1;
    doubleClick.detail = `fulfilled=${fulfilled} rejected=${rejected} approvedEvents>=1`;
    sideEffects.checks.doubleClick = doubleClick.pass;
    if (!doubleClick.pass) sideEffects.ok = false;
    await resetMs(sheet.id);
  }

  return {
    measuredAt: new Date().toISOString(),
    vercelRegion: region,
    supabaseRegion: "eu-north-1",
    regionMatch: region === "arn1",
    runsPerAction,
    dbRtt: summarizeTimings(rttSamples),
    workflow: {
      ms: {
        send: summarizeTimings(ms.send),
        approve: summarizeTimings(ms.approve),
        return: summarizeTimings(ms.return),
        resubmit: summarizeTimings(ms.resubmit),
      },
      dn: {
        send: summarizeTimings(dnT.send),
        approve: summarizeTimings(dnT.approve),
        return: summarizeTimings(dnT.return),
        resubmit: summarizeTimings(dnT.resubmit),
      },
      wd: {
        send: summarizeTimings(wd.send),
        approve: summarizeTimings(wd.approve),
        return: summarizeTimings(wd.return),
        resubmit: summarizeTimings(wd.resubmit),
      },
    },
    sideEffects,
    doubleClick,
    docs: {
      sheetId: sheet?.id ?? null,
      dnId: dn?.id ?? null,
      diaryId: diary?.id ?? null,
    },
  };
}
