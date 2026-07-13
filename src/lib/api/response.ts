import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function handleApiError(error: unknown) {
  console.error("[API Error]", error);
  const message = error instanceof Error ? error.message : "שגיאת שרת";
  return apiError(message, 500);
}
