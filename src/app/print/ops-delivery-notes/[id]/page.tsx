import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { DeliveryNoteTemplate, PdfPrintShell } from "@/lib/pdf-engine";

const STATUS_HE: Record<string, string> = {
  draft: "טיוטה",
  pending_approval: "ממתין לאישור",
  revision: "נדחה / לתיקון",
  approved: "מאושר",
  signed: "נחתם",
  sent_to_client: "נשלח ללקוח",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.opsDeliveryNote.findFirst({
    where: { id, deletedAt: null },
    include: {
      project: { select: { name: true } },
      foreman: { select: { firstName: true, lastName: true } },
      items: { orderBy: { sortOrder: "asc" } },
      media: { orderBy: { createdAt: "desc" } },
      approvals: {
        where: { status: "approved" },
        include: { approver: { select: { name: true } } },
        take: 1,
        orderBy: { decidedAt: "desc" },
      },
    },
  });

  if (!row) {
    return (
      <p className="p-10 text-center text-red-600" dir="rtl">
        תעודה לא נמצאה
      </p>
    );
  }

  const approval = row.approvals[0];

  return (
    <Suspense fallback={<p className="p-8 text-center">טוען…</p>}>
      <PdfPrintShell title="תעודת משלוח">
        <DeliveryNoteTemplate
          model={{
            documentNumber: row.documentNumber,
            statusLabel: STATUS_HE[row.status] || row.status,
            noteDate: row.noteDate.toISOString().slice(0, 10),
            noteTime: row.noteTime,
            projectName: row.project?.name,
            clientName: row.clientName,
            address: row.address,
            vehicleNumber: row.vehicleNumber,
            driverName: row.driverName,
            foremanName: `${row.foreman.firstName} ${row.foreman.lastName}`,
            notes: row.notes,
            foremanSignatureUrl: row.foremanSignatureUrl,
            foremanSignedName: row.foremanSignedName,
            clientSignatureUrl: row.clientSignatureUrl,
            clientSignedName: row.clientSignedName,
            approvedByName: approval?.approver?.name,
            approvedAt: approval?.decidedAt
              ? approval.decidedAt.toLocaleString("he-IL")
              : null,
            items: row.items.map((it) => ({
              description: it.description,
              quantity: Number(it.quantity),
              unit: it.unit,
              notes: it.notes,
            })),
            photos: row.media.map((m) => ({
              url: m.url,
              name: m.name,
              stage: m.stage,
            })),
          }}
        />
      </PdfPrintShell>
    </Suspense>
  );
}
