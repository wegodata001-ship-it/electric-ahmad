"use client";

import { useEffect, useState, Suspense } from "react";
import { deliveryNoteService } from "@/features/delivery-notes/services/delivery-note.service";
import type { DeliveryNote } from "@/types";
import {
  DeliveryNoteTemplate,
  PdfPrintShell,
} from "@/lib/pdf-engine";

/** Legacy office DeliveryNote — central PDF engine */
export function DeliveryNotePrintPage({ noteId }: { noteId: string }) {
  return (
    <Suspense
      fallback={
        <p className="p-10 text-center text-sm text-gray-400" dir="rtl">
          טוען תעודת משלוח…
        </p>
      }
    >
      <DeliveryNotePrintInner noteId={noteId} />
    </Suspense>
  );
}

function DeliveryNotePrintInner({ noteId }: { noteId: string }) {
  const [note, setNote] = useState<DeliveryNote | null>(null);

  useEffect(() => {
    deliveryNoteService.getById(noteId).then(setNote);
  }, [noteId]);

  if (!note) {
    return (
      <div className="p-10 text-center text-sm text-gray-400" dir="rtl">
        טוען תעודת משלוח…
      </div>
    );
  }

  return (
    <PdfPrintShell title="תעודת משלוח">
      <DeliveryNoteTemplate
        model={{
          documentNumber: note.noteNumber,
          statusLabel: note.status || "—",
          noteDate: String(note.date).slice(0, 10),
          projectName: note.projectName,
          clientName: note.client,
          address: [note.address, note.city].filter(Boolean).join(", "),
          vehicleNumber: note.vehicleNumber || note.vehicle,
          driverName: note.driverName || note.contactName,
          notes: note.notes,
          foremanSignatureUrl: note.employeeSignatureUrl,
          foremanSignedName: note.employeeSignedName,
          clientSignatureUrl: note.receiverSignatureUrl,
          clientSignedName: note.receiverName,
          items: (note.items || []).map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unit: it.unit,
            notes: it.notes,
          })),
          photos: [],
        }}
      />
    </PdfPrintShell>
  );
}
