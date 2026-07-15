import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import type { ExecutionReportStatus } from "@prisma/client";

const VALID_STATUSES: ExecutionReportStatus[] = [
  "draft",
  "submitted",
  "approved",
  "cancelled",
];

/**
 * Office reporting feed.
 * ExecutionReport is the only performance-report source; legacy WorkReport
 * endpoints remain untouched for backwards compatibility.
 */
export async function GET(request: NextRequest) {
  try {
    await getAuthContext();

    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get("projectId") || undefined;
    const foremanId = searchParams.get("foremanId") || undefined;
    const rawStatus = searchParams.get("status");
    const status =
      rawStatus && VALID_STATUSES.includes(rawStatus as ExecutionReportStatus)
        ? (rawStatus as ExecutionReportStatus)
        : undefined;

    const rows = await prisma.executionReport.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(foremanId ? { foremanId } : {}),
        ...(status ? { status } : {}),
      },
      select: {
        id: true,
        reportNumber: true,
        reportedAt: true,
        status: true,
        notes: true,
        project: { select: { id: true, name: true, contractNumber: true } },
        foreman: { select: { firstName: true, lastName: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            invoiced: true,
            invoiceId: true,
            boqItem: { select: { code: true, description: true, unit: true } },
          },
        },
      },
      orderBy: [{ reportedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    return apiSuccess(
      rows.map((report) => ({
        id: report.id,
        reportNumber: report.reportNumber,
        reportedAt: report.reportedAt.toISOString(),
        status: report.status,
        notes: report.notes,
        project: report.project,
        foremanName: report.foreman
          ? `${report.foreman.firstName} ${report.foreman.lastName}`.trim()
          : null,
        itemCount: report.items.length,
        totalQuantity: report.items.reduce(
          (sum, item) => sum + Number(item.quantity),
          0
        ),
        invoicedItemCount: report.items.filter((item) => item.invoiced).length,
        items: report.items.map((item) => ({
          id: item.id,
          code: item.boqItem.code,
          description: item.boqItem.description,
          unit: item.boqItem.unit,
          quantity: Number(item.quantity),
          invoiced: item.invoiced,
          invoiceId: item.invoiceId,
        })),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
