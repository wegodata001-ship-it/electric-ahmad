import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { BOQRepository } from "@/repositories/boq.repository";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { AuditRepository } from "@/repositories/audit.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { canAssignProjectManager } from "@/lib/auth/project-access";
import type { ParsedBoqItem, ParsedProjectDetails } from "@/lib/ai/types";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { cleanBoqDescription } from "@/utils/boq-text";

export async function POST(request: NextRequest) {
  try {
    const { userId, role } = await requireOfficeUser();
    const body = await request.json();

    const projectId = String(body.projectId ?? "");
    const parseLogId = String(body.parseLogId ?? "");
    const projectData = body.project as ParsedProjectDetails | undefined;
    const items = (body.items ?? []) as ParsedBoqItem[];

    if (!projectId) return apiError("מזהה פרויקט חובה");
    if (!projectData?.name?.trim()) return apiError("שם פרויקט חובה");
    if (!projectData.contractNumber?.trim()) return apiError("מספר חוזה חובה");
    if (!projectData.contractor?.trim()) return apiError("קבלן חובה");
    if (!projectData.location?.trim()) return apiError("מיקום חובה");

    const contractValue = Number(projectData.contractValue);
    if (!contractValue || contractValue <= 0) {
      return apiError("שווי חוזה חייב להיות גדול מ-0");
    }

    const existing = await ProjectsRepository.findById(projectId);
    if (!existing) return apiError("פרויקט לא נמצא", 404);

    const existingReports = await prisma.workReport.count({ where: { projectId } });
    const existingBoq = await prisma.boqItem.count({ where: { projectId } });
    if (existingReports > 0 && existingBoq > 0) {
      return apiError(
        "לא ניתן להחליף כתב כמויות בפרויקט עם דיווחי עובדים קיימים",
        409
      );
    }

    const subtotal =
      projectData.subtotal != null ? Number(projectData.subtotal) : null;
    const vatPercent =
      projectData.vatPercent != null ? Number(projectData.vatPercent) : null;
    const vatAmount =
      projectData.vatAmount != null ? Number(projectData.vatAmount) : null;
    const totalWithVat =
      projectData.totalWithVat != null ? Number(projectData.totalWithVat) : null;

    await prisma.project.update({
      where: { id: projectId },
      data: {
        name: projectData.name.trim(),
        contractNumber: projectData.contractNumber.trim(),
        contractor: projectData.contractor.trim(),
        location: projectData.location.trim(),
        contractValue,
        subtotal: subtotal != null && Number.isFinite(subtotal) ? subtotal : null,
        vatPercent:
          vatPercent != null && Number.isFinite(vatPercent) ? vatPercent : null,
        vatAmount:
          vatAmount != null && Number.isFinite(vatAmount) ? vatAmount : null,
        totalWithVat:
          totalWithVat != null && Number.isFinite(totalWithVat)
            ? totalWithVat
            : null,
        description:
          [
            projectData.client ? `לקוח: ${projectData.client}` : null,
            projectData.paymentTerms
              ? `תנאי תשלום: ${projectData.paymentTerms}`
              : null,
            projectData.currency ? `מטבע: ${projectData.currency}` : null,
            projectData.notes,
          ]
            .filter(Boolean)
            .join("\n") || null,
        status: "active",
        updatedById: userId,
      },
    });

    // Replace draft BOQ only when safe (new project / no field reports)
    await prisma.boqItem.deleteMany({ where: { projectId } });

    const boqItems = items
      .filter((item) => item.description || item.code)
      .map((item, index) => {
        const baseDescription = cleanBoqDescription(
          item.description || "סעיף ללא תיאור"
        );

        return {
          code: item.code || `${index + 1}`,
          description: baseDescription || "סעיף ללא תיאור",
          unit: item.unit || "יח'",
          contractQuantity: Number(item.contractQuantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          level: item.subChapter ? 2 : item.chapter ? 1 : 0,
        };
      });

    if (boqItems.length > 0) {
      await BOQRepository.createMany(projectId, boqItems, userId);
    }

    const createdItems = await prisma.boqItem.findMany({ where: { projectId } });
    const remainingValue = createdItems.reduce(
      (sum, item) => sum + Number(item.remainingValue),
      0
    );

    await prisma.project.update({
      where: { id: projectId },
      data: {
        completedValue: 0,
        invoicedValue: 0,
        progress: 0,
        financialProgress: 0,
        contractValue: contractValue || remainingValue || contractValue,
      },
    });

    await prisma.activity.create({
      data: {
        projectId,
        type: "project_updated",
        title: "פרויקט אושר מ-PDF",
        description: `אושרו ${boqItems.length} סעיפי BOQ מניתוח AI`,
        userId,
      },
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "Project",
      entityId: projectId,
      userId,
      metadata: {
        parseLogId,
        approvedItems: boqItems.length,
        source: "gemini_contract_boq",
        vat: { subtotal, vatPercent, vatAmount, totalWithVat },
      },
    });

    if (parseLogId) {
      await AiParseRepository.update(parseLogId, {
        status: "confirmed",
        resultJson: JSON.stringify({ project: projectData, items }),
      });
    }

    if (body.ownerId !== undefined) {
      if (!canAssignProjectManager(role)) {
        return apiError("אין הרשאה להקצות מנהל פרויקט", 403);
      }
      await ProjectsRepository.assignProjectManager(
        projectId,
        body.ownerId ? String(body.ownerId) : null,
        userId
      );
    }

    const project = await ProjectsRepository.findById(projectId);
    return apiSuccess({ project, itemsCount: boqItems.length });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint") &&
      error.message.includes("contractNumber")
    ) {
      return apiError("מספר חוזה כבר קיים במערכת");
    }
    return handleApiError(error);
  }
}
