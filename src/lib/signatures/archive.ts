import { prisma } from "@/lib/prisma";
import {
  type SignableDocumentKind,
  clientSignedFolder,
  projectSignedFolder,
  SIGN_KIND_LABEL,
  SIGNED_STATUS_LABEL,
} from "@/lib/signatures";
import { AuditRepository } from "@/repositories/audit.repository";

/**
 * Resolve Client by name (or create under owner) for signed-doc filing.
 */
export async function resolveClientForArchive(opts: {
  clientName: string;
  ownerId: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}): Promise<{ id: string; name: string } | null> {
  const name = opts.clientName.trim();
  if (!name) return null;

  const existing = await prisma.client.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  try {
    const created = await prisma.client.create({
      data: {
        name,
        phone: opts.phone || null,
        email: opts.email || null,
        address: opts.address || null,
        ownerId: opts.ownerId,
        createdById: opts.ownerId,
        updatedById: opts.ownerId,
      },
      select: { id: true, name: true },
    });
    return created;
  } catch {
    const again = await prisma.client.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    return again;
  }
}

/**
 * Archive signed document into project folder AND client folder.
 */
export async function archiveSignedDocumentCopies(input: {
  kind: SignableDocumentKind;
  projectId: string;
  entityId: string;
  documentNumber: string;
  userId: string;
  signedViewPath: string;
  signerName: string;
  signedAt: Date;
  clientName?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
  ip?: string | null;
  device?: string | null;
  linkPublicId?: string | null;
  verificationId: string;
}) {
  const kindLabel = SIGN_KIND_LABEL[input.kind] || "מסמך";
  const baseName = `${kindLabel} ${input.documentNumber} (חתום על ידי הלקוח)`;
  const path = `signed/${input.kind}/${input.entityId}/${input.verificationId}`;
  const url = input.signedViewPath;

  const projectName =
    input.clientName?.trim() ||
    (
      await prisma.project.findUnique({
        where: { id: input.projectId },
        select: { contractor: true },
      })
    )?.contractor ||
    null;

  const client = projectName
    ? await resolveClientForArchive({
        clientName: projectName,
        ownerId: input.userId,
        phone: input.clientPhone,
        email: input.clientEmail,
        address: input.clientAddress,
      })
    : null;

  const projectDoc = await prisma.document.create({
    data: {
      projectId: input.projectId,
      name: `${baseName}.pdf`,
      type: "pdf",
      extension: "pdf",
      size: 0,
      bucket: "documents",
      path: `${path}/project`,
      url,
      folderPath: projectSignedFolder(input.kind),
      sourceType: `${input.kind}_signed`,
      sourceId: input.entityId,
      clientId: client?.id ?? null,
      uploadedById: input.userId,
      ownerId: input.userId,
      createdById: input.userId,
      updatedById: input.userId,
      versions: {
        create: {
          version: 1,
          size: 0,
          bucket: "documents",
          path: `${path}/project`,
          url,
          uploadedById: input.userId,
        },
      },
    },
  });

  let clientDocId: string | null = null;
  if (projectName) {
    const clientDoc = await prisma.document.create({
      data: {
        projectId: input.projectId,
        name: `${baseName}.pdf`,
        type: "pdf",
        extension: "pdf",
        size: 0,
        bucket: "documents",
        path: `${path}/client`,
        url,
        folderPath: clientSignedFolder(projectName, input.kind),
        sourceType: `${input.kind}_signed_client`,
        sourceId: input.entityId,
        clientId: client?.id ?? null,
        uploadedById: input.userId,
        ownerId: input.userId,
        createdById: input.userId,
        updatedById: input.userId,
        versions: {
          create: {
            version: 1,
            size: 0,
            bucket: "documents",
            path: `${path}/client`,
            url,
            uploadedById: input.userId,
          },
        },
      },
    });
    clientDocId = clientDoc.id;
  }

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
        projectDocumentId: projectDoc.id,
        clientDocumentId: clientDocId,
        signedViewPath: input.signedViewPath,
        statusLabel: SIGNED_STATUS_LABEL,
      },
    });
  } catch {
    /* audit must not block */
  }

  return { projectDoc, clientDocId };
}
