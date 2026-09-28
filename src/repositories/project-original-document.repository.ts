import { prisma } from "@/lib/prisma";
import { AuditRepository } from "./audit.repository";
import { DocumentsRepository } from "./documents.repository";
import {
  PROJECT_ORIGINAL_FOLDER,
  PROJECT_ORIGINAL_SOURCE_TYPE,
  originalProjectFileName,
} from "@/lib/documents/project-original";
import {
  createSignedStorageUrl,
  DOCUMENT_SIGNED_URL_TTL_SECONDS,
  uploadToStorage,
} from "@/lib/supabase/storage";

const DOC_SELECT = {
  id: true,
  projectId: true,
  name: true,
  size: true,
  bucket: true,
  path: true,
  url: true,
  sourceType: true,
  version: true,
  createdAt: true,
} as const;

export type OriginalProjectDocument = {
  id: string;
  projectId: string;
  name: string;
  fileName: string;
  size: number;
  createdAt: string;
};

export class ProjectOriginalDocumentRepository {
  static async get(projectId: string) {
    const row = await this.resolve(projectId);
    if (!row) {
      return { document: null, viewUrl: null as string | null };
    }

    const viewUrl = await createSignedStorageUrl(
      row.bucket,
      row.path,
      DOCUMENT_SIGNED_URL_TTL_SECONDS
    ).catch(() => row.url || null);

    return {
      document: this.map(row),
      viewUrl,
    };
  }

  static async upload(projectId: string, file: File, userId: string) {
    const existing = await this.resolve(projectId);
    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      size: file.size,
      bucketKey: "pdf",
      projectId,
      subfolder: "contracts",
    });

    if (existing) {
      const nextVersion = await prisma.documentVersion.count({
        where: { documentId: existing.id },
      });
      await prisma.$transaction([
        prisma.documentVersion.create({
          data: {
            documentId: existing.id,
            version: nextVersion + 1,
            size: uploaded.size,
            bucket: uploaded.bucket,
            path: uploaded.path,
            url: uploaded.url,
            uploadedById: userId,
          },
        }),
        prisma.document.update({
          where: { id: existing.id },
          data: {
            name: file.name.replace(/\.pdf$/i, "") || existing.name,
            type: "pdf",
            extension: "pdf",
            size: uploaded.size,
            bucket: uploaded.bucket,
            path: uploaded.path,
            url: uploaded.url,
            sourceType: PROJECT_ORIGINAL_SOURCE_TYPE,
            folderPath: PROJECT_ORIGINAL_FOLDER,
            version: existing.version + 1,
            updatedById: userId,
          },
        }),
      ]);

      await AuditRepository.log({
        action: "UPDATE",
        entityType: "Document",
        entityId: existing.id,
        userId,
        metadata: {
          event: "Original project PDF replaced",
          previousPath: existing.path,
          path: uploaded.path,
        },
      });

      return this.get(projectId);
    }

    const created = await DocumentsRepository.create(
      {
        projectId,
        name: file.name.replace(/\.pdf$/i, "") || file.name,
        type: "pdf",
        extension: "pdf",
        size: uploaded.size,
        bucket: uploaded.bucket,
        path: uploaded.path,
        url: uploaded.url,
        folderPath: PROJECT_ORIGINAL_FOLDER,
        sourceType: PROJECT_ORIGINAL_SOURCE_TYPE,
      },
      userId
    );

    await AuditRepository.log({
      action: "UPLOAD",
      entityType: "Document",
      entityId: created.id,
      userId,
      metadata: {
        event: "Original project PDF uploaded",
        path: uploaded.path,
      },
    });

    return this.get(projectId);
  }

  /**
   * Find the intake PDF already stored for this project.
   * Does not create a new file. Pins sourceType so later docs cannot hide it.
   */
  private static async resolve(projectId: string) {
    const pinned = await prisma.document.findFirst({
      where: { projectId, sourceType: PROJECT_ORIGINAL_SOURCE_TYPE },
      select: DOC_SELECT,
      orderBy: { createdAt: "asc" },
    });
    if (pinned) return pinned;

    const parseLog = await prisma.aiParseLog.findFirst({
      where: {
        projectId,
        documentType: "contract_boq",
        documentId: { not: null },
      },
      orderBy: { createdAt: "asc" },
      select: { documentId: true },
    });
    if (parseLog?.documentId) {
      const fromParse = await prisma.document.findFirst({
        where: { id: parseLog.documentId, projectId },
        select: DOC_SELECT,
      });
      if (fromParse) {
        await this.pin(fromParse.id);
        return fromParse;
      }
    }

    const fromContractsPath = await prisma.document.findFirst({
      where: {
        projectId,
        type: "pdf",
        path: { contains: "/contracts/" },
      },
      select: DOC_SELECT,
      orderBy: { createdAt: "asc" },
    });
    if (fromContractsPath) {
      await this.pin(fromContractsPath.id);
      return fromContractsPath;
    }

    return null;
  }

  private static async pin(documentId: string) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        sourceType: PROJECT_ORIGINAL_SOURCE_TYPE,
        folderPath: PROJECT_ORIGINAL_FOLDER,
      },
    });
  }

  private static map(row: {
    id: string;
    projectId: string;
    name: string;
    size: number;
    createdAt: Date;
  }): OriginalProjectDocument {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      fileName: originalProjectFileName(row.name),
      size: row.size,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
