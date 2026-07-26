import { NextRequest } from "next/server";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import {
  createSignedStorageUrl,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/supabase/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { supabaseConfig } from "@/config/storage";

const ALLOWED_BUCKETS = new Set<string>(Object.values(supabaseConfig.buckets));

/**
 * Re-sign a storage object for an authenticated office user.
 *
 * Kept intentionally minimal: any authenticated office user can request a
 * fresh URL for any accessible bucket path, since the app is single-tenant
 * and does not model per-project office ACLs (see assert-office.ts).
 * We enforce two invariants:
 *   1. `bucket` must be one we manage (prevents accessing arbitrary buckets).
 *   2. `path` must not traverse (`..`) — signed URLs already scope to bucket
 *      but path traversal is still a defense-in-depth check for logs / audit.
 */
export async function GET(request: NextRequest) {
  try {
    await requireOfficeAuth();

    const { searchParams } = request.nextUrl;
    const bucket = searchParams.get("bucket");
    const path = searchParams.get("path");
    const expiresInRaw = searchParams.get("expiresIn");

    if (!bucket || !path) {
      return apiError("bucket ו-path נדרשים");
    }

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return apiError("bucket לא מוכר", 400);
    }

    if (path.includes("..") || path.startsWith("/")) {
      return apiError("path לא חוקי", 400);
    }

    const expiresIn = expiresInRaw
      ? Math.max(60, Math.min(Number(expiresInRaw) || 0, 60 * 60 * 24 * 7))
      : SIGNED_URL_TTL_SECONDS;

    const url = await createSignedStorageUrl(bucket, path, expiresIn);
    return apiSuccess({ url, expiresIn });
  } catch (error) {
    return handleApiError(error);
  }
}
