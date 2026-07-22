"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { deliveryNoteService } from "@/features/delivery-notes/services/delivery-note.service";
import { DeliveryNoteDocument } from "@/features/delivery-notes/components/delivery-note-document";
import type { DeliveryNote } from "@/types";
import { COMPANY_PROFILE } from "@/config/company";

export function DeliveryNotePrintPage({ noteId }: { noteId: string }) {
  const searchParams = useSearchParams();
  const [note, setNote] = useState<DeliveryNote | null>(null);
  const blue = COMPANY_PROFILE.brandBlue;

  useEffect(() => {
    deliveryNoteService.getById(noteId).then((data) => {
      setNote(data);
      window.setTimeout(() => {
        if (searchParams.get("download") || searchParams.get("autoprint")) {
          window.print();
        }
      }, 450);
    });
  }, [noteId, searchParams]);

  if (!note) {
    return (
      <div className="p-10 text-center text-sm text-gray-400" dir="rtl">
        טוען תעודת משלוח...
      </div>
    );
  }

  return (
    <div className="dn-doc min-h-screen bg-[#eef1f5] print:bg-white" dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Heebo:wght@400;600;700&display=swap');
        .dn-doc { font-family: 'Assistant', 'Heebo', Arial, sans-serif; }
        @page { size: A4; margin: 10mm; }
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .dn-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex justify-end gap-2 border-b border-gray-200 bg-white/95 px-4 py-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg px-4 py-2 text-sm text-white"
          style={{ background: blue }}
        >
          הדפסה / שמירה כ-PDF
        </button>
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm"
        >
          סגור
        </button>
      </div>

      <div className="my-6 print:my-0">
        <DeliveryNoteDocument note={note} />
      </div>
    </div>
  );
}
