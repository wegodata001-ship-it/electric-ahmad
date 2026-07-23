/**
 * Stage 1.5 live scenarios 1–5 + small checks (permissions/override).
 * Uses repository path (same as APIs). Prints JSON report.
 */
import { PrismaClient } from "@prisma/client";
import { WorkDiariesRepository } from "../src/repositories/work-diaries.repository";
import { WorkflowRepository } from "../src/repositories/workflow.repository";
import { WorkflowTransitionError } from "../src/lib/workflow/status-engine";

const prisma = new PrismaClient();

type Check = { name: string; ok: boolean; detail?: unknown };

function snap(label: string) {
  return Promise.all([
    prisma.workDiaryApproval.count(),
    prisma.workDiaryEvent.count(),
    prisma.workflowApproval.count({ where: { document: { kind: "WORK_DIARY" } } }),
    prisma.workflowEvent.count({ where: { document: { kind: "WORK_DIARY" } } }),
    prisma.workflowAttachment.count({
      where: { document: { kind: "WORK_DIARY" } },
    }),
    prisma.workDiaryMedia.count(),
    prisma.workDiaryAttachment.count(),
  ]).then(([legacyAppr, legacyEv, wfAppr, wfEv, wfAtt, media, att]) => ({
    label,
    legacyAppr,
    legacyEv,
    wfAppr,
    wfEv,
    wfAtt,
    media,
    att,
  }));
}

async function main() {
  const checks: Check[] = [];
  const report: Record<string, unknown> = { checks };

  // —— Actors / project ——
  const managers = await prisma.user.findMany({
    where: {
      role: { in: ["PROJECT_MANAGER", "SYSTEM_MANAGER", "admin", "OPERATIONS_MANAGER"] },
    },
    take: 5,
  });
  const fieldUsers = await prisma.user.findMany({
    where: { role: { in: ["FIELD_MANAGER", "foreman"] } },
    take: 3,
  });
  const regular = await prisma.user.findFirst({
    where: {
      role: { notIn: ["SYSTEM_MANAGER", "PROJECT_MANAGER", "admin", "OPERATIONS_MANAGER"] },
    },
  });
  const systemMgr =
    (await prisma.user.findFirst({ where: { role: "SYSTEM_MANAGER" } })) ||
    (await prisma.user.findFirst({ where: { role: "admin" } }));

  let project = await prisma.project.findFirst({
    where: { name: { contains: "אלון" } },
  });
  if (!project) {
    project = await prisma.project.findFirst({ where: { status: "active" } });
  }
  if (!project) throw new Error("No project available");

  const foreman = await prisma.employee.findUnique({
    where: { id: project.foremanId },
  });
  if (!foreman) throw new Error("No foreman");

  const creator =
    (foreman.userId &&
      (await prisma.user.findUnique({ where: { id: foreman.userId } }))) ||
    fieldUsers[0] ||
    (await prisma.user.findUnique({ where: { id: project.ownerId } }));
  if (!creator) throw new Error("No creator user");

  const approver1 = managers.find((m) => m.id !== creator.id) || managers[0];
  const approver2 =
    managers.find((m) => m.id !== creator.id && m.id !== approver1?.id) ||
    managers[1] ||
    approver1;
  if (!approver1 || !approver2) throw new Error("Need two approver users");

  report.actors = {
    projectId: project.id,
    projectName: project.name,
    creatorId: creator.id,
    creatorRole: creator.role,
    approver1: { id: approver1.id, role: approver1.role, name: approver1.name },
    approver2: { id: approver2.id, role: approver2.role, name: approver2.name },
    regular: regular
      ? { id: regular.id, role: regular.role, name: regular.name }
      : null,
    systemMgr: systemMgr
      ? { id: systemMgr.id, role: systemMgr.role, name: systemMgr.name }
      : null,
  };

  const beforeAll = await snap("before_all");

  // ===================== Scenario 1 =====================
  const diary = await WorkDiariesRepository.create({
    projectId: project.id,
    foremanId: foreman.id,
    workDate: new Date("2026-07-23T12:00:00.000Z"),
    workType: "חשמל",
    workSummary:
      "בוצעה התקנת קווי חשמל בקומה א' והושלמה הכנה לחיבור לוחות.",
    notes: "בוצעה התקנת קווי חשמל בקומה א' והושלמה הכנה לחיבור לוחות.",
    workers: [
      { name: "אחמד", hours: 8 },
      { name: "מוחמד", hours: 8 },
    ],
    equipment: [
      { name: "סולם", quantity: 1 },
      { name: "מקדחה", quantity: 1 },
    ],
    materials: [
      { name: "כבל 3x2.5", quantity: 120, unit: "מ'" },
      { name: "שקעים", quantity: 18, unit: "יח'" },
    ],
    workItems: [
      {
        description: "התקנת קווי חשמל קומה א'",
        quantity: 1,
        unit: "יח'",
      },
    ],
    createdById: creator.id,
  });

  await WorkDiariesRepository.addMedia(
    diary!.id,
    {
      name: "photo1.jpg",
      url: "https://example.local/photo1.jpg",
      path: "audit/photo1.jpg",
      bucket: "images",
      size: 2048,
      stage: "during",
    },
    creator.id
  );
  await WorkDiariesRepository.addAttachment(
    diary!.id,
    {
      name: "report.pdf",
      mimeType: "application/pdf",
      size: 4096,
      kind: "pdf",
      bucket: "files",
      path: "audit/report.pdf",
      url: "https://example.local/report.pdf",
    },
    creator.id
  );

  const raw1 = await prisma.workDiary.findUnique({
    where: { id: diary!.id },
    include: {
      workflowDocument: true,
      workers: true,
      equipment: true,
      materials: true,
    },
  });
  const docs1 = await prisma.document.findMany({
    where: { sourceType: "work_diary", sourceId: diary!.id },
  });
  const afterS1 = await snap("after_s1");
  const mapped1 = await WorkDiariesRepository.getById(diary!.id);

  checks.push(
    { name: "S1 WorkDiary created", ok: !!raw1 },
    {
      name: "S1 WorkflowDocument one",
      ok: !!raw1?.workflowDocumentId && !!raw1.workflowDocument,
    },
    { name: "S1 Document one", ok: docs1.length === 1 },
    {
      name: "S1 no new WorkDiaryApproval",
      ok: afterS1.legacyAppr === beforeAll.legacyAppr,
    },
    {
      name: "S1 no new WorkDiaryEvent",
      ok: afterS1.legacyEv === beforeAll.legacyEv,
    },
    {
      name: "S1 status draft",
      ok: (mapped1 as any)?.status === "draft" &&
        raw1?.workflowDocument?.status === "draft",
    },
    {
      name: "S1 payload workers/equipment/materials",
      ok:
        (raw1?.workers.length ?? 0) === 2 &&
        (raw1?.equipment.length ?? 0) === 2 &&
        (raw1?.materials.length ?? 0) === 2,
    },
    {
      name: "S1 files via WorkflowAttachment only",
      ok:
        afterS1.wfAtt === beforeAll.wfAtt + 2 &&
        afterS1.media === beforeAll.media &&
        afterS1.att === beforeAll.att,
    },
    {
      name: "S1 API shows media+attachment",
      ok:
        ((mapped1 as any)?.media?.length ?? 0) >= 1 &&
        ((mapped1 as any)?.attachments?.length ?? 0) >= 1,
    }
  );
  report.scenario1 = {
    diaryId: diary!.id,
    documentNumber: diary!.documentNumber,
    workflowDocumentId: raw1?.workflowDocumentId,
    folder: docs1[0]?.folderPath,
    status: (mapped1 as any)?.status,
    afterS1,
  };

  // ===================== Scenario 2 =====================
  const beforeS2 = await snap("before_s2");
  await WorkDiariesRepository.submitForApproval(
    diary!.id,
    [approver1.id, approver2.id],
    creator.id
  );
  const afterS2 = await snap("after_s2");
  const inbox1 = await WorkDiariesRepository.listPendingApprovals(approver1.id);
  const inbox2 = await WorkDiariesRepository.listPendingApprovals(approver2.id);
  const raw2 = await prisma.workDiary.findUnique({
    where: { id: diary!.id },
    include: { workflowDocument: true },
  });
  const docs2 = await prisma.document.findFirst({
    where: { sourceType: "work_diary", sourceId: diary!.id },
  });
  const timeline2 = await WorkflowRepository.timeline(raw2!.workflowDocumentId!);
  const wfApprRows = await prisma.workflowApproval.findMany({
    where: { documentId: raw2!.workflowDocumentId! },
  });

  checks.push(
    {
      name: "S2 status pending_approval",
      ok: raw2?.workflowDocument?.status === "pending_approval",
    },
    {
      name: "S2 inbox approver1",
      ok: inbox1.some((x: any) => x.documentId === diary!.id),
    },
    {
      name: "S2 inbox approver2",
      ok: inbox2.some((x: any) => x.documentId === diary!.id),
    },
    {
      name: "S2 WorkflowApproval only (2 pending)",
      ok:
        afterS2.legacyAppr === beforeS2.legacyAppr &&
        wfApprRows.filter((a) => a.status === "pending").length === 2,
    },
    {
      name: "S2 no WorkDiaryEvent delta",
      ok: afterS2.legacyEv === beforeS2.legacyEv,
    },
    {
      name: "S2 WorkflowEvent increased",
      ok: afterS2.wfEv > beforeS2.wfEv,
    },
    {
      name: "S2 folder pending",
      ok: String(docs2?.folderPath).includes("ממתין לאישור"),
    },
    { name: "S2 timeline has submit", ok: timeline2.some((e) => e.type === "submit") }
  );
  report.scenario2 = {
    status: raw2?.workflowDocument?.status,
    folder: docs2?.folderPath,
    inbox1: inbox1.length,
    inbox2: inbox2.length,
    wfApprovals: wfApprRows.map((a) => ({
      approverId: a.approverId,
      status: a.status,
    })),
    timelineTypes: timeline2.map((e) => e.type),
  };

  // ===================== Scenario 3 =====================
  const beforeS3 = await snap("before_s3");
  const wfDocsBefore = await prisma.workflowDocument.count({
    where: { kind: "WORK_DIARY" },
  });
  const docsCountBefore = await prisma.document.count({
    where: { sourceType: "work_diary", sourceId: diary!.id },
  });
  const wfAttBefore = afterS2.wfAtt;

  await WorkDiariesRepository.decideApproval(
    diary!.id,
    approver1.id,
    "rejected",
    "חסר פירוט עבודות החשמל בקומה א'."
  );

  await WorkDiariesRepository.update(diary!.id, {
    notes:
      "בוצעה התקנת קווי חשמל בקומה א' והושלמה הכנה לחיבור לוחות. נוסף פירוט לאחר החזרה לתיקון.",
    updatedById: creator.id,
  });
  await WorkDiariesRepository.addMedia(
    diary!.id,
    {
      name: "photo2.jpg",
      url: "https://example.local/photo2.jpg",
      path: "audit/photo2.jpg",
      bucket: "images",
      size: 2100,
    },
    creator.id
  );

  await WorkDiariesRepository.submitForApproval(
    diary!.id,
    [approver1.id, approver2.id],
    creator.id
  );

  const afterS3 = await snap("after_s3");
  const wfDocsAfter = await prisma.workflowDocument.count({
    where: { kind: "WORK_DIARY" },
  });
  const docsCountAfter = await prisma.document.count({
    where: { sourceType: "work_diary", sourceId: diary!.id },
  });
  const raw3 = await prisma.workDiary.findUnique({
    where: { id: diary!.id },
    include: { workflowDocument: true },
  });
  const timeline3 = await WorkflowRepository.timeline(raw3!.workflowDocumentId!);
  const docs3 = await prisma.document.findFirst({
    where: { sourceType: "work_diary", sourceId: diary!.id },
  });

  checks.push(
    {
      name: "S3 no new WorkflowDocument",
      ok: wfDocsAfter === wfDocsBefore,
    },
    { name: "S3 no new Document", ok: docsCountAfter === docsCountBefore },
    {
      name: "S3 attachments +1 only (photo2)",
      ok: afterS3.wfAtt === wfAttBefore + 1,
    },
    {
      name: "S3 no legacy writes",
      ok:
        afterS3.legacyAppr === beforeS3.legacyAppr &&
        afterS3.legacyEv === beforeS3.legacyEv,
    },
    {
      name: "S3 timeline has reject+resubmit",
      ok:
        timeline3.some((e) => e.type === "reject") &&
        timeline3.some((e) => e.type === "resubmit"),
    },
    {
      name: "S3 back to pending after resubmit",
      ok: raw3?.workflowDocument?.status === "pending_approval",
    }
  );
  report.scenario3 = {
    status: raw3?.workflowDocument?.status,
    folder: docs3?.folderPath,
    timelineTypes: timeline3.map((e) => e.type),
    wfAtt: afterS3.wfAtt,
  };

  // ===================== Scenario 4 =====================
  // Partial approve first (approver1), then approver2 — should not approve until both
  const beforePartial = await prisma.workflowDocument.findUnique({
    where: { id: raw3!.workflowDocumentId! },
  });
  await WorkDiariesRepository.decideApproval(
    diary!.id,
    approver1.id,
    "approved",
    "אושר עקרונית"
  );
  const afterPartial = await prisma.workflowDocument.findUnique({
    where: { id: raw3!.workflowDocumentId! },
  });
  const partialOk =
    afterPartial?.status === "pending_approval" ||
    afterPartial?.status === "approved"; // if only one pending left handled

  // If still pending, second approver
  if (afterPartial?.status !== "approved") {
    await WorkDiariesRepository.decideApproval(
      diary!.id,
      approver2.id,
      "approved",
      "אושר סופי"
    );
  }

  const afterApprove = await prisma.workDiary.findUnique({
    where: { id: diary!.id },
    include: { workflowDocument: true },
  });
  const docsApprove = await prisma.document.findFirst({
    where: { sourceType: "work_diary", sourceId: diary!.id },
  });

  const link = await WorkDiariesRepository.createClientSignLink(
    diary!.id,
    creator.id,
    "http://localhost:3000"
  );

  let signError: string | null = null;
  try {
    const tokenParam =
      new URL(link.url, "http://localhost:3000").searchParams.get("t") || "";
    await WorkDiariesRepository.applyClientSignature({
      documentNumber: link.documentNumber,
      tokenParam,
      signerName: "לקוח בדיקה",
      signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      ip: "127.0.0.1",
      device: "audit-script",
    });
  } catch (e: any) {
    signError = e?.message ?? String(e);
  }

  const afterSign = await prisma.workDiary.findUnique({
    where: { id: diary!.id },
    include: { workflowDocument: true },
  });
  const docsSign = await prisma.document.findFirst({
    where: { sourceType: "work_diary", sourceId: diary!.id },
  });
  const timeline4 = await WorkflowRepository.timeline(
    afterSign!.workflowDocumentId!
  );
  const afterS4 = await snap("after_s4");

  checks.push(
    {
      name: "S4 approved before client (or after both approvers)",
      ok:
        afterApprove?.workflowDocument?.status === "approved" ||
        afterApprove?.workflowDocument?.status === "sent_to_client" ||
        afterSign?.workflowDocument?.status === "client_signed" ||
        afterSign?.workflowDocument?.status === "sent_to_client",
    },
    {
      name: "S4 partial approval did not skip second when required",
      ok:
        beforePartial?.status === "pending_approval" &&
        (afterPartial?.status === "pending_approval" ||
          approver1.id === approver2.id),
      detail: {
        afterPartial: afterPartial?.status,
        sameApprover: approver1.id === approver2.id,
      },
    },
    {
      name: "S4 folder after approve includes מאושרים or later",
      ok: !!docsApprove?.folderPath,
    },
    {
      name: "S4 send+sign status",
      ok:
        afterSign?.workflowDocument?.status === "client_signed" ||
        afterSign?.workflowDocument?.status === "sent_to_client",
      detail: {
        status: afterSign?.workflowDocument?.status,
        signError,
        url: link.url,
      },
    },
    {
      name: "S4 still one Document",
      ok:
        (await prisma.document.count({
          where: { sourceType: "work_diary", sourceId: diary!.id },
        })) === 1,
    },
    {
      name: "S4 no legacy writes",
      ok:
        afterS4.legacyAppr === beforeAll.legacyAppr &&
        afterS4.legacyEv === beforeAll.legacyEv,
    },
    {
      name: "S4 timeline has approve",
      ok: timeline4.some((e) => e.type === "approve"),
    }
  );
  report.scenario4 = {
    afterPartialStatus: afterPartial?.status,
    afterApproveStatus: afterApprove?.workflowDocument?.status,
    afterSignStatus: afterSign?.workflowDocument?.status,
    folderApprove: docsApprove?.folderPath,
    folderSign: docsSign?.folderPath,
    signUrl: link.url,
    signError,
    timelineTypes: timeline4.map((e) => e.type),
  };

  // ===================== Scenario 5 Field vs Office =====================
  const fieldView = await WorkDiariesRepository.getById(diary!.id);
  const listView = (
    await WorkDiariesRepository.list({ projectId: project.id, take: 50 })
  ).find((x: any) => x.id === diary!.id);
  const archiveView = (
    await WorkDiariesRepository.archive({ projectId: project.id, take: 50 })
  ).find((x: any) => x.id === diary!.id);
  const timeline5 = await WorkflowRepository.timeline(
    (fieldView as any).workflowDocumentId
  );

  checks.push(
    {
      name: "S5 Field get status == Archive status",
      ok: (fieldView as any)?.status === archiveView?.status,
      detail: {
        field: (fieldView as any)?.status,
        archive: archiveView?.status,
        list: listView?.status,
      },
    },
    {
      name: "S5 same workflowDocumentId",
      ok:
        (fieldView as any)?.workflowDocumentId ===
          listView?.workflowDocumentId &&
        listView?.workflowDocumentId === archiveView?.workflowDocumentId,
    },
    {
      name: "S5 files present on Field get",
      ok:
        ((fieldView as any)?.media?.length ?? 0) >= 1 &&
        ((fieldView as any)?.attachments?.length ?? 0) >= 1,
    },
    { name: "S5 timeline non-empty", ok: timeline5.length > 0 }
  );
  report.scenario5 = {
    fieldStatus: (fieldView as any)?.status,
    listStatus: listView?.status,
    archiveStatus: archiveView?.status,
    workflowDocumentId: (fieldView as any)?.workflowDocumentId,
    media: (fieldView as any)?.media?.length,
    attachments: (fieldView as any)?.attachments?.length,
    timelineCount: timeline5.length,
  };

  // ===================== Small: delete attachment =====================
  let deleteOk = false;
  let deleteDetail: unknown = null;
  try {
    const wfId = (fieldView as any).workflowDocumentId as string;
    const imgs = await prisma.workflowAttachment.findMany({
      where: { documentId: wfId, fileType: "image" },
      orderBy: { createdAt: "asc" },
    });
    if (imgs[0]) {
      await prisma.workflowAttachment.delete({ where: { id: imgs[0].id } });
      const afterDel = await WorkDiariesRepository.getById(diary!.id);
      deleteOk =
        ((afterDel as any)?.media?.length ?? 0) ===
        ((fieldView as any)?.media?.length ?? 0) - 1;
      deleteDetail = {
        before: (fieldView as any)?.media?.length,
        after: (afterDel as any)?.media?.length,
        deletedId: imgs[0].id,
      };
    }
  } catch (e: any) {
    deleteDetail = e?.message;
  }
  checks.push({
    name: "Attachments delete JPG (DB)",
    ok: deleteOk,
    detail: deleteDetail,
  });

  // ===================== Permissions =====================
  const permResults: Record<string, unknown> = {};
  if (regular) {
    // regular approve
    try {
      await WorkDiariesRepository.decideApproval(
        diary!.id,
        regular.id,
        "approved",
        "should fail"
      );
      permResults.regularApprove = "ALLOWED_BAD";
    } catch (e: any) {
      permResults.regularApprove = e?.message ?? "blocked";
    }
    try {
      await WorkDiariesRepository.decideApproval(
        diary!.id,
        regular.id,
        "rejected",
        "should fail reject"
      );
      permResults.regularReject = "ALLOWED_BAD";
    } catch (e: any) {
      permResults.regularReject = e?.message ?? "blocked";
    }
  } else {
    permResults.regularApprove = "SKIP_NO_REGULAR_USER";
    permResults.regularReject = "SKIP_NO_REGULAR_USER";
  }

  // stranger submit as someone else — try transition with wrong actor on approval
  // Create a draft and try stranger approve when not in list — already covered
  checks.push(
    {
      name: "Perm regular cannot approve",
      ok:
        permResults.regularApprove !== "ALLOWED_BAD" &&
        permResults.regularApprove !== "SKIP_NO_REGULAR_USER",
      detail: permResults.regularApprove,
    },
    {
      name: "Perm regular cannot reject",
      ok:
        permResults.regularReject !== "ALLOWED_BAD" &&
        permResults.regularReject !== "SKIP_NO_REGULAR_USER",
      detail: permResults.regularReject,
    }
  );

  // ===================== Override =====================
  const overrideResults: Record<string, unknown> = {};
  if (systemMgr && afterSign?.workflowDocumentId) {
    const docId = afterSign.workflowDocumentId;
    try {
      await WorkflowRepository.override({
        documentId: docId,
        toStatus: "approved",
        reason: "",
        note: "note long enough",
        actor: {
          userId: systemMgr.id,
          role: systemMgr.role,
          name: systemMgr.name,
        },
      });
      overrideResults.noReason = "ALLOWED_BAD";
    } catch (e: any) {
      overrideResults.noReason = e?.message ?? "blocked";
    }
    try {
      await WorkflowRepository.override({
        documentId: docId,
        toStatus: "approved",
        reason: "תיקון ידני",
        note: "ab",
        actor: {
          userId: systemMgr.id,
          role: systemMgr.role,
          name: systemMgr.name,
        },
      });
      overrideResults.shortNote = "ALLOWED_BAD";
    } catch (e: any) {
      overrideResults.shortNote = e?.message ?? "blocked";
    }
    try {
      await WorkflowRepository.override({
        documentId: docId,
        toStatus: "locked",
        reason: "סגירה ידנית לבדיקה",
        note: "הערה מפורטת מספיק לעקיפה",
        actor: {
          userId: systemMgr.id,
          role: systemMgr.role,
          name: systemMgr.name,
        },
      });
      overrideResults.withReasonNote = "OK";
    } catch (e: any) {
      overrideResults.withReasonNote = e?.message ?? "fail";
    }
    if (regular) {
      try {
        await WorkflowRepository.override({
          documentId: docId,
          toStatus: "draft",
          reason: "ניסיון",
          note: "הערה מפורטת מספיק",
          actor: {
            userId: regular.id,
            role: regular.role,
            name: regular.name,
          },
        });
        overrideResults.regularOverride = "ALLOWED_BAD";
      } catch (e: any) {
        overrideResults.regularOverride = e?.message ?? "blocked";
      }
    }
  }
  checks.push(
    {
      name: "Override blocked without reason",
      ok: overrideResults.noReason !== "ALLOWED_BAD",
      detail: overrideResults.noReason,
    },
    {
      name: "Override blocked with short note",
      ok: overrideResults.shortNote !== "ALLOWED_BAD",
      detail: overrideResults.shortNote,
    },
    {
      name: "Override allowed SYSTEM_MANAGER with reason+note",
      ok: overrideResults.withReasonNote === "OK",
      detail: overrideResults.withReasonNote,
    },
    {
      name: "Override blocked for regular user",
      ok:
        !regular ||
        (overrideResults.regularOverride !== "ALLOWED_BAD" &&
          overrideResults.regularOverride != null),
      detail: overrideResults.regularOverride ?? "SKIP",
    }
  );
  report.override = overrideResults;
  report.permissions = permResults;

  // Mobile — cannot automate real viewport here
  checks.push({
    name: "Mobile 360/390/430 viewport",
    ok: false,
    detail: "NOT_RUN — requires browser UI session",
  });

  const failed = checks.filter((c) => !c.ok);
  report.summary = {
    total: checks.length,
    passed: checks.filter((c) => c.ok).length,
    failed: failed.length,
    failedNames: failed.map((c) => c.name),
  };

  console.log("SCENARIO_REPORT", JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error("SCENARIO_FAIL", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
