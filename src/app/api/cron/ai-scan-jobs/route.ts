import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  listDueScanJobs,
  processScanJob,
  recoverStuckScanJobs,
} from "@/lib/ai/process-scan-job";

export const maxDuration = 300;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const query = request.nextUrl.searchParams.get("secret") ?? "";
  return bearer === secret || query === secret;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return apiError("אין הרשאה", 401);
  }

  const recovery = await recoverStuckScanJobs();
  const due = await listDueScanJobs(1);
  const processed = [];

  for (const job of due) {
    const result = await processScanJob({
      parseLogId: job.id,
      userId: job.createdById,
    });
    processed.push({
      id: job.id,
      status: result.status,
      success: result.success,
      itemsDetected: result.itemsDetected,
      skipped: result.skipped,
    });
  }

  return apiSuccess({
    recovery,
    processed,
  });
}
