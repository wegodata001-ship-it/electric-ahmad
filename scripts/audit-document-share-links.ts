import { prisma } from "../src/lib/prisma";

async function main() {
  const documents = await prisma.document.findMany({
    select: { id: true, url: true, sourceType: true },
  });
  const [external, workDiaries, deliveryNotes, measurementSheets] =
    await Promise.all([
      prisma.externalShareLink.findMany({
        select: {
          id: true,
          entityType: true,
          entityId: true,
          publicId: true,
          tokenHash: true,
          tokenCiphertext: true,
          revokedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      prisma.workDiarySignToken.findMany({
        select: {
          id: true,
          publicId: true,
          tokenHash: true,
          tokenCiphertext: true,
          workDiaryId: true,
        },
      }),
      prisma.opsDeliveryNoteSignToken.findMany({
        select: {
          id: true,
          publicId: true,
          tokenHash: true,
          tokenCiphertext: true,
          opsDeliveryNoteId: true,
        },
      }),
      prisma.measurementSheetSignToken.findMany({
        select: {
          id: true,
          publicId: true,
          tokenHash: true,
          tokenCiphertext: true,
          sheetId: true,
        },
      }),
    ]);

  const unresolvedExternal: Array<{
    id: string;
    entityType: string;
    entityId: string;
    reason: string;
  }> = [];

  for (const link of external) {
    let resolved = false;
    if (link.entityType === "document") {
      resolved = Boolean(
        await prisma.document.findUnique({
          where: { id: link.entityId },
          select: { id: true },
        })
      );
    } else if (link.entityType === "work_diary") {
      resolved = Boolean(
        await prisma.workDiary.findUnique({
          where: { id: link.entityId },
          select: { id: true },
        })
      );
    } else if (
      link.entityType === "delivery_note" ||
      link.entityType === "ops_delivery_note"
    ) {
      resolved = Boolean(
        await prisma.opsDeliveryNote.findUnique({
          where: { id: link.entityId },
          select: { id: true },
        })
      );
    } else if (link.entityType === "measurement_sheet") {
      resolved = Boolean(
        await prisma.measurementSheet.findUnique({
          where: { id: link.entityId },
          select: { id: true },
        })
      );
    }

    if (!resolved) {
      unresolvedExternal.push({
        id: link.id,
        entityType: link.entityType,
        entityId: link.entityId,
        reason: "entity_not_resolved",
      });
    }
  }

  const now = Date.now();
  console.log(
    JSON.stringify(
      {
        auditedAt: new Date().toISOString(),
        external: {
          total: external.length,
          active: external.filter(
            (item) =>
              !item.revokedAt &&
              (!item.expiresAt || item.expiresAt.getTime() >= now)
          ).length,
          revoked: external.filter((item) => item.revokedAt).length,
          expired: external.filter(
            (item) =>
              !item.revokedAt &&
              item.expiresAt &&
              item.expiresAt.getTime() < now
          ).length,
          missingPublicId: external.filter((item) => !item.publicId).length,
          missingTokenHash: external.filter((item) => !item.tokenHash).length,
          unresolved: unresolvedExternal,
          cannotReconstructFullUrl: external.filter(
            (item) => !item.tokenCiphertext
          ).length,
        },
        signatureLinks: {
          workDiary: workDiaries.length,
          deliveryNote: deliveryNotes.length,
          measurementSheet: measurementSheets.length,
          missingPublicId: [
            ...workDiaries,
            ...deliveryNotes,
            ...measurementSheets,
          ].filter((item) => !item.publicId).length,
          missingTokenHash: [
            ...workDiaries,
            ...deliveryNotes,
            ...measurementSheets,
          ].filter((item) => !item.tokenHash).length,
          cannotReconstructFullUrl: [
            ...workDiaries,
            ...deliveryNotes,
            ...measurementSheets,
          ].filter((item) => !item.tokenCiphertext).length,
        },
        documentUrls: {
          total: documents.length,
          localhost: documents.filter((item) =>
            /^https?:\/\/localhost(?::\d+)?\//i.test(item.url)
          ).length,
          relative: documents.filter((item) => item.url.startsWith("/")).length,
          remote: documents.filter(
            (item) =>
              /^https?:\/\//i.test(item.url) &&
              !/^https?:\/\/localhost(?::\d+)?\//i.test(item.url)
          ).length,
        },
      },
      null,
      2
    )
  );
}

void main().finally(() => prisma.$disconnect());
