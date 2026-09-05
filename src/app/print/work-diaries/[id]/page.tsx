import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow/types";
import { mapLegacyDiaryStatusToWorkflow } from "@/lib/workflow/work-diary-documents";
import {
  PdfPrintShell,
  WorkDiaryTemplate,
} from "@/lib/pdf-engine";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.workDiary.findFirst({
    where: { id, deletedAt: null },
    include: {
      project: { select: { name: true } },
      foreman: { select: { firstName: true, lastName: true } },
      workers: { orderBy: { sortOrder: "asc" } },
      media: { orderBy: { createdAt: "desc" } },
      workflowDocument: {
        include: {
          attachments: true,
          approvals: {
            where: { status: "approved" },
            include: { approver: { select: { name: true } } },
            take: 1,
            orderBy: { decidedAt: "desc" },
          },
        },
      },
    },
  });

  if (!row) {
    return (
      <p className="p-10 text-center text-red-600" dir="rtl">
        יומן לא נמצא
      </p>
    );
  }

  const status = (row.workflowDocument?.status ||
    mapLegacyDiaryStatusToWorkflow(row.status)) as string;

  const wfPhotos = (row.workflowDocument?.attachments || [])
    .filter((a) => String(a.fileType || "").startsWith("image"))
    .map((a) => ({ url: a.url, name: a.name, stage: null as string | null }));

  const legacyPhotos = row.media.map((m) => ({
    url: m.url,
    name: m.name,
    stage: m.stage,
  }));

  const photos = legacyPhotos.length ? legacyPhotos : wfPhotos;
  const approval = row.workflowDocument?.approvals?.[0];

  return (
    <Suspense fallback={<p className="p-8 text-center">טוען…</p>}>
      <PdfPrintShell title="יומן עבודה">
        <WorkDiaryTemplate
          model={{
            documentNumber: row.documentNumber,
            status,
            statusLabel:
              WORKFLOW_STATUS_LABELS[
                status as keyof typeof WORKFLOW_STATUS_LABELS
              ] || status,
            workDate: row.workDate.toISOString().slice(0, 10),
            weather: row.weather,
            workType: row.workType,
            workSummary: row.workSummary,
            notes: row.notes,
            siteLabel: row.customSiteName || row.project.name,
            clientName: row.clientName,
            address: row.address,
            foremanName: `${row.foreman.firstName} ${row.foreman.lastName}`,
            foremanSignatureUrl: row.foremanSignatureUrl,
            foremanSignedName: row.foremanSignedName,
            clientSignatureUrl: row.clientSignatureUrl,
            clientSignedName: row.clientSignedName,
            approvedByName: approval?.approver?.name,
            approvedAt: approval?.decidedAt
              ? approval.decidedAt.toLocaleString("he-IL")
              : null,
            workers: row.workers.map((w) => ({
              name: w.name,
              startTime: w.startTime,
              endTime: w.endTime,
              hours: w.hours,
              notes: w.notes,
            })),
            photos,
          }}
        />
      </PdfPrintShell>
    </Suspense>
  );
}
