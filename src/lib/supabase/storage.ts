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
  /** Override signed URL TTL for this upload (seconds). */
  signedUrlTtlSeconds?: number;
}

export interface UploadResult {
  bucket: string;
  path: string;
  /**
   * Time-limited signed URL to the object. Callers should treat this as
   * short-lived (see SIGNED_URL_TTL_SECONDS) and re-sign via
   * refreshSignedUrl / createSignedStorageUrl when the URL expires.
   */
  url: string;
  extension: string;
  size: number;
  uniqueName: string;
}

/**
 * Default signed-URL TTL for user-facing storage links.
 * 1 hour is enough for a browser session; long-lived documents (e.g.
 * archived PDFs) can pass `DOCUMENT_SIGNED_URL_TTL_SECONDS` explicitly.
 */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;
export const DOCUMENT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

/** Explicit DWG mime allow-list (some AutoCAD variants send octet-stream). */
const DWG_ALLOWED_MIME_TYPES = new Set<string>([
  "application/acad",
  "application/x-acad",
  "application/autocad_dwg",
  "image/vnd.dwg",
  "image/x-dwg",
  "application/dwg",
  "application/x-dwg",
]);
const DWG_ALLOWED_EXTENSIONS = new Set<string>(["dwg", "dxf"]);

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

/**
 * Reject unknown mime types. Previously we allowed anything falling into the
 * "other" bucket and any mime for "dwg", which meant arbitrary executables
 * could be uploaded. Now every branch requires an explicit allow-list match.
 */
function validateMimeType(mimeType: string, extension: string): void {
  const docType = resolveDocumentType(mimeType, extension);

  if (docType === "dwg") {
    if (
      !DWG_ALLOWED_MIME_TYPES.has(mimeType) &&
      !DWG_ALLOWED_EXTENSIONS.has(extension)
    ) {
      throw new Error(`סוג קובץ DWG לא נתמך: ${mimeType || extension}`);
    }
    return;
  }

  if (docType === "other") {
    throw new Error(`סוג קובץ לא נתמך: ${mimeType || extension || "unknown"}`);
  }

  const allowed = ALLOWED_MIME_TYPES[docType];
  if (!allowed || !allowed.includes(mimeType)) {
    throw new Error(`סוג קובץ לא נתמך: ${mimeType}`);
  }
}

export function buildStoragePath(projectId: string, fileName: string, subfolder?: string): string {
  const uniqueName = `${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  if (subfolder) return `${projectId}/${subfolder}/${uniqueName}`;
  return `${projectId}/${uniqueName}`;
}

/**
 * Create a fresh signed URL for an existing object.
 * Buckets are private — public URLs are intentionally not exposed.
 */
export async function createSignedStorageUrl(
  bucket: string,
  path: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<string> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(`שגיאה ביצירת קישור זמני: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

/**
 * Alias for callers that already hold a stale signed URL and just need a new
 * one for the same (bucket, path). Kept separate so intent is obvious at call
 * sites (e.g. before returning a document to the client).
 */
export async function refreshSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<string> {
  return createSignedStorageUrl(bucket, path, expiresIn);
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

  const ttl = input.signedUrlTtlSeconds ?? SIGNED_URL_TTL_SECONDS;
  const signedUrl = await createSignedStorageUrl(bucket, path, ttl);

  return {
    bucket,
    path,
    url: signedUrl,
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
