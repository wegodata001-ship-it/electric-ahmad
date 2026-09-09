import { NextRequest, NextResponse } from "next/server";
import { ExecutionReportsRepository } from "@/repositories/execution-reports.repository";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { OfficeAuthError } from "@/lib/auth/office-session";

type RouteContext = {
  params: Promise<{ id: string; reportId: string }>;
};

/**
 * GET /api/projects/:id/execution-reports/:reportId
 * Get a single execution report
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, reportId } = await context.params;
    await requireProjectPermission("view_all", projectId);
    const report = await ExecutionReportsRepository.findById(reportId);

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    if (report.projectId !== projectId) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error: any) {
    if (error instanceof OfficeAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/projects/:id/execution-reports/:reportId] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch report" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/:id/execution-reports/:reportId
 * Update an execution report
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, reportId } = await context.params;
    const { userId } = await requireProjectPermission(
      "edit_draft",
      projectId
    );
    const existing = await ExecutionReportsRepository.findById(reportId);
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    const body = await req.json();

    const { reportedAt, foremanId, notes } = body;

    const report = await ExecutionReportsRepository.update(
      reportId,
      {
        reportedAt: reportedAt ? new Date(reportedAt) : undefined,
        foremanId,
        notes,
      },
      userId
    );

    return NextResponse.json(report);
  } catch (error: any) {
    if (error instanceof OfficeAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[PATCH /api/projects/:id/execution-reports/:reportId] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update report" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/execution-reports/:reportId
 * Delete an execution report
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, reportId } = await context.params;
    await requireProjectPermission("delete", projectId);
    const existing = await ExecutionReportsRepository.findById(reportId);
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    await ExecutionReportsRepository.delete(reportId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof OfficeAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[DELETE /api/projects/:id/execution-reports/:reportId] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete report" },
      { status: 500 }
    );
  }
}
