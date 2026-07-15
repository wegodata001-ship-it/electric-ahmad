import { NextResponse } from "next/server";
import { PipelineError, pipelineLog } from "@/lib/api/pipeline-log";
import { FieldAuthError } from "@/lib/auth/field-session";
import { OfficeAuthError } from "@/lib/auth/office-session";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function handleApiError(error: unknown) {
  if (error instanceof FieldAuthError) {
    return apiError(error.message, error.status);
  }
  if (error instanceof OfficeAuthError) {
    return apiError(error.message, error.status);
  }

  if (error instanceof PipelineError) {
    pipelineLog("ERROR", `${error.stage}/${error.step}`, error.message);
    return apiError(error.message, 500);
  }

  console.error("[API Error]", error);
  const message = error instanceof Error ? error.message : "שגיאת שרת";
  return apiError(message, 500);
}
