import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectsRepository } from "@/repositories/projects.repository";
import { BOQRepository } from "@/repositories/boq.repository";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { AuditRepository } from "@/repositories/audit.repository";
import { getAuthContext } from "@/lib/auth/session";
import type { ParsedBoqItem, ParsedProjectDetails } from "@/lib/ai/types";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
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

    // Update project details (including unique contract number carefully)
    await prisma.project.update({
      where: { id: projectId },
      data: {
        name: projectData.name.trim(),
        contractNumber: projectData.contractNumber.trim(),
        contractor: projectData.contractor.trim(),
        location: projectData.location.trim(),
        contractValue,
        description:
          [
            projectData.client ? `לקוח: ${projectData.client}` : null,
            projectData.paymentTerms ? `תנאי תשלום: ${projectData.paymentTerms}` : null,
            projectData.currency ? `מטבע: ${projectData.currency}` : null,
            projectData.notes,
          ]
            .filter(Boolean)
            .join("\n") || null,
        status: "active",
        updatedById: userId,
      },
    });

    // Replace BOQ with reviewed items
    await prisma.boqItem.deleteMany({ where: { projectId } });

    const boqItems = items
      .filter((item) => item.description || item.code)
      .map((item, index) => {
        const chapterPrefix = [item.chapter, item.subChapter, item.category]
          .filter(Boolean)
          .join(" / ");
        const baseDescription = item.description || "סעיף ללא תיאור";

        return {
          code: item.code || `${index + 1}`,
          description: chapterPrefix
            ? `[${chapterPrefix}] ${baseDescription}`
            : baseDescription,
          unit: item.unit || "יח'",
          contractQuantity: Number(item.contractQuantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          chapter: item.chapter,
          subChapter: item.subChapter,
          category: item.category,
          sortOrder: item.sortOrder ?? index + 1,
          level: item.subChapter ? 2 : item.chapter ? 1 : 0,
        };
      });

    if (boqItems.length > 0) {
      await BOQRepository.createMany(projectId, boqItems, userId);
    }

    // Recalculate project completed/remaining value
    const createdItems = await prisma.boqItem.findMany({ where: { projectId } });
    const remainingValue = createdItems.reduce(
      (sum, item) => sum + Number(item.remainingValue),
      0
    );

    await prisma.project.update({
      where: { id: projectId },
      data: {
        completedValue: 0,
        progress: 0,
        contractValue: contractValue || remainingValue || contractValue,
      },
    });

    await prisma.activity.create({
      data: {
        projectId,
        type: "project_updated",
        title: "פרויקט אושר מ-PDF",
        description: `אושרו ${boqItems.length} סעיפי BOQ מניתוח Gemini`,
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
      },
    });

    if (parseLogId) {
      await AiParseRepository.update(parseLogId, {
        status: "confirmed",
        resultJson: JSON.stringify({ project: projectData, items }),
      });
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
