import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  DocumentTimelineRepository,
  type TimelineCategory,
  type TimelineDocumentKind,
} from "@/repositories/document-timeline.repository";

export async function GET(request: NextRequest) {
  try {
    const field = await requireFieldManager();
    const params = request.nextUrl.searchParams;
    const result = await DocumentTimelineRepository.list(
      {
        userId: field.userId,
        userName: field.userName,
        role: field.role,
        employeeId: field.foremanId,
      },
      {
        projectId: params.get("projectId") || undefined,
        kind:
          (params.get("kind") as TimelineDocumentKind | null) || undefined,
        category:
          (params.get("status") as TimelineCategory | null) || undefined,
        period:
          (params.get("period") as "1" | "7" | "30" | "90" | "all" | null) ??
          "30",
        query: params.get("q") || undefined,
        documentKey: params.get("documentKey") || undefined,
        take: Number(params.get("take") || 250),
      }
    );
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
