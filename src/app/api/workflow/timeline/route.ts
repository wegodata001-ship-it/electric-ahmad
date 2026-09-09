import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireTimelineSession } from "@/lib/auth/timeline-session";
import {
  DocumentTimelineRepository,
  type TimelineCategory,
  type TimelineDocumentKind,
} from "@/repositories/document-timeline.repository";

const KINDS = new Set<TimelineDocumentKind>([
  "work_diary",
  "delivery_note",
  "measurement",
  "invoice",
]);
const CATEGORIES = new Set<TimelineCategory>([
  "approved",
  "pending",
  "revision",
  "signed",
  "created",
  "updated",
  "info",
]);
const PERIODS = new Set(["1", "7", "30", "90", "all"]);

export async function GET(request: NextRequest) {
  try {
    const session = await requireTimelineSession();
    const params = request.nextUrl.searchParams;
    const kindValue = params.get("kind");
    const categoryValue = params.get("status");
    const periodValue = params.get("period");
    const takeValue = Number(params.get("take") || 250);

    const result = await DocumentTimelineRepository.list(session, {
      projectId: params.get("projectId") || undefined,
      kind:
        kindValue && KINDS.has(kindValue as TimelineDocumentKind)
          ? (kindValue as TimelineDocumentKind)
          : undefined,
      category:
        categoryValue &&
        CATEGORIES.has(categoryValue as TimelineCategory)
          ? (categoryValue as TimelineCategory)
          : undefined,
      period:
        periodValue && PERIODS.has(periodValue)
          ? (periodValue as "1" | "7" | "30" | "90" | "all")
          : "30",
      query: params.get("q") || undefined,
      documentKey: params.get("documentKey") || undefined,
      take: Number.isFinite(takeValue) ? takeValue : 250,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
