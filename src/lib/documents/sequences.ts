import { prisma } from "@/lib/prisma";
import type { FieldDocKind } from "@prisma/client";

const PREFIX: Record<FieldDocKind, string> = {
  work_diary: "WD",
  delivery_note: "DN",
};

function formatNumber(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(6, "0")}`;
}

/**
 * Allocates the next document number atomically.
 * Numbers are never reused — soft-deleted docs keep their number in history.
 */
export async function allocateDocumentNumber(kind: FieldDocKind): Promise<{
  documentNumber: string;
  sequenceNumber: number;
  prefix: string;
}> {
  const prefix = PREFIX[kind];

  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.documentNumberSequence.findUnique({
      where: { documentKind: kind },
    });

    if (!existing) {
      return tx.documentNumberSequence.create({
        data: { documentKind: kind, prefix, lastNumber: 1 },
      });
    }

    return tx.documentNumberSequence.update({
      where: { documentKind: kind },
      data: { lastNumber: { increment: 1 } },
    });
  });

  return {
    documentNumber: formatNumber(prefix, row.lastNumber),
    sequenceNumber: row.lastNumber,
    prefix,
  };
}

export async function peekNextDocumentNumber(kind: FieldDocKind): Promise<string> {
  const prefix = PREFIX[kind];
  const existing = await prisma.documentNumberSequence.findUnique({
    where: { documentKind: kind },
  });
  const next = (existing?.lastNumber ?? 0) + 1;
  return formatNumber(prefix, next);
}

export function workDiaryStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "טיוטה",
    pending_approval: "ממתין לאישור",
    in_approval: "בתהליך אישור",
    approved: "אושר",
    sent_to_client: "נשלח ללקוח",
    signed: "נחתם",
    completed: "הושלם",
    revision: "טיוטה לתיקון",
  };
  return map[status] ?? status;
}

export function opsDnStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "טיוטה",
    pending_approval: "ממתין לאישור",
    approved: "אושר",
    sent_to_client: "נשלח ללקוח",
    signed: "נחתם",
    closed: "נסגר",
    revision: "טיוטה לתיקון",
  };
  return map[status] ?? status;
}

/** Editable only in draft / revision */
export function isDocEditableStatus(status: string): boolean {
  return status === "draft" || status === "revision";
}
