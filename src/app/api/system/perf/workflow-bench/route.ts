import { NextRequest } from "next/server";
import { requireSystemAdmin } from "@/lib/auth/assert-office";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { runProductionWorkflowBench } from "@/lib/perf/workflow-prod-bench";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorizedBySecret(req: NextRequest): boolean {
  const header = req.headers.get("x-perf-bench-secret")?.trim();
  if (!header) return false;
  const candidates = [
    process.env.PERF_BENCH_SECRET?.trim(),
    process.env.SESSION_SECRET?.trim(),
  ].filter(Boolean) as string[];
  return candidates.some((expected) => expected === header);
}

/**
 * Production workflow latency + side-effect verification.
 * Auth: SYSTEM_MANAGER session OR x-perf-bench-secret
 * (PERF_BENCH_SECRET / SESSION_SECRET).
 */
export async function POST(req: NextRequest) {
  try {
    if (!authorizedBySecret(req)) {
      await requireSystemAdmin();
    }

    const body = (await req.json().catch(() => ({}))) as {
      runsPerAction?: number;
    };
    const result = await runProductionWorkflowBench({
      runsPerAction: body.runsPerAction ?? 5,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
