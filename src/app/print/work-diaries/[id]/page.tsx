import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  PdfPrintShell,
  WorkDiaryTemplate,
} from "@/lib/pdf-engine";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { requireFieldManager } from "@/lib/auth/field-session";
import { userCanAccessProject } from "@/lib/auth/project-access";
import { roleGradeLabel } from "@/lib/auth/document-permissions";
import { approvalStatusLabel } from "@/lib/workflow/approval-status-labels";

type DiaryApproval = {
  status: string;
  sentAt: string;
  decidedAt: string | null;
  approver: { name: string; role?: string | null } | null;
};

type DiaryWorkItem = {
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string;
};

type DiaryWorker = {
  name: string;
  startTime: string | null;
  endTime: string | null;
  hours: number;
  notes: string | null;
};

type DiaryEvent = {
  createdAt: string;
  message: string;
  actor: { name: string } | null;
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const diary = await WorkDiariesRepository.getById(id);

  if (!diary) notFound();

  let authorized = false;
  try {
    const office = await requireOfficeUser();
    authorized = await userCanAccessProject({
      userId: office.userId,
      role: office.role,
      projectId: diary.projectId,
      scope: "operational",
    });
  } catch {
    try {
      const field = await requireFieldManager();
      authorized = diary.foremanId === field.foremanId;
    } catch {
      authorized = false;
    }
  }
  if (!authorized) notFound();

  const approved = diary.approvals?.find(
    (approval: DiaryApproval) => approval.status === "approved"
  );
  const generatedAt = new Date().toISOString();

  return (
    <Suspense fallback={<p className="p-8 text-center">טוען…</p>}>
      <PdfPrintShell title={`Work-Diary-${diary.documentNumber}`}>
        <WorkDiaryTemplate
          model={{
            documentNumber: diary.documentNumber,
            status: diary.status,
            statusLabel: diary.statusLabel,
            workDate: diary.workDate,
            generatedAt,
            weather: diary.weather,
            workType: diary.workType,
            workSummary: diary.workSummary,
            notes: diary.notes,
            projectName: diary.project?.name || "—",
            siteLabel: diary.siteLabel,
            clientName: diary.clientName,
            address: diary.address,
            foremanName: diary.foreman?.name,
            foremanSignatureUrl: diary.foremanSignatureUrl,
            foremanSignedName: diary.foremanSignedName,
            foremanSignedAt: diary.foremanSignedAt,
            clientSignatureUrl: diary.clientSignatureUrl,
            clientSignedName: diary.clientSignedName,
            approvedByName: approved?.approver?.name,
            approvedAt: approved?.decidedAt,
            workItems: (diary.workItems || []).map((item: DiaryWorkItem) => ({
              lineNumber: item.lineNumber,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
            })),
            workers: diary.workers.map((w: DiaryWorker) => ({
              name: w.name,
              startTime: w.startTime,
              endTime: w.endTime,
              hours: w.hours,
              notes: w.notes,
            })),
            approvals: (diary.approvals || []).map((approval: DiaryApproval) => ({
              approverName: approval.approver?.name || "—",
              roleLabel: roleGradeLabel(approval.approver?.role),
              statusLabel: approvalStatusLabel(approval.status),
              date: approval.decidedAt || approval.sentAt,
            })),
            events: (diary.events || []).map((event: DiaryEvent) => ({
              date: event.createdAt,
              actorName: event.actor?.name || "מערכת",
              action: event.message,
            })),
            attachments: (diary.attachments || []).map((attachment) => ({
              name: attachment.name,
            })),
            photos: diary.media || [],
          }}
        />
      </PdfPrintShell>
    </Suspense>
  );
}
