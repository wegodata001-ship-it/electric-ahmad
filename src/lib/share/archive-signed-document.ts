import { prisma } from "@/lib/prisma";
import { AuditRepository } from "@/repositories/audit.repository";

export type SignedDocKind = "work_diary" | "delivery_note" | "measurement_sheet";

const FOLDER: Record<SignedDocKind, string> = {
  work_diary: "יומני עבודה/חתומים ע״י לקוח",
  delivery_note: "תעודות משלוח/חתומים ע״י לקוח",
  measurement_sheet: "מדידות/מאושרות",
};

const KIND_LABEL: Record<SignedDocKind, string> = {
  work_diary: "יומן עבודה",
  delivery_note: "תעודת משלוח",
  measurement_sheet: "דף מדידה",
};

/**
 * Creates a NEW Documents Hub entry for the client-signed version.
 * Does not overwrite prior draft/approval versions.
 */
export async function archiveClientSignedDocument(input: {
  kind: SignedDocKind;
  projectId: string;
  entityId: string;
  documentNumber: string;
  title?: string | null;
  userId: string;
  signedViewPath: string;
  signerName: string;
  signedAt: Date;
  ip?: string | null;
  device?: string | null;
  linkPublicId?: string | null;
  verificationId: string;
}) {
  const label = KIND_LABEL[input.kind];
  const name = `${label} ${input.documentNumber} (חתום ע"י לקוח).pdf`;
  const folderPath = FOLDER[input.kind];
  const path = `signed/${input.kind}/${input.entityId}/${input.verificationId}`;
  const url = input.signedViewPath;

  const doc = await prisma.document.create({
    data: {
      projectId: input.projectId,
      name,
      type: "pdf",
      extension: "pdf",
      size: 0,
      bucket: "documents",
      path,
      url,
      folderPath,
      sourceType: `${input.kind}_signed`,
      sourceId: input.entityId,
      uploadedById: input.userId,
      ownerId: input.userId,
      createdById: input.userId,
      updatedById: input.userId,
      versions: {
        create: {
          version: 1,
          size: 0,
          bucket: "documents",
          path,
          url,
          uploadedById: input.userId,
        },
      },
    },
  });

  try {
    await AuditRepository.log({
      action: "UPDATE",
      entityType: input.kind,
      entityId: input.entityId,
      userId: input.userId,
      metadata: {
        event: "client_signed",
        signerName: input.signerName,
        signedAt: input.signedAt.toISOString(),
        ip: input.ip ?? null,
        device: input.device ?? null,
        linkPublicId: input.linkPublicId ?? null,
        verificationId: input.verificationId,
        documentId: doc.id,
        signedViewPath: input.signedViewPath,
      },
    });
  } catch {
    /* audit must not block signature */
  }

  return doc;
}

export function buildVerificationId(
  documentNumber: string,
  publicId: string
): string {
  const short = publicId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return `${documentNumber}-SIG-${short || "OK"}`;
}
