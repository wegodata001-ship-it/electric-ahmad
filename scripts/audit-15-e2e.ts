/**
 * Stage 1.5 audit: Work Diary ↔ Workflow Engine
 * Uses repository layer (same code as API) + Prisma count evidence.
 */
import { PrismaClient } from "@prisma/client";
import { WorkDiariesRepository } from "../src/repositories/work-diaries.repository";
import { WorkflowRepository } from "../src/repositories/workflow.repository";

const prisma = new PrismaClient();

async function snapshot(label: string) {
  const data = {
    label,
    diaries: await prisma.workDiary.count({ where: { deletedAt: null } }),
    withWf: await prisma.workDiary.count({
      where: { deletedAt: null, workflowDocumentId: { not: null } },
    }),
    withoutWf: await prisma.workDiary.count({
      where: { deletedAt: null, workflowDocumentId: null },
    }),
    wfDocs: await prisma.workflowDocument.count({ where: { kind: "WORK_DIARY" } }),
    archive: await prisma.document.count({ where: { sourceType: "work_diary" } }),
    legacyAppr: await prisma.workDiaryApproval.count(),
    legacyEv: await prisma.workDiaryEvent.count(),
    wfAppr: await prisma.workflowApproval.count({
      where: { document: { kind: "WORK_DIARY" } },
    }),
    wfEv: await prisma.workflowEvent.count({
      where: { document: { kind: "WORK_DIARY" } },
    }),
    wfAtt: await prisma.workflowAttachment.count({
      where: { document: { kind: "WORK_DIARY" } },
    }),
    media: await prisma.workDiaryMedia.count(),
    att: await prisma.workDiaryAttachment.count(),
    versions: await prisma.workflowDocVersion.count({
      where: { document: { kind: "WORK_DIARY" } },
    }),
  };
  console.log("SNAP", JSON.stringify(data));
  return data;
}

async function main() {
  const report: Record<string, unknown> = {};

  // —— 0. Models ——
  report.models = {
    workflowDocument: typeof prisma.workflowDocument?.findMany === "function",
    workflowApproval: typeof prisma.workflowApproval?.findMany === "function",
    workflowEvent: typeof prisma.workflowEvent?.findMany === "function",
    workflowAttachment: typeof prisma.workflowAttachment?.findMany === "function",
    workDiary: typeof prisma.workDiary?.findMany === "function",
  };

  const beforeAll = await snapshot("before_all");

  // —— 1. Migration (idempotent) ——
  const mig1 = await WorkDiariesRepository.migrateToWorkflowEngine();
  report.migration1 = mig1;
  await snapshot("after_migration_1");
  const mig2 = await WorkDiariesRepository.migrateToWorkflowEngine();
  report.migration2 = mig2;
  const afterMig = await snapshot("after_migration_2");
  report.migrationIdempotent =
    mig2.created === 0 &&
    afterMig.wfDocs === (await snapshot("mig_check")).wfDocs;

  // Pick existing project + foreman + users
  const project = await prisma.project.findFirst({
    where: { status: "active" },
    select: { id: true, name: true, foremanId: true, ownerId: true },
  });
  if (!project) throw new Error("No active project — cannot run create flow");

  const foremanEmp = await prisma.employee.findUnique({
    where: { id: project.foremanId },
    select: { id: true, userId: true },
  });
  if (!foremanEmp) throw new Error("Project foreman employee missing");

  const creator =
    (foremanEmp.userId &&
      (await prisma.user.findUnique({ where: { id: foremanEmp.userId } }))) ||
    (await prisma.user.findUnique({ where: { id: project.ownerId } })) ||
    (await prisma.user.findFirst({ where: { role: "SYSTEM_MANAGER" } })) ||
    (await prisma.user.findFirst());

  if (!creator) throw new Error("No user for create");

  const approver =
    (await prisma.user.findFirst({
      where: {
        id: { not: creator.id },
        role: { in: ["SYSTEM_MANAGER", "PROJECT_MANAGER", "admin", "office"] },
      },
    })) ||
    (await prisma.user.findFirst({ where: { id: { not: creator.id } } })) ||
    creator;

  report.actors = {
    creatorId: creator.id,
    creatorRole: creator.role,
    approverId: approver.id,
    approverRole: approver.role,
    projectId: project.id,
    foremanId: foremanEmp.id,
  };

  // —— 2. Create diary ——
  const beforeCreate = await snapshot("before_create");
  const diary = await WorkDiariesRepository.create({
    projectId: project.id,
    foremanId: foremanEmp.id,
    workDate: new Date(),
    workType: "audit-test",
    workSummary: "Stage 1.5 audit diary",
    notes: "audit notes",
    workItems: [{ description: "item A", quantity: 1, unit: "יח'" }],
    workers: [{ name: "Worker A", hours: 8 }],
    equipment: [{ name: "Drill", quantity: 1 }],
    materials: [{ name: "Cable", quantity: 10, unit: "מ'" }],
    createdById: creator.id,
  });

  const raw = await prisma.workDiary.findUnique({
    where: { id: diary!.id },
    include: {
      workflowDocument: true,
    },
  });
  const archives = await prisma.document.findMany({
    where: { sourceType: "work_diary", sourceId: diary!.id },
  });

  report.create = {
    diaryId: diary!.id,
    documentNumber: diary!.documentNumber,
    apiStatus: (diary as any).status,
    workflowDocumentId: raw?.workflowDocumentId,
    wfKind: raw?.workflowDocument?.kind,
    wfStatus: raw?.workflowDocument?.status,
    wfNumber: raw?.workflowDocument?.documentNumber,
    legacyEntityType: raw?.workflowDocument?.legacyEntityType,
    legacyEntityId: raw?.workflowDocument?.legacyEntityId,
    projectIdMatch: raw?.workflowDocument?.projectId === project.id,
    sourceDocumentId: raw?.workflowDocument?.sourceDocumentId ?? null,
    parentDocumentId: raw?.workflowDocument?.parentDocumentId ?? null,
    nextDocumentId: raw?.workflowDocument?.nextDocumentId ?? null,
    archiveCount: archives.length,
    archiveFolder: archives[0]?.folderPath ?? null,
    archiveWfId: archives[0]?.workflowDocumentId ?? null,
    archiveSourceType: archives[0]?.sourceType ?? null,
    numberFormatOk: /^WD-\d{6}$/.test(String(diary!.documentNumber)),
    numberFormatJw: /^JW-/.test(String(diary!.documentNumber)),
  };
  const afterCreate = await snapshot("after_create");
  report.createDeltas = {
    diaries: afterCreate.diaries - beforeCreate.diaries,
    wfDocs: afterCreate.wfDocs - beforeCreate.wfDocs,
    archive: afterCreate.archive - beforeCreate.archive,
    legacyAppr: afterCreate.legacyAppr - beforeCreate.legacyAppr,
    legacyEv: afterCreate.legacyEv - beforeCreate.legacyEv,
  };

  // —— 3. Edit draft ——
  const beforeEdit = await snapshot("before_edit");
  await WorkDiariesRepository.update(diary!.id, {
    workSummary: "edited summary",
    notes: "edited notes",
    workItems: [
      { description: "item A", quantity: 2 },
      { description: "item B", quantity: 3 },
    ],
    workers: [{ name: "Worker B", hours: 6 }],
    equipment: [{ name: "Crane", quantity: 1 }],
    materials: [{ name: "Pipe", quantity: 5 }],
    updatedById: creator.id,
  });
  const afterEditRaw = await prisma.workDiary.findUnique({
    where: { id: diary!.id },
    include: { workflowDocument: true, workItems: true },
  });
  const afterEdit = await snapshot("after_edit");
  report.edit = {
    statusUnchanged:
      afterEditRaw?.workflowDocument?.status === raw?.workflowDocument?.status,
    workItems: afterEditRaw?.workItems.length,
    summary: afterEditRaw?.workSummary,
    noNewWf: afterEdit.wfDocs === beforeEdit.wfDocs,
    noNewArchive: afterEdit.archive === beforeEdit.archive,
    noLegacyAppr: afterEdit.legacyAppr === beforeEdit.legacyAppr,
    noLegacyEv: afterEdit.legacyEv === beforeEdit.legacyEv,
  };

  // —— 4. Attachments dual-write ——
  const beforeAtt = await snapshot("before_att");
  await WorkDiariesRepository.addMedia(
    diary!.id,
    {
      name: "audit-photo.jpg",
      url: "https://example.local/audit-photo.jpg",
      path: "audit/audit-photo.jpg",
      bucket: "images",
      size: 1234,
      stage: "during",
    },
    creator.id
  );
  await WorkDiariesRepository.addAttachment(
    diary!.id,
    {
      name: "audit-file.pdf",
      mimeType: "application/pdf",
      size: 4567,
      kind: "file",
      bucket: "files",
      path: "audit/audit-file.pdf",
      url: "https://example.local/audit-file.pdf",
    },
    creator.id
  );
  const afterAtt = await snapshot("after_att");
  report.attachments = {
    mediaDelta: afterAtt.media - beforeAtt.media,
    attDelta: afterAtt.att - beforeAtt.att,
    wfAttDelta: afterAtt.wfAtt - beforeAtt.wfAtt,
    physicalUpload: "metadata-only in this audit (URLs fake)",
    dualWriteActive:
      afterAtt.media - beforeAtt.media > 0 ||
      afterAtt.att - beforeAtt.att > 0,
    singleSourceWorkflowOnly:
      afterAtt.media - beforeAtt.media === 0 &&
      afterAtt.att - beforeAtt.att === 0 &&
      afterAtt.wfAtt - beforeAtt.wfAtt >= 2,
  };

  // —— 5. Submit ——
  const beforeSubmit = await snapshot("before_submit");
  const submitted = await WorkDiariesRepository.submitForApproval(
    diary!.id,
    [approver.id],
    creator.id
  );
  const afterSubmitRaw = await prisma.workDiary.findUnique({
    where: { id: diary!.id },
    include: { workflowDocument: true },
  });
  const submitArchive = await prisma.document.findFirst({
    where: { sourceType: "work_diary", sourceId: diary!.id },
  });
  const afterSubmit = await snapshot("after_submit");
  report.submit = {
    apiStatus: (submitted as any).status,
    wfStatus: afterSubmitRaw?.workflowDocument?.status,
    archiveFolder: submitArchive?.folderPath,
    legacyApprDelta: afterSubmit.legacyAppr - beforeSubmit.legacyAppr,
    legacyEvDelta: afterSubmit.legacyEv - beforeSubmit.legacyEv,
    wfApprDelta: afterSubmit.wfAppr - beforeSubmit.wfAppr,
    wfEvDelta: afterSubmit.wfEv - beforeSubmit.wfEv,
    versionsDelta: afterSubmit.versions - beforeSubmit.versions,
    archiveDelta: afterSubmit.archive - beforeSubmit.archive,
  };

  // —— 6. Inbox ——
  const pending = await WorkDiariesRepository.listPendingApprovals(approver.id);
  report.inbox = {
    count: pending.length,
    containsDiary: pending.some((p: any) => p.id === diary!.id || p.link?.includes(diary!.id)),
    sampleKeys: pending[0] ? Object.keys(pending[0]) : [],
  };

  // —— 7. Reject ——
  const beforeReject = await snapshot("before_reject");
  let rejectError: string | null = null;
  try {
    await WorkDiariesRepository.decideApproval(diary!.id, approver.id, "rejected", "");
  } catch (e: any) {
    rejectError = e?.message ?? String(e);
  }
  const rejected = await WorkDiariesRepository.decideApproval(
    diary!.id,
    approver.id,
    "rejected",
    "needs fix - audit"
  );
  const afterRejectRaw = await prisma.workDiary.findUnique({
    where: { id: diary!.id },
    include: { workflowDocument: true },
  });
  const rejectArchive = await prisma.document.findFirst({
    where: { sourceType: "work_diary", sourceId: diary!.id },
  });
  const afterReject = await snapshot("after_reject");
  report.reject = {
    emptyCommentError: rejectError,
    apiStatus: (rejected as any).status,
    wfStatus: afterRejectRaw?.workflowDocument?.status,
    archiveFolder: rejectArchive?.folderPath,
    legacyApprDelta: afterReject.legacyAppr - beforeReject.legacyAppr,
    legacyEvDelta: afterReject.legacyEv - beforeReject.legacyEv,
    wfEvDelta: afterReject.wfEv - beforeReject.wfEv,
  };

  // —— 8. Resubmit ——
  await WorkDiariesRepository.update(diary!.id, {
    workSummary: "fixed after reject",
    updatedById: creator.id,
  });
  const beforeResubmit = await snapshot("before_resubmit");
  await WorkDiariesRepository.submitForApproval(
    diary!.id,
    [approver.id],
    creator.id
  );
  const afterResubmit = await snapshot("after_resubmit");
  report.resubmit = {
    wfDocsSame: afterResubmit.wfDocs === beforeResubmit.wfDocs,
    archiveSame: afterResubmit.archive === beforeResubmit.archive,
    legacyApprDelta: afterResubmit.legacyAppr - beforeResubmit.legacyAppr,
    legacyEvDelta: afterResubmit.legacyEv - beforeResubmit.legacyEv,
    wfApprDelta: afterResubmit.wfAppr - beforeResubmit.wfAppr,
  };

  // —— 9. Approve ——
  const beforeApprove = await snapshot("before_approve");
  const approved = await WorkDiariesRepository.decideApproval(
    diary!.id,
    approver.id,
    "approved",
    "ok audit"
  );
  const afterApproveRaw = await prisma.workDiary.findUnique({
    where: { id: diary!.id },
    include: { workflowDocument: true },
  });
  const approveArchive = await prisma.document.findFirst({
    where: { sourceType: "work_diary", sourceId: diary!.id },
  });
  const afterApprove = await snapshot("after_approve");
  report.approve = {
    apiStatus: (approved as any).status,
    wfStatus: afterApproveRaw?.workflowDocument?.status,
    archiveFolder: approveArchive?.folderPath,
    legacyApprDelta: afterApprove.legacyAppr - beforeApprove.legacyAppr,
    legacyEvDelta: afterApprove.legacyEv - beforeApprove.legacyEv,
    wfEvDelta: afterApprove.wfEv - beforeApprove.wfEv,
    archiveDelta: afterApprove.archive - beforeApprove.archive,
  };

  // —— 10. Timeline ——
  if (afterApproveRaw?.workflowDocumentId) {
    const timeline = await WorkflowRepository.timeline(
      afterApproveRaw.workflowDocumentId
    );
    report.timeline = {
      eventCount: Array.isArray(timeline) ? timeline.length : (timeline as any)?.events?.length,
      types: Array.isArray(timeline)
        ? timeline.map((e: any) => e.action ?? e.type ?? e.eventType)
        : ((timeline as any)?.events ?? []).map(
            (e: any) => e.action ?? e.type ?? e.eventType
          ),
    };
  }

  // —— 11. Source of truth mismatch ——
  await prisma.workDiary.update({
    where: { id: diary!.id },
    data: { status: "draft" as any },
  });
  const listed = await WorkDiariesRepository.list({ projectId: project.id, take: 100 });
  const listedRow = listed.find((r: any) => r.id === diary!.id);
  const byId = await WorkDiariesRepository.getById(diary!.id);
  const archived = await WorkDiariesRepository.archive({
    projectId: project.id,
    take: 100,
  });
  const archiveRow = archived.find((r: any) => r.id === diary!.id);
  report.sot = {
    legacyStatusForced: "draft",
    listStatus: listedRow?.status,
    getByIdStatus: (byId as any)?.status,
    archiveStatus: archiveRow?.status,
    wfStatus: afterApproveRaw?.workflowDocument?.status,
    listUsesWorkflow: listedRow?.status === afterApproveRaw?.workflowDocument?.status,
    getUsesWorkflow: (byId as any)?.status === afterApproveRaw?.workflowDocument?.status,
    archiveUsesWorkflow:
      archiveRow?.status === afterApproveRaw?.workflowDocument?.status,
  };

  // —— 12. Client sign path (best-effort) ——
  try {
    const link = await WorkDiariesRepository.createClientSignLink(
      diary!.id,
      creator.id,
      "http://localhost:3000"
    );
    const afterSend = await prisma.workDiary.findUnique({
      where: { id: diary!.id },
      include: { workflowDocument: true },
    });
    const sendArchive = await prisma.document.findFirst({
      where: { sourceType: "work_diary", sourceId: diary!.id },
    });
    report.clientSend = {
      urlPresent: Boolean(link?.url),
      documentNumber: link?.documentNumber,
      wfStatus: afterSend?.workflowDocument?.status,
      archiveFolder: sendArchive?.folderPath,
      archiveStillOne: (await prisma.document.count({
        where: { sourceType: "work_diary", sourceId: diary!.id },
      })) === 1,
    };
  } catch (e: any) {
    report.clientSend = { error: e?.message ?? String(e) };
  }

  report.beforeAll = beforeAll;
  report.final = await snapshot("final");

  console.log("REPORT", JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error("AUDIT_FAIL", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
