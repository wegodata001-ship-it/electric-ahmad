/**
 * Reset WD-DEMO-0001 to pending with Operations Manager as sole approver.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ops = await prisma.user.findFirst({ where: { username: "opsmgr" } });
  if (!ops) throw new Error("opsmgr missing");

  const diary = await prisma.workDiary.findFirst({
    where: { documentNumber: "WD-DEMO-0001" },
  });
  if (!diary?.workflowDocumentId) throw new Error("WD-DEMO-0001 missing");

  const wfId = diary.workflowDocumentId;

  await prisma.workflowDocument.update({
    where: { id: wfId },
    data: { status: "pending_approval", updatedById: ops.id },
  });

  await prisma.workDiary.update({
    where: { id: diary.id },
    data: { status: "pending_approval", updatedById: ops.id },
  });

  await prisma.workflowApproval.updateMany({
    where: { documentId: wfId },
    data: { status: "cancelled", decidedAt: new Date() },
  });

  await prisma.workflowApproval.create({
    data: {
      documentId: wfId,
      approverId: ops.id,
      status: "pending",
    },
  });

  await prisma.workDiaryApproval.updateMany({
    where: { workDiaryId: diary.id },
    data: { status: "cancelled", decidedAt: new Date() },
  });
  await prisma.workDiaryApproval.create({
    data: {
      workDiaryId: diary.id,
      approverId: ops.id,
      status: "pending",
    },
  });

  console.log("Reset OK — opsmgr can Approve WD-DEMO-0001 alone");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
