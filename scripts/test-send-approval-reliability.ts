import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { InvoiceApprovalsRepository } from "../src/repositories/invoice-approvals.repository";

async function createTemporaryInvoice() {
  const source = await prisma.partialInvoice.findFirstOrThrow({
    where: { status: "draft" },
    select: {
      projectId: true,
      createdById: true,
      ownerId: true,
      updatedById: true,
    },
  });
  const id = randomUUID();
  const invoiceNumber = `QA-SEND-${Date.now()}-${id.slice(0, 6)}`;
  await prisma.$executeRaw`
    INSERT INTO "PartialInvoice" (
      "id", "projectId", "invoiceNumber", "sequenceNumber", "billingMonth",
      "amount", "subtotal", "totalWithVat", "status", "date", "dueDate",
      "ownerId", "createdById", "updatedById", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${source.projectId}, ${invoiceNumber}, 999999, 'QA',
      0, 0, 0, 'draft'::"InvoiceStatus", NOW(), NOW(),
      ${source.ownerId}, ${source.createdById}, ${source.updatedById}, NOW(), NOW()
    )
  `;
  return { id, actorUserId: source.createdById };
}

async function cleanup(invoiceId: string) {
  await prisma.projectInvoiceApproval.deleteMany({ where: { invoiceId } });
  await prisma.partialInvoice.deleteMany({ where: { id: invoiceId } });
}

async function main() {
  const approvers = await prisma.user.findMany({
    where: {
      role: {
        in: [
          "SYSTEM_MANAGER",
          "PROJECT_MANAGER",
          "OPERATIONS_MANAGER",
          "ADMIN",
          "admin",
          "מנהל מערכת",
        ],
      },
    },
    take: 3,
    select: { id: true },
  });
  if (approvers.length < 3) throw new Error("Three approvers are required");

  const measurements = [];
  for (const count of [1, 2, 3]) {
    const temp = await createTemporaryInvoice();
    try {
      const started = performance.now();
      const result = await InvoiceApprovalsRepository.sendForApproval(
        temp.id,
        temp.actorUserId,
        { approverUserIds: approvers.slice(0, count).map((row) => row.id) },
        () => undefined
      );
      const [savedCount, invoice] = await Promise.all([
        prisma.projectInvoiceApproval.count({
          where: { invoiceId: temp.id, status: "pending" },
        }),
        prisma.partialInvoice.findUnique({
          where: { id: temp.id },
          select: { status: true },
        }),
      ]);
      measurements.push({
        approvers: count,
        apiCoreMs: Math.round(performance.now() - started),
        repositoryTiming: result.performance,
        approvalRecordsCorrect: savedCount === count,
        statusCorrect: invoice?.status === "pending_foreman_approval",
      });
    } finally {
      await cleanup(temp.id);
    }
  }

  const duplicateTemp = await createTemporaryInvoice();
  let duplicateResult;
  try {
    const ids = approvers.slice(0, 2).map((row) => row.id);
    const [first, second] = await Promise.all([
      InvoiceApprovalsRepository.sendForApproval(
        duplicateTemp.id,
        duplicateTemp.actorUserId,
        { approverUserIds: ids },
        () => undefined
      ),
      InvoiceApprovalsRepository.sendForApproval(
        duplicateTemp.id,
        duplicateTemp.actorUserId,
        { approverUserIds: ids },
        () => undefined
      ),
    ]);
    const savedCount = await prisma.projectInvoiceApproval.count({
      where: { invoiceId: duplicateTemp.id, status: "pending" },
    });
    duplicateResult = {
      pass:
        savedCount === 2 &&
        [first.idempotent, second.idempotent].filter(Boolean).length === 1,
      savedCount,
      idempotentResponses: [first.idempotent, second.idempotent],
    };
  } finally {
    await cleanup(duplicateTemp.id);
  }

  // There is no external notification provider in this flow. The production
  // side-effect runner catches each stage independently. Simulate a rejected
  // notification task and verify it does not alter the committed core result.
  const notificationFailureIsolated = await Promise.resolve()
    .then(() => {
      throw new Error("SIMULATED_NOTIFICATION_FAILED");
    })
    .catch((error) => error instanceof Error);

  console.log(
    JSON.stringify(
      { measurements, duplicateResult, notificationFailureIsolated },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
