function normalizeSupabaseUrl(url?: string): string {
  if (!url) return "";
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export const supabaseConfig = {
  url: normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  buckets: {
    projects: process.env.SUPABASE_BUCKET_PROJECTS ?? "projects",
    contracts: process.env.SUPABASE_BUCKET_CONTRACTS ?? "contracts",
    boq: process.env.SUPABASE_BUCKET_BOQ ?? "boq",
    partialInvoices: process.env.SUPABASE_BUCKET_PARTIAL_INVOICES ?? "partial-invoices",
    documents: process.env.SUPABASE_BUCKET_DOCUMENTS ?? "documents",
    images: process.env.SUPABASE_BUCKET_IMAGES ?? "images",
    videos: process.env.SUPABASE_BUCKET_VIDEOS ?? "videos",
    reports: process.env.SUPABASE_BUCKET_REPORTS ?? "reports",
    excel: process.env.SUPABASE_BUCKET_EXCEL ?? "excel",
    pdf: process.env.SUPABASE_BUCKET_PDF ?? "pdf",
  },
} as const;

export type StorageBucketKey = keyof typeof supabaseConfig.buckets;

export const FILE_SIZE_LIMITS = {
  pdf: 50 * 1024 * 1024,
  excel: 25 * 1024 * 1024,
  word: 25 * 1024 * 1024,
  dwg: 100 * 1024 * 1024,
  image: 15 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  default: 50 * 1024 * 1024,
} as const;

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  excel: [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ],
  word: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  dwg: ["application/acad", "application/x-acad", "image/vnd.dwg", "application/octet-stream"],
  image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"],
  video: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
};
