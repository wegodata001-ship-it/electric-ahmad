import { NextResponse } from "next/server";
import { PipelineError, pipelineLog } from "@/lib/api/pipeline-log";
import { FieldAuthError } from "@/lib/auth/field-session";
import { OfficeAuthError } from "@/lib/auth/office-session";
import { SubcontractorAuthError } from "@/lib/auth/subcontractor-session";
import { SubcontractorError } from "@/repositories/subcontractors.repository";
import { toUserFacingError } from "@/lib/api/user-facing-error";
import { ValidationError } from "@/lib/validation/parse-body";
import { SessionSecretError } from "@/lib/env/required-secrets";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function handleApiError(error: unknown) {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { success: false, error: error.message, issues: error.issues },
      { status: error.status }
    );
  }

  if (error instanceof SessionSecretError) {
    console.error("[config]", error.message);
    return apiError(error.message, error.status);
  }

  if (error instanceof FieldAuthError) {
    return apiError(error.message, error.status);
  }
  if (error instanceof OfficeAuthError) {
    return apiError(error.message, error.status);
  }
  if (error instanceof SubcontractorAuthError) {
    return apiError(error.message, error.status);
  }
  if (error instanceof SubcontractorError) {
    return apiError(error.message, error.status);
  }

  if (error instanceof Error) {
    const publicLinkStatus: Record<string, number> = {
      "קישור לא נמצא": 404,
      "קישור לא תקין": 403,
      "הקישור בוטל": 410,
      "תוקף הקישור הסתיים": 410,
      "המסמך כבר נחתם": 410,
      "לא ניתן ליצור קישור: המסמך המבוקש לא נמצא": 404,
    };
    const status = publicLinkStatus[error.message];
    if (status) return apiError(error.message, status);
  }

  if (error instanceof PipelineError) {
    pipelineLog("ERROR", `${error.stage}/${error.step}`, error.message);
    return apiError(toUserFacingError(error, error.message), 500);
  }

  console.error("[API Error]", error);
  return apiError(toUserFacingError(error), 500);
}
