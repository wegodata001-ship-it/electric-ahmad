/**
 * Follow-up: dual approvers + permissions + override with seeded actors.
 */
import { PrismaClient } from "@prisma/client";
import { WorkDiariesRepository } from "../src/repositories/work-diaries.repository";
import { WorkflowRepository } from "../src/repositories/workflow.repository";

const prisma = new PrismaClient();

async function ensureUser(email: string, name: string, role: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { role, name },
    });
  }
  return prisma.user.create({
    data: {
      email,
      name,
      role,
      passwordHash: null,
    },
  });
}

async function main() {
  const checks: { name: string; ok: boolean; detail?: unknown }[] = [];

  const baseProject = await prisma.project.findFirst({
    where: { status: "active" },
  });
  if (!baseProject) throw new Error("no project");

  const field =
    (await prisma.user.findFirst({ where: { role: "FIELD_MANAGER" } })) ||
    (await ensureUser("field.scenario@audit.local", "Field Scenario", "FIELD_MANAGER"));

  const pm1 = await ensureUser(
    "pm1.scenario@audit.local",
    "מנהל א",
    "PROJECT_MANAGER"
  );
  const pm2 = await ensureUser(
    "pm2.scenario@audit.local",
    "מנהל ב",
    "PROJECT_MANAGER"
  );
  const sys = await ensureUser(
    "sys.scenario@audit.local",
    "מנהל מערכת",
    "SYSTEM_MANAGER"
  );
  const regular = await ensureUser(
    "regular.scenario@audit.local",
    "משתמש רגיל",
    "viewer"
  );

  // Prefer rename/create אלון project
  let project = await prisma.project.findFirst({
    where: { name: { contains: "אלון" } },
  });
  if (!project) {
    const stamp = Date.now();
    project = await prisma.project.create({
      data: {
        name: "בית ספר אלון",
        contractNumber: `ALON-${stamp}`,
        contractor: "קבלן אלון",
        location: "רחוב האלונים 1",
        foremanId: baseProject.foremanId,
        contractValue: 100000,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        ownerId: pm1.id,
        createdById: pm1.id,
        updatedById: pm1.id,
        status: "active",
      },
    });
  }

  const diary = await WorkDiariesRepository.create({
    projectId: project.id,
    foremanId: project.foremanId,
    workDate: new Date("2026-07-23T12:00:00.000Z"),
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
    createdById: field.id,
  });

  await WorkDiariesRepository.submitForApproval(
    diary!.id,
    [pm1.id, pm2.id],
    field.id
  );

  const wfId = (await prisma.workDiary.findUnique({ where: { id: diary!.id } }))!
    .workflowDocumentId!;
  const pending = await prisma.workflowApproval.findMany({
    where: { documentId: wfId, status: "pending" },
  });
  checks.push({
    name: "Two distinct WorkflowApprovals",
    ok: pending.length === 2 && new Set(pending.map((p) => p.approverId)).size === 2,
    detail: pending.map((p) => p.approverId),
  });

  const inbox1 = await WorkDiariesRepository.listPendingApprovals(pm1.id);
  const inbox2 = await WorkDiariesRepository.listPendingApprovals(pm2.id);
  checks.push({
    name: "Both manager inboxes",
    ok:
      inbox1.some((x: any) => x.documentId === diary!.id) &&
      inbox2.some((x: any) => x.documentId === diary!.id),
  });

  // Permissions while pending
  let regularApprove = "";
  try {
    await WorkDiariesRepository.decideApproval(
      diary!.id,
      regular.id,
      "approved",
      "no"
    );
    regularApprove = "ALLOWED_BAD";
  } catch (e: any) {
    regularApprove = e?.message ?? "blocked";
  }
  let regularReject = "";
  try {
    await WorkDiariesRepository.decideApproval(
      diary!.id,
      regular.id,
      "rejected",
      "should block"
    );
    regularReject = "ALLOWED_BAD";
  } catch (e: any) {
    regularReject = e?.message ?? "blocked";
  }
  checks.push(
    {
      name: "Regular blocked approve while pending",
      ok: regularApprove !== "ALLOWED_BAD",
      detail: regularApprove,
    },
    {
      name: "Regular blocked reject while pending",
      ok: regularReject !== "ALLOWED_BAD",
      detail: regularReject,
    }
  );

  // Partial then full approve
  await WorkDiariesRepository.decideApproval(diary!.id, pm1.id, "approved", "חלקי");
  const mid = await prisma.workflowDocument.findUnique({ where: { id: wfId } });
  checks.push({
    name: "Partial approve stays pending",
    ok: mid?.status === "pending_approval",
    detail: mid?.status,
  });
  await WorkDiariesRepository.decideApproval(diary!.id, pm2.id, "approved", "סופי");
  const full = await prisma.workflowDocument.findUnique({ where: { id: wfId } });
  checks.push({
    name: "Second approve -> approved",
    ok: full?.status === "approved",
    detail: full?.status,
  });

  // Override tests
  let noReason = "";
  try {
    await WorkflowRepository.override({
      documentId: wfId,
      toStatus: "locked",
      reason: "",
      note: "הערה ארוכה מספיק",
      actor: { userId: sys.id, role: sys.role, name: sys.name },
    });
    noReason = "ALLOWED_BAD";
  } catch (e: any) {
    noReason = e?.message ?? "blocked";
  }
  let shortNote = "";
  try {
    await WorkflowRepository.override({
      documentId: wfId,
      toStatus: "locked",
      reason: "סיבה",
      note: "קצר",
      actor: { userId: sys.id, role: sys.role, name: sys.name },
    });
    shortNote = "ALLOWED_BAD";
  } catch (e: any) {
    shortNote = e?.message ?? "blocked";
  }
  let okOverride = "";
  try {
    await WorkflowRepository.override({
      documentId: wfId,
      toStatus: "locked",
      reason: "סגירה ידנית",
      note: "הערה מפורטת לעקיפת workflow",
      actor: { userId: sys.id, role: sys.role, name: sys.name },
    });
    okOverride = "OK";
  } catch (e: any) {
    okOverride = e?.message ?? "fail";
  }
  let regularOverride = "";
  try {
    await WorkflowRepository.override({
      documentId: wfId,
      toStatus: "draft",
      reason: "ניסיון",
      note: "הערה מפורטת מספיק",
      actor: { userId: regular.id, role: regular.role, name: regular.name },
    });
    regularOverride = "ALLOWED_BAD";
  } catch (e: any) {
    regularOverride = e?.message ?? "blocked";
  }

  const afterOverride = await prisma.workflowDocument.findUnique({
    where: { id: wfId },
    include: { events: { orderBy: { createdAt: "desc" }, take: 3 } },
  });

  checks.push(
    { name: "Override no reason blocked", ok: noReason !== "ALLOWED_BAD", detail: noReason },
    { name: "Override short note blocked", ok: shortNote !== "ALLOWED_BAD", detail: shortNote },
    {
      name: "Override SYSTEM_MANAGER ok",
      ok: okOverride === "OK" && afterOverride?.status === "locked",
      detail: { okOverride, status: afterOverride?.status },
    },
    {
      name: "Override regular blocked",
      ok: regularOverride !== "ALLOWED_BAD",
      detail: regularOverride,
    },
    {
      name: "Override appears in timeline/events",
      ok: (afterOverride?.events ?? []).some((e) =>
        String(e.type).toLowerCase().includes("override")
      ),
      detail: (afterOverride?.events ?? []).map((e) => e.type),
    }
  );

  const failed = checks.filter((c) => !c.ok);
  console.log(
    JSON.stringify(
      {
        project: { id: project.id, name: project.name },
        diary: { id: diary!.id, documentNumber: diary!.documentNumber, wfId },
        actors: {
          field: field.id,
          pm1: pm1.id,
          pm2: pm2.id,
          sys: sys.id,
          regular: regular.id,
        },
        checks,
        summary: {
          passed: checks.filter((c) => c.ok).length,
          failed: failed.length,
          failedNames: failed.map((c) => c.name),
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
