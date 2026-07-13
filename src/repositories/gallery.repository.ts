import { prisma } from "@/lib/prisma";
import { mapGalleryItem } from "@/lib/mappers";
import { AuditRepository } from "./audit.repository";
import { deleteFromStorage } from "@/lib/supabase/storage";
import type { MediaType } from "@prisma/client";

export class GalleryRepository {
  static galleryInclude = {
    project: { select: { name: true } },
    uploadedBy: { select: { name: true } },
  } as const;

  static async findAll() {
    const rows = await prisma.galleryItem.findMany({
      include: this.galleryInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapGalleryItem);
  }

  static async findByProject(projectId: string) {
    const rows = await prisma.galleryItem.findMany({
      where: { projectId },
      include: this.galleryInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapGalleryItem);
  }

  static async findRecent(limit = 12) {
    const rows = await prisma.galleryItem.findMany({
      take: limit,
      include: this.galleryInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapGalleryItem);
  }

  static async create(
    data: {
      projectId: string;
      type: MediaType;
      title: string;
      bucket: string;
      path: string;
      url: string;
      thumbnailUrl: string;
      thumbnailPath?: string;
      boqItemId?: string;
      reportId?: string;
      employeeId?: string;
    },
    userId: string
  ) {
    const row = await prisma.galleryItem.create({
      data: { ...data, uploadedById: userId },
      include: this.galleryInclude,
    });

    await AuditRepository.log({
      action: "UPLOAD",
      entityType: "GalleryItem",
      entityId: row.id,
      userId,
      metadata: { type: data.type, bucket: data.bucket, path: data.path },
    });

    return mapGalleryItem(row);
  }

  static async delete(id: string, userId: string) {
    const item = await prisma.galleryItem.findUnique({ where: { id } });
    if (!item) throw new Error("פריט גלריה לא נמצא");

    await deleteFromStorage(item.bucket, item.path);
    if (item.thumbnailPath) {
      await deleteFromStorage(item.bucket, item.thumbnailPath).catch(() => undefined);
    }

    await prisma.galleryItem.delete({ where: { id } });

    await AuditRepository.log({
      action: "DELETE",
      entityType: "GalleryItem",
      entityId: id,
      userId,
    });
  }
}
