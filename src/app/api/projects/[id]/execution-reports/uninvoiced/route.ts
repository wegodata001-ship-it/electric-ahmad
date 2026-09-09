import { NextRequest, NextResponse } from "next/server";
import { ExecutionReportsRepository } from "@/repositories/execution-reports.repository";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { OfficeAuthError } from "@/lib/auth/office-session";

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
    const { id: projectId } = await context.params;
    await requireProjectPermission("view_all", projectId);
    const uninvoicedItems = await ExecutionReportsRepository.getUninvoicedItems(projectId);

    return NextResponse.json(uninvoicedItems);
  } catch (error: any) {
    if (error instanceof OfficeAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/projects/:id/execution-reports/uninvoiced] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch uninvoiced items" },
      { status: 500 }
    );
  }
}
