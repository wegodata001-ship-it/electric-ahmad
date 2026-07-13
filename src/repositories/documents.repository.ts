import { prisma } from "@/lib/prisma";
import { mapDocument } from "@/lib/mappers";
import { AuditRepository } from "./audit.repository";
import { deleteFromStorage } from "@/lib/supabase/storage";
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
  };

  static async findAll() {
    const rows = await prisma.document.findMany({
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

  static async findRecent(limit = 5) {
    const rows = await prisma.document.findMany({
      take: limit,
      include: this.documentInclude,
      orderBy: { createdAt: "desc" },
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
    },
    userId: string
  ) {
    const row = await prisma.document.create({
      data: {
        ...data,
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
      metadata: { name: data.name, type: data.type, bucket: data.bucket, path: data.path },
    });

    return mapDocument(row);
  }

  static async delete(id: string, userId: string) {
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { versions: true },
    });
    if (!doc) throw new Error("מסמך לא נמצא");

    await deleteFromStorage(doc.bucket, doc.path);
    for (const v of doc.versions) {
      if (v.path !== doc.path) {
        await deleteFromStorage(v.bucket, v.path).catch(() => undefined);
      }
    }

    await prisma.document.delete({ where: { id } });

    await AuditRepository.log({
      action: "DELETE",
      entityType: "Document",
      entityId: id,
      userId,
    });
  }
}
