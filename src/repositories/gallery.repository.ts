import { DocumentsRepository } from "./documents.repository";
import { AuditRepository } from "./audit.repository";
import type { GalleryItem } from "@/types";
import type { MediaType } from "@prisma/client";

/**
 * שכבת תאימות — הגלריה אינה מקור אמת.
 * כל קריאה/כתיבה עוברת דרך Document (תיקיות תמונות/סרטונים).
 */
export class GalleryRepository {
  private static toGalleryItem(doc: Awaited<ReturnType<typeof DocumentsRepository.findById>>): GalleryItem | null {
    if (!doc) return null;
    if (doc.type !== "image" && doc.type !== "video") return null;
    return {
      id: doc.id,
      projectId: doc.projectId,
      projectName: doc.projectName,
      type: doc.type as MediaType,
      title: doc.name,
      url: doc.url,
      thumbnailUrl: doc.url,
      uploadedBy: doc.uploadedBy,
      uploadedAt: doc.uploadedAt,
    };
  }

  static async findAll(projectIds?: string[]) {
    const docs = await DocumentsRepository.findAll(projectIds);
    return docs
      .filter((d) => d.type === "image" || d.type === "video")
      .map((d) => this.toGalleryItem(d)!)
      .filter(Boolean);
  }

  static async findByProject(projectId: string) {
    const docs = await DocumentsRepository.findByProject(projectId);
    return docs
      .filter((d) => d.type === "image" || d.type === "video")
      .map((d) => this.toGalleryItem(d)!)
      .filter(Boolean);
  }

  static async findRecent(limit = 12, projectIds?: string[]) {
    const docs = await DocumentsRepository.findRecent(
      Math.max(limit * 3, 24),
      projectIds
    );
    return docs
      .filter((d) => d.type === "image" || d.type === "video")
      .slice(0, limit)
      .map((d) => this.toGalleryItem(d)!)
      .filter(Boolean);
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
    const doc = await DocumentsRepository.create(
      {
        projectId: data.projectId,
        name: data.title,
        type: data.type === "video" ? "video" : "image",
        extension:
          data.path.split(".").pop()?.toLowerCase() ||
          (data.type === "video" ? "mp4" : "jpg"),
        size: 0,
        bucket: data.bucket,
        path: data.path,
        url: data.url,
        folderPath: data.type === "video" ? "סרטונים" : "תמונות",
        boqItemId: data.boqItemId ?? null,
        reportId: data.reportId ?? null,
        employeeId: data.employeeId ?? null,
      },
      userId
    );

    await AuditRepository.log({
      action: "UPLOAD",
      entityType: "Document",
      entityId: doc.id,
      userId,
      metadata: {
        type: data.type,
        bucket: data.bucket,
        path: data.path,
        via: "gallery_compat",
      },
    });

    return this.toGalleryItem(doc)!;
  }

  static async delete(id: string, userId: string) {
    await DocumentsRepository.delete(id, userId);
  }
}
