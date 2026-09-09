import { NextRequest, NextResponse } from "next/server";
import { ExecutionReportsRepository } from "@/repositories/execution-reports.repository";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { OfficeAuthError } from "@/lib/auth/office-session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/projects/:id/execution-reports
 * List all execution reports for a project
 * Query params: ?status=uninvoiced to get only uninvoiced reports with items
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    await requireProjectPermission("view_all", projectId);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    if (status === "uninvoiced") {
      // Return detailed uninvoiced items grouped by report
      const uninvoicedItems = await ExecutionReportsRepository.getUninvoicedItems(projectId);
      return NextResponse.json(uninvoicedItems);
    }

    const reports = await ExecutionReportsRepository.findByProject(projectId);
    return NextResponse.json(reports);
  } catch (error: any) {
    if (error instanceof OfficeAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/projects/:id/execution-reports] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/execution-reports
 * Create a new execution report
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { userId } = await requireProjectPermission("create", projectId);
    const body = await req.json();

    const { reportedAt, foremanId, notes, items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "יש להוסיף לפחות סעיף אחד לדיווח" },
        { status: 400 }
      );
    }

    // Filter out items with zero or empty quantity
    const validItems = items.filter(
      (item: any) => item.quantity && parseFloat(item.quantity) > 0
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: "יש להוסיף כמות לפחות לסעיף אחד" },
        { status: 400 }
      );
    }

    const report = await ExecutionReportsRepository.create(
      {
        projectId,
        reportedAt: new Date(reportedAt || new Date()),
        foremanId,
        notes,
        items: validItems.map((item: any) => ({
          boqItemId: item.boqItemId,
          quantity: parseFloat(item.quantity),
          notes: item.notes,
        })),
        createdById: userId,
      }
    );

    return NextResponse.json(report, { status: 201 });
  } catch (error: any) {
    if (error instanceof OfficeAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/projects/:id/execution-reports] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create report" },
      { status: 400 }
    );
  }
}
