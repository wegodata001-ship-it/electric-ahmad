/**
 * Live DB checks for the subcontractors domain.
 * Does not mark PASS unless the assertion actually ran against the connected database.
 */
import { prisma } from "../src/lib/prisma";
import { SubcontractorsRepository } from "../src/repositories/subcontractors.repository";
import { SUBCONTRACTOR_ROLE } from "../src/lib/auth/roles";

type Row = { name: string; ok: boolean; detail: string };

async function main() {
  const rows: Row[] = [];
  const mark = (name: string, ok: boolean, detail: string) => {
    rows.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  };

  const actor = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      role: { in: ["SYSTEM_MANAGER", "ADMIN", "admin", "מנהל מערכת"] },
    },
    select: { id: true, role: true },
  });
  const foreman = await prisma.employee.findFirst({
    where: { isDeleted: false, status: "active" },
    select: { id: true },
  });
  let project = await prisma.project.findFirst({
    where: { deletedAt: null },
    select: { id: true, name: true, ownerId: true },
  });
  let createdProjectId: string | null = null;
  if (!actor || !foreman) {
    mark("env", false, "חסר מנהל מערכת או מנהל עבודה במסד — לא ניתן להריץ תרחיש חי");
    print(rows);
    return;
  }
  if (!project) {
    const created = await prisma.project.create({
      data: {
        name: `פרויקט בדיקת קבלנים ${Date.now().toString(36)}`,
        contractNumber: `SC-TEST-${Date.now().toString(36)}`,
        contractor: "לקוח בדיקה",
        location: "אתר בדיקה",
        foremanId: foreman.id,
        contractValue: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        createdById: actor.id,
        updatedById: actor.id,
        ownerId: actor.id,
      },
      select: { id: true, name: true, ownerId: true },
    });
    project = created;
    createdProjectId = created.id;
    mark("env-project", true, `נוצר פרויקט בדיקה זמני ${created.id}`);
  }

  const suffix = Date.now().toString(36);
  const a = await SubcontractorsRepository.create(
    {
      companyName: `קבלן בדיקה A ${suffix}`,
      contactName: "ישראל ישראלי",
      phone: "0500000001",
      email: `sub-a-${suffix}@example.com`,
      specialty: "חשמל",
    },
    actor.id
  );
  mark("create-contractor", Boolean(a.id && a.code.startsWith("SC-")), a.code);

  const b = await SubcontractorsRepository.create(
    {
      companyName: `קבלן בדיקה B ${suffix}`,
      contactName: "משה כהן",
      phone: "0500000002",
      email: `sub-b-${suffix}@example.com`,
    },
    actor.id
  );

  const invite = await SubcontractorsRepository.openAccess(
    a.id,
    { email: `portal-a-${suffix}@example.com`, contactName: "פורטל א" },
    actor.id
  );
  mark(
    "open-access",
    Boolean(invite.activationUrl && invite.userId && !invite.activationUrl.includes("password=")),
    "קישור הפעלה ללא סיסמה"
  );

  const rawToken = new URL(
    invite.activationUrl.startsWith("http")
      ? invite.activationUrl
      : `https://local.test${invite.activationUrl}`
  ).searchParams.get("token");
  if (!rawToken) {
    mark("activate", false, "אין token בקישור");
  } else {
    const activated = await SubcontractorsRepository.activateInvite(rawToken, "TestPass123!");
    const user = await prisma.user.findUnique({
      where: { id: invite.userId },
      select: { passwordHash: true, role: true },
    });
    mark(
      "activate",
      activated.email === `portal-a-${suffix}@example.com` &&
        user?.role === SUBCONTRACTOR_ROLE &&
        Boolean(user.passwordHash) &&
        user.passwordHash !== "TestPass123!",
      "סיסמה נשמרה כ-hash בלבד"
    );
  }

  const assignment = await SubcontractorsRepository.createAssignment(
    {
      subcontractorId: a.id,
      projectId: project.id,
      description: "התקנת נקודות חשמל",
      engagementType: "unit",
    },
    actor.id
  );
  mark("assign-project", Boolean(assignment.id), assignment.id);

  await SubcontractorsRepository.upsertRates(
    a.id,
    assignment.id,
    [{ description: "נקודת חשמל", unit: "יחידה", unitPrice: 80 }],
    actor.id
  );
  const rates = await SubcontractorsRepository.listRates(a.id, assignment.id);
  mark("rates", rates.length === 1 && Number(rates[0]!.unitPrice) === 80, `${rates.length} סעיפים`);

  const aWorks = await SubcontractorsRepository.listAssignments({ subcontractorId: a.id });
  const bWorks = await SubcontractorsRepository.listAssignments({ subcontractorId: b.id });
  mark(
    "isolation-projects",
    aWorks.some((w) => w.projectId === project.id) && bWorks.length === 0,
    `A=${aWorks.length} B=${bWorks.length}`
  );

  const ownerMembership = await prisma.subcontractorUser.findFirst({
    where: { userId: invite.userId },
  });
  const workerInvite = await SubcontractorsRepository.openAccess(
    a.id,
    { email: `worker-a-${suffix}@example.com`, contactName: "עובד א", portalRole: "worker" },
    actor.id
  );
  const workerMembership = await prisma.subcontractorUser.findFirst({
    where: { userId: workerInvite.userId },
  });
  mark(
    "multi-user-roles",
    ownerMembership?.portalRole === "owner" && workerMembership?.portalRole === "worker",
    `owner=${ownerMembership?.portalRole} worker=${workerMembership?.portalRole}`
  );

  const flow = await SubcontractorsRepository.createAssignment(
    {
      subcontractorId: a.id,
      projectId: project.id,
      description: "דיווח ביצוע לאישור",
      engagementType: "unit",
    },
    actor.id
  );
  await SubcontractorsRepository.upsertRates(
    a.id,
    flow.id,
    [{ description: "נקודה", unit: "יחידה", unitPrice: 50 }],
    actor.id
  );
  const ownerAccess = {
    userId: invite.userId,
    role: SUBCONTRACTOR_ROLE,
    subcontractorId: a.id,
    membershipId: ownerMembership!.id,
    portalRole: "owner",
  };
  await SubcontractorsRepository.startWork(flow.id, ownerAccess);
  const started = await SubcontractorsRepository.getAssignmentDetail(flow.id, ownerAccess);
  mark("start-work", started.workStatus === "in_progress", started.workStatus);
  const skip = await SubcontractorsRepository.reviewWork(flow.id, { action: "approve" }, actor.id)
    .then(() => false)
    .catch(() => true);
  mark("no-status-skip", skip, "אי אפשר לאשר לפני הגשה");
  await SubcontractorsRepository.submitWork(
    flow.id,
    {
      workSummary: "בוצעו 4 נקודות",
      workItems: [{ description: "נקודה", unit: "יחידה", quantity: 4 }],
    },
    ownerAccess
  );
  const idor = await SubcontractorsRepository.getAssignmentDetail(flow.id, {
    subcontractorId: b.id,
    membershipId: "x",
    portalRole: "owner",
  })
    .then(() => false)
    .catch(() => true);
  mark("idor-other-contractor", idor, "קבלן B לא פותח עבודה של A");
  const reviewed = await SubcontractorsRepository.reviewWork(flow.id, { action: "approve" }, actor.id);
  const afterReview = await SubcontractorsRepository.listMeasurements({ subcontractorId: a.id });
  mark(
    "approve-creates-measurement",
    reviewed.workStatus === "approved" && afterReview.some((m) => m.status === "approved"),
    reviewed.workStatus
  );

  await SubcontractorsRepository.setUserAccess(a.id, workerMembership!.id, "disabled", actor.id);
  const disabled = await prisma.subcontractorUser.findUnique({
    where: { id: workerMembership!.id },
  });
  mark("disable-access", disabled?.status === "disabled", disabled?.status ?? "missing");

  const measurement = await SubcontractorsRepository.createMeasurement(
    {
      assignmentId: assignment.id,
      items: [
        {
          rateId: rates[0]!.id,
          description: "נקודת חשמל",
          unit: "יחידה",
          reportedQty: 10,
        },
      ],
    },
    { userId: actor.id, subcontractorId: a.id }
  );
  await SubcontractorsRepository.submitMeasurement(measurement.id, actor.id, a.id);
  const approved = await SubcontractorsRepository.reviewMeasurement(
    measurement.id,
    { action: "approve" },
    actor.id
  );
  mark(
    "measurement-approve",
    approved.status === "approved" &&
      approved.items[0]!.approvedQty === 10 &&
      approved.items[0]!.reportedQty === 10,
    `approved=${approved.approvedTotal}`
  );

  const account = await SubcontractorsRepository.createAccount(
    { assignmentId: assignment.id },
    { userId: actor.id, subcontractorId: a.id }
  );
  mark(
    "account-from-approved",
    account.subtotal === 800 && account.items.length === 1,
    `subtotal=${account.subtotal}`
  );

  const again = await SubcontractorsRepository.createAccount(
    { assignmentId: assignment.id },
    { userId: actor.id, subcontractorId: a.id }
  )
    .then(() => false)
    .catch(() => true);
  mark("no-double-bill", again, "חיוב כפול נחסם");

  await SubcontractorsRepository.transitionAccount(account.id, "approve", actor.id);
  try {
    await SubcontractorsRepository.createWorkDiary(
      {
        assignmentId: assignment.id,
        workDate: new Date(),
        workSummary: "בוצעו נקודות בקומת קרקע",
        hours: 4,
      },
      { userId: actor.id, role: actor.role, subcontractorId: a.id }
    );
    const diaries = await SubcontractorsRepository.listWorkDiaries({
      subcontractorId: a.id,
    });
    mark("work-diary", diaries.length >= 1, diaries[0]?.documentNumber ?? "created");
  } catch (e) {
    mark("work-diary", false, e instanceof Error ? e.message : "diary failed");
  }
  await SubcontractorsRepository.recordPayment(
    {
      subcontractorId: a.id,
      accountId: account.id,
      amount: 300,
      paidAt: new Date().toISOString(),
      method: "transfer",
      reference: `REF-${suffix}`,
    },
    actor.id
  );
  const dupPay = await SubcontractorsRepository.recordPayment(
    {
      subcontractorId: a.id,
      accountId: account.id,
      amount: 10,
      paidAt: new Date().toISOString(),
      method: "transfer",
      reference: `REF-${suffix}`,
    },
    actor.id
  )
    .then(() => false)
    .catch(() => true);
  mark("partial-payment-dedup", dupPay, "אסמכתה כפולה נחסמה");

  const afterPay = await SubcontractorsRepository.getAccount(account.id);
  const ledger = await SubcontractorsRepository.ledger(a.id);
  mark(
    "ledger-balance",
    afterPay.paid === 300 &&
      afterPay.remaining === afterPay.payable - 300 &&
      ledger.totals.paid === 300 &&
      ledger.totals.approvedPayable === afterPay.remaining,
    `paid=${ledger.totals.paid} remaining=${ledger.totals.approvedPayable}`
  );

  const otherHome = await SubcontractorsRepository.portalHome(b.id);
  mark(
    "block-other-contractor",
    otherHome.assignments.length === 0 && otherHome.finance.paid === 0,
    "קבלן B לא רואה נתוני A"
  );

  if (createdProjectId) {
    await prisma.project.update({
      where: { id: createdProjectId },
      data: { deletedAt: new Date(), deletionReason: "subcontractor live test cleanup" },
    });
  }

  print(rows);
}

function print(rows: Row[]) {
  const failed = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
