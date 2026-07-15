import { NextRequest, NextResponse } from "next/server";
import { ExecutionReportsRepository } from "@/repositories/execution-reports.repository";
import { getAuthContext } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/projects/:id/execution-reports/uninvoiced
 * Get all uninvoiced execution report items for a project
 * Returns items grouped by BOQ item with totals
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await context.params;
    const uninvoicedItems = await ExecutionReportsRepository.getUninvoicedItems(projectId);

    return NextResponse.json(uninvoicedItems);
  } catch (error: any) {
    console.error("[GET /api/projects/:id/execution-reports/uninvoiced] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch uninvoiced items" },
      { status: 500 }
    );
  }
}
