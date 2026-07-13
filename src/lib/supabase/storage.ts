import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  ALLOWED_MIME_TYPES,
  FILE_SIZE_LIMITS,
  supabaseConfig,
  type StorageBucketKey,
} from "@/config/storage";
import type { DocumentType } from "@/types";
import { randomUUID } from "crypto";

export interface UploadInput {
  file: File | Buffer;
  fileName: string;
  mimeType: string;
  size: number;
  bucketKey: StorageBucketKey;
  projectId: string;
  subfolder?: string;
}

export interface UploadResult {
  bucket: string;
  path: string;
  url: string;
  extension: string;
  size: number;
  uniqueName: string;
}

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function resolveDocumentType(mimeType: string, extension: string): DocumentType {
  if (mimeType === "application/pdf" || extension === "pdf") return "pdf";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv" ||
    ["xls", "xlsx", "csv"].includes(extension)
  )
    return "excel";
  if (mimeType.includes("word") || ["doc", "docx"].includes(extension)) return "word";
  if (extension === "dwg" || mimeType.includes("dwg") || mimeType.includes("acad")) return "dwg";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "other";
}

function getSizeLimit(mimeType: string, extension: string): number {
  const docType = resolveDocumentType(mimeType, extension);
  if (docType === "pdf") return FILE_SIZE_LIMITS.pdf;
  if (docType === "excel") return FILE_SIZE_LIMITS.excel;
  if (docType === "word") return FILE_SIZE_LIMITS.word;
  if (docType === "dwg") return FILE_SIZE_LIMITS.dwg;
  if (docType === "image") return FILE_SIZE_LIMITS.image;
  if (docType === "video") return FILE_SIZE_LIMITS.video;
  return FILE_SIZE_LIMITS.default;
}

function validateMimeType(mimeType: string, extension: string): void {
  const docType = resolveDocumentType(mimeType, extension);
  const allowed = ALLOWED_MIME_TYPES[docType];
  if (docType === "dwg" || docType === "other") return;
  if (!allowed.includes(mimeType)) {
    throw new Error(`סוג קובץ לא נתמך: ${mimeType}`);
  }
}

export function buildStoragePath(projectId: string, fileName: string, subfolder?: string): string {
  const uniqueName = `${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  if (subfolder) return `${projectId}/${subfolder}/${uniqueName}`;
  return `${projectId}/${uniqueName}`;
}

export async function uploadToStorage(input: UploadInput): Promise<UploadResult> {
  const extension = getExtension(input.fileName);
  validateMimeType(input.mimeType, extension);

  const sizeLimit = getSizeLimit(input.mimeType, extension);
  if (input.size > sizeLimit) {
    throw new Error(`הקובץ גדול מדי. מקסימום: ${Math.round(sizeLimit / 1024 / 1024)}MB`);
  }

  const bucket = supabaseConfig.buckets[input.bucketKey];
  const path = buildStoragePath(input.projectId, input.fileName, input.subfolder);
  const supabase = createSupabaseAdmin();

  const buffer =
    input.file instanceof Buffer
      ? input.file
      : Buffer.from(await (input.file as File).arrayBuffer());

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: input.mimeType,
    upsert: false,
  });

  if (error) throw new Error(`שגיאה בהעלאת קובץ: ${error.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    bucket,
    path,
    url: urlData.publicUrl,
    extension,
    size: input.size,
    uniqueName: path.split("/").pop() ?? input.fileName,
  };
}

export async function deleteFromStorage(bucket: string, path: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`שגיאה במחיקת קובץ: ${error.message}`);
}

export function getBucketForDocumentType(type: DocumentType): StorageBucketKey {
  switch (type) {
    case "pdf":
      return "pdf";
    case "excel":
      return "excel";
    case "image":
      return "images";
    case "video":
      return "videos";
    default:
      return "documents";
  }
}

export { resolveDocumentType };
