import { prisma } from "@/lib/prisma";
import { mapDocument } from "@/lib/mappers";
import { AuditRepository } from "./audit.repository";
import { deleteFromStorage } from "@/lib/supabase/storage";
import { defaultFolderForDocumentType } from "@/lib/documents/archive-folders";
import { PROJECT_ORIGINAL_SOURCE_TYPE } from "@/lib/documents/project-original";
import type { DocumentType } from "@prisma/client";

export class DocumentsRepository {
  static documentInclude = {
    project: { select: { name: true } },
    uploadedBy: { select: { name: true } },
    versions: {
      orderBy: { version: "desc" as const },
      select: {
        version: true,
        uploadedById: true,
        createdAt: true,
        size: true,
        url: true,
      },
    },
    attachments: {
      orderBy: { createdAt: "desc" as const },
      include: { uploadedBy: { select: { name: true } } },
    },
    _count: { select: { attachments: true } },
  };

  static async findAll(projectIds?: string[]) {
    const rows = await prisma.document.findMany({
      where: projectIds ? { projectId: { in: projectIds } } : undefined,
      include: this.documentInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapDocument);
  }

  static async findByProject(projectId: string) {
    const rows = await prisma.document.findMany({
      where: { projectId },
      include: this.documentInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapDocument);
  }

  static async findById(id: string) {
    const row = await prisma.document.findUnique({
      where: { id },
      include: this.documentInclude,
    });
    return row ? mapDocument(row) : null;
  }

  static async findBySource(sourceType: string, sourceId: string) {
    const row = await prisma.document.findFirst({
      where: { sourceType, sourceId },
      include: this.documentInclude,
      orderBy: { updatedAt: "desc" },
    });
    return row ? mapDocument(row) : null;
  }

  static async findRecent(limit = 5, projectIds?: string[]) {
    const rows = await prisma.document.findMany({
      take: limit,
      where: projectIds ? { projectId: { in: projectIds } } : undefined,
      include: this.documentInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapDocument);
  }

  /** חיפוש במסמכים ובקבצים מצורפים */
  static async search(
    query: string,
    projectId?: string,
    projectIds?: string[]
  ) {
    const q = query.trim();
    if (!q) return [];

    const rows = await prisma.document.findMany({
      where: {
        ...(projectId
          ? { projectId }
          : projectIds
            ? { projectId: { in: projectIds } }
            : {}),
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { folderPath: { contains: q, mode: "insensitive" } },
          {
            attachments: {
              some: { name: { contains: q, mode: "insensitive" } },
            },
          },
        ],
      },
      include: this.documentInclude,
      take: 40,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapDocument);
  }

  static async create(
    data: {
      projectId: string;
      name: string;
      type: DocumentType;
      extension: string;
      size: number;
      bucket: string;
      path: string;
      url: string;
      folderPath?: string | null;
      partialInvoiceId?: string | null;
      sourceType?: string | null;
      sourceId?: string | null;
      legacyGalleryId?: string | null;
      boqItemId?: string | null;
      employeeId?: string | null;
      reportId?: string | null;
    },
    userId: string
  ) {
    const folderPath =
      data.folderPath ?? defaultFolderForDocumentType(data.type);

    const row = await prisma.document.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        type: data.type,
        extension: data.extension,
        size: data.size,
        bucket: data.bucket,
        path: data.path,
        url: data.url,
        folderPath,
        partialInvoiceId: data.partialInvoiceId ?? null,
        sourceType: data.sourceType ?? null,
        sourceId: data.sourceId ?? null,
        legacyGalleryId: data.legacyGalleryId ?? null,
        boqItemId: data.boqItemId ?? null,
        employeeId: data.employeeId ?? null,
        reportId: data.reportId ?? null,
        uploadedById: userId,
        ownerId: userId,
        createdById: userId,
        updatedById: userId,
        versions: {
          create: {
            version: 1,
            size: data.size,
            bucket: data.bucket,
            path: data.path,
            url: data.url,
            uploadedById: userId,
          },
        },
      },
      include: this.documentInclude,
    });

    await prisma.activity.create({
      data: {
        projectId: data.projectId,
        type: "document_uploaded",
        title: "מסמך חדש",
        description: `${data.name} הועלה`,
        userId,
      },
    });

    await AuditRepository.log({
      action: "UPLOAD",
      entityType: "Document",
      entityId: row.id,
      userId,
      metadata: {
        name: data.name,
        type: data.type,
        bucket: data.bucket,
        path: data.path,
        folderPath,
      },
    });

    return mapDocument(row);
  }

  static async updateFolder(
    id: string,
    folderPath: string | null,
    userId: string
  ) {
    const row = await prisma.document.update({
      where: { id },
      data: { folderPath, updatedById: userId },
      include: this.documentInclude,
    });
    return mapDocument(row);
  }

  static async addAttachment(
    documentId: string,
    data: {
      name: string;
      type: DocumentType;
      extension: string;
      size: number;
      bucket: string;
      path: string;
      url: string;
    },
    userId: string
  ) {
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new Error("מסמך לא נמצא");

    await prisma.documentAttachment.create({
      data: {
        documentId,
        name: data.name,
        type: data.type,
        extension: data.extension,
        size: data.size,
        bucket: data.bucket,
        path: data.path,
        url: data.url,
        uploadedById: userId,
      },
    });

    await prisma.document.update({
      where: { id: documentId },
      data: { updatedById: userId },
    });

    await AuditRepository.log({
      action: "UPLOAD",
      entityType: "DocumentAttachment",
      entityId: documentId,
      userId,
      metadata: { name: data.name, type: data.type },
    });

    return this.findById(documentId);
  }

  static async deleteAttachment(attachmentId: string, userId: string) {
    const att = await prisma.documentAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!att) throw new Error("קובץ מצורף לא נמצא");

    await deleteFromStorage(att.bucket, att.path).catch(() => undefined);
    await prisma.documentAttachment.delete({ where: { id: attachmentId } });

    await prisma.document.update({
      where: { id: att.documentId },
      data: { updatedById: userId },
    });

    await AuditRepository.log({
      action: "DELETE",
      entityType: "DocumentAttachment",
      entityId: attachmentId,
      userId,
    });

    return this.findById(att.documentId);
  }

  static async delete(id: string, userId: string) {
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { versions: true, attachments: true },
    });
    if (!doc) throw new Error("מסמך לא נמצא");
    if (doc.sourceType === PROJECT_ORIGINAL_SOURCE_TYPE) {
      throw new Error(
        "לא ניתן למחוק את קובץ הפרויקט המקורי. מנהל מערכת יכול להחליף אותו ממסך הפרויקט"
      );
    }

    await deleteFromStorage(doc.bucket, doc.path).catch(() => undefined);
    for (const v of doc.versions) {
      if (v.path !== doc.path) {
        await deleteFromStorage(v.bucket, v.path).catch(() => undefined);
      }
    }
    for (const a of doc.attachments) {
      await deleteFromStorage(a.bucket, a.path).catch(() => undefined);
    }

    await prisma.document.delete({ where: { id } });

    await AuditRepository.log({
      action: "DELETE",
      entityType: "Document",
      entityId: id,
      userId,
    });
  }

  /**
   * מיגרציה חד-פעמית: GalleryItem → Document (תמונות/סרטונים).
   * לא מוחק את רשומות הגלריה הישנות; מדלג על פריטים שכבר הועברו.
   */
  static async migrateGalleryItemsToDocuments() {
    const items = await prisma.galleryItem.findMany({
      orderBy: { createdAt: "asc" },
    });
    let created = 0;
    let skipped = 0;

    for (const item of items) {
      const existing = await prisma.document.findUnique({
        where: { legacyGalleryId: item.id },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const folderPath = item.type === "video" ? "סרטונים" : "תמונות";
      const extension =
        item.path.split(".").pop()?.toLowerCase() ||
        (item.type === "video" ? "mp4" : "jpg");

      await prisma.document.create({
        data: {
          projectId: item.projectId,
          name: item.title,
          type: item.type === "video" ? "video" : "image",
          extension,
          size: 0,
          bucket: item.bucket,
          path: item.path,
          url: item.url,
          folderPath,
          legacyGalleryId: item.id,
          boqItemId: item.boqItemId,
          employeeId: item.employeeId,
          reportId: item.reportId,
          uploadedById: item.uploadedById,
          ownerId: item.uploadedById,
          createdById: item.uploadedById,
          updatedById: item.uploadedById,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          versions: {
            create: {
              version: 1,
              size: 0,
              bucket: item.bucket,
              path: item.path,
              url: item.url,
              uploadedById: item.uploadedById,
              createdAt: item.createdAt,
            },
          },
        },
      });
      created += 1;
    }

    return { total: items.length, created, skipped };
  }
}
