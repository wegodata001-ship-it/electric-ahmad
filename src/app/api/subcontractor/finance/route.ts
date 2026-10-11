import { apiSuccess, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import {
  requireSubcontractorUser,
  requireSubcontractorFinance,
} from "@/lib/auth/subcontractor-session";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

export async function GET() {
  try {
    const session = await requireSubcontractorUser();
    requireSubcontractorFinance(session);
    const [ledger, documents, payments] = await Promise.all([
      SubcontractorsRepository.ledger(session.subcontractorId),
      SubcontractorsRepository.listDocuments(session.subcontractorId),
      prisma.subcontractorPayment.findMany({
        where: { subcontractorId: session.subcontractorId, voidedAt: null },
        orderBy: { paidAt: "desc" },
        include: { account: { select: { id: true, project: { select: { name: true } } } } },
      }),
    ]);
    return apiSuccess({
      ...ledger,
      documents: documents.map(({ id, category, categoryLabel, title, mimeType, sizeBytes, createdAt }) => ({
        id,
        category,
        categoryLabel,
        title,
        mimeType,
        sizeBytes,
        createdAt,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt.toISOString(),
        method: p.method,
        reference: p.reference,
        notes: p.notes,
        accountId: p.accountId,
        projectName: p.account?.project.name ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
