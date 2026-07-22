const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const has = {
    workflowDocument: typeof p.workflowDocument?.findMany === "function",
    workflowApproval: typeof p.workflowApproval?.findMany === "function",
    workflowEvent: typeof p.workflowEvent?.findMany === "function",
    workflowAttachment: typeof p.workflowAttachment?.findMany === "function",
    workDiary: typeof p.workDiary?.findMany === "function",
    workDiaryApproval: typeof p.workDiaryApproval?.findMany === "function",
    workDiaryEvent: typeof p.workDiaryEvent?.findMany === "function",
    document: typeof p.document?.findMany === "function",
  };
  console.log("MODELS", JSON.stringify(has));

  const diaries = await p.workDiary.count({ where: { deletedAt: null } });
  const withWf = await p.workDiary.count({
    where: { deletedAt: null, workflowDocumentId: { not: null } },
  });
  const withoutWf = await p.workDiary.count({
    where: { deletedAt: null, workflowDocumentId: null },
  });
  const wfDiaries = await p.workflowDocument.count({ where: { kind: "WORK_DIARY" } });
  const archive = await p.document.count({ where: { sourceType: "work_diary" } });
  const archiveWithWf = await p.document.count({
    where: { sourceType: "work_diary", workflowDocumentId: { not: null } },
  });
  const legacyAppr = await p.workDiaryApproval.count();
  const legacyEv = await p.workDiaryEvent.count();
  const wfAppr = await p.workflowApproval.count({
    where: { document: { kind: "WORK_DIARY" } },
  });
  const wfEv = await p.workflowEvent.count({
    where: { document: { kind: "WORK_DIARY" } },
  });
  const wfAtt = await p.workflowAttachment.count({
    where: { document: { kind: "WORK_DIARY" } },
  });
  const media = await p.workDiaryMedia.count();
  const att = await p.workDiaryAttachment.count();

  console.log(
    "COUNTS",
    JSON.stringify(
      {
        diaries,
        withWf,
        withoutWf,
        wfDiaries,
        archive,
        archiveWithWf,
        legacyAppr,
        legacyEv,
        wfAppr,
        wfEv,
        wfAtt,
        media,
        att,
      },
      null,
      2
    )
  );

  const samples = await p.workDiary.findMany({
    where: { deletedAt: null },
    include: { workflowDocument: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  for (const s of samples) {
    console.log(
      "SAMPLE",
      JSON.stringify({
        id: s.id,
        documentNumber: s.documentNumber,
        legacyStatus: s.status,
        workflowDocumentId: s.workflowDocumentId,
        wfStatus: s.workflowDocument?.status ?? null,
        wfNumber: s.workflowDocument?.documentNumber ?? null,
        kind: s.workflowDocument?.kind ?? null,
        legacyEntityId: s.workflowDocument?.legacyEntityId ?? null,
        parentDocumentId: s.workflowDocument?.parentDocumentId ?? null,
        sourceDocumentId: s.workflowDocument?.sourceDocumentId ?? null,
        nextDocumentId: s.workflowDocument?.nextDocumentId ?? null,
      })
    );
  }

  const orphans = await p.workflowDocument.findMany({
    where: {
      kind: "WORK_DIARY",
      workDiary: null,
    },
    select: { id: true, documentNumber: true },
    take: 10,
  });
  console.log("ORPHAN_WF", orphans.length, JSON.stringify(orphans));

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
