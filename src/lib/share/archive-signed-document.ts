import {
  archiveSignedDocumentCopies,
  resolveClientForArchive,
} from "@/lib/signatures/archive";
import type { SignableDocumentKind } from "@/lib/signatures";

export type SignedDocKind = "work_diary" | "delivery_note" | "measurement_sheet";

/**
 * Creates Documents Hub entries for the client-signed version:
 * 1) Project folder (e.g. תעודות משלוח)
 * 2) Client folder (לקוחות / {name} / תעודות משלוח)
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
  clientName?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
}) {
  const result = await archiveSignedDocumentCopies({
    kind: input.kind as SignableDocumentKind,
    projectId: input.projectId,
    entityId: input.entityId,
    documentNumber: input.documentNumber,
    userId: input.userId,
    signedViewPath: input.signedViewPath,
    signerName: input.signerName,
    signedAt: input.signedAt,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    clientEmail: input.clientEmail,
    clientAddress: input.clientAddress,
    ip: input.ip,
    device: input.device,
    linkPublicId: input.linkPublicId,
    verificationId: input.verificationId,
  });
  return result.projectDoc;
}

export { buildVerificationId } from "@/lib/signatures/verification";
export { resolveClientForArchive };
