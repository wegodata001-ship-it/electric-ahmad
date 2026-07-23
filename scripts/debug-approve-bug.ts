import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ops = await prisma.user.findFirst({ where: { username: "opsmgr" } });
  if (!ops) throw new Error("no opsmgr");

  const pending = await prisma.workflowApproval.findMany({
    where: { approverId: ops.id, status: "pending" },
    include: { document: true },
  });
  console.log(
    "pending",
    pending.map((x) => ({
      approvalId: x.id,
      wfId: x.documentId,
      kind: x.document.kind,
      status: x.document.status,
      docNum: x.document.documentNumber,
      legacy: x.document.legacyEntityId,
    }))
  );

  const diary = await prisma.workDiary.findFirst({
    where: { documentNumber: "WD-DEMO-0001" },
  });
  console.log("diary", diary);

  // Simulate API via repository
  const { WorkDiariesRepository } = await import(
    "../src/repositories/work-diaries.repository"
  );
  if (!diary) return;
  try {
    const result = await WorkDiariesRepository.decideApproval(
      diary.id,
      ops.id,
      "approved",
      null
    );
    console.log("APPROVE OK", result?.status, result?.documentNumber);
  } catch (e) {
    console.log("APPROVE FAIL", e instanceof Error ? e.message : e);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
