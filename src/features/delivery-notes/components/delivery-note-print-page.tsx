"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { deliveryNoteService } from "@/features/delivery-notes/services/delivery-note.service";
import type { DeliveryNote } from "@/types";
import { formatDate, formatNumber } from "@/utils/format";
import { COMPANY_PROFILE } from "@/config/company";

const MIN_ROWS = 12;

export function DeliveryNotePrintPage({ noteId }: { noteId: string }) {
  const searchParams = useSearchParams();
  const [note, setNote] = useState<DeliveryNote | null>(null);

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

  const rows = [...note.items];
  while (rows.length < MIN_ROWS) {
    rows.push({
      id: `empty-${rows.length}`,
      description: "",
      unit: "",
      quantity: 0,
      sortOrder: rows.length + 1,
    });
  }

  const createdLabel = formatDate(note.createdAt);
  const blue = COMPANY_PROFILE.brandBlue;
  const blueLight = COMPANY_PROFILE.brandBlueLight;

  return (
    <div
      className="dn-doc min-h-screen bg-[#eef1f5] text-[#111827] print:bg-white"
      dir="rtl"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Heebo:wght@400;600;700&display=swap');
        .dn-doc { font-family: 'Assistant', 'Heebo', Arial, sans-serif; }
        @page { size: A4; margin: 12mm; }
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .dn-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white/95 border-b border-gray-200 px-4 py-3 flex gap-2 justify-end">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm text-white rounded-lg"
          style={{ background: blue }}
        >
          הדפסה / שמירה כ-PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white"
        >
          סגור
        </button>
      </div>

      <div className="dn-sheet max-w-[210mm] mx-auto my-6 bg-white shadow-lg print:shadow-none print:my-0 px-8 py-7">
        {/* Header */}
        <header
          className="flex justify-between gap-6 pb-5 mb-5"
          style={{ borderBottom: `2px solid ${blue}` }}
        >
          <div className="flex gap-3 items-start">
            {COMPANY_PROFILE.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={COMPANY_PROFILE.logoUrl}
                alt={COMPANY_PROFILE.name}
                className="h-14 w-14 rounded-lg object-contain border border-gray-100"
              />
            ) : (
              <div
                className="h-14 w-14 rounded-lg flex items-center justify-center text-white font-bold text-sm tracking-wide"
                style={{ background: blue }}
              >
                {COMPANY_PROFILE.logoText}
              </div>
            )}
            <div className="text-[12px] leading-relaxed text-gray-700">
              <p className="text-[15px] font-bold" style={{ color: blue }}>
                {COMPANY_PROFILE.name}
              </p>
              {COMPANY_PROFILE.legalName &&
                COMPANY_PROFILE.legalName !== COMPANY_PROFILE.name && (
                  <p>{COMPANY_PROFILE.legalName}</p>
                )}
              {COMPANY_PROFILE.activity && <p>{COMPANY_PROFILE.activity}</p>}
              {COMPANY_PROFILE.vatId && (
                <p>ע.מ / ח.פ: {COMPANY_PROFILE.vatId}</p>
              )}
              {COMPANY_PROFILE.address && <p>{COMPANY_PROFILE.address}</p>}
              {COMPANY_PROFILE.phone && <p dir="ltr">{COMPANY_PROFILE.phone}</p>}
              {COMPANY_PROFILE.email && <p dir="ltr">{COMPANY_PROFILE.email}</p>}
              {COMPANY_PROFILE.website && (
                <p dir="ltr">{COMPANY_PROFILE.website}</p>
              )}
            </div>
          </div>
          <div className="text-left min-w-[160px]">
            <p
              className="text-[22px] font-bold leading-tight"
              style={{ color: blue }}
            >
              תעודת משלוח
            </p>
            <div
              className="mt-3 rounded-md px-3 py-2 text-[12px]"
              style={{ background: blueLight, border: `1px solid ${blue}33` }}
            >
              <p>
                <span className="text-gray-500">מספר: </span>
                <span className="font-bold">{note.noteNumber}</span>
              </p>
              <p className="mt-1">
                <span className="text-gray-500">תאריך: </span>
                {formatDate(note.date)}
              </p>
              <p className="mt-1">
                <span className="text-gray-500">שעה: </span>
                {note.departureTime || "—"}
              </p>
            </div>
          </div>
        </header>

        {/* Client box */}
        <section
          className="rounded-md mb-5 p-4 text-[12px]"
          style={{ border: `1px solid ${blue}40`, background: "#fafcff" }}
        >
          <p
            className="text-[11px] font-bold mb-2 tracking-wide"
            style={{ color: blue }}
          >
            פרטי לקוח
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
            <Row label="לקוח" value={note.client} />
            <Row label="איש קשר" value={note.contactName} />
            <Row label="טלפון" value={note.phone} ltr />
            <Row label="טלפון נוסף" value={note.phoneSecondary} ltr />
            <Row
              label="כתובת"
              value={[note.address, note.city].filter(Boolean).join(", ")}
            />
            <Row label="פרויקט" value={note.projectName} />
            <Row label="מספר הזמנה" value={note.orderNumber} />
            <Row label="יעד" value={note.destination} />
          </div>
        </section>

        {/* Items table */}
        <section className="mb-5">
          <table className="w-full text-[11.5px] border-collapse">
            <thead>
              <tr style={{ background: blue, color: "white" }}>
                <th className="text-right py-2 px-2 font-semibold w-8">#</th>
                <th className="text-right py-2 px-2 font-semibold w-20">מק״ט</th>
                <th className="text-right py-2 px-2 font-semibold">תיאור</th>
                <th className="text-right py-2 px-2 font-semibold w-14">יחידה</th>
                <th className="text-right py-2 px-2 font-semibold w-14">כמות</th>
                <th className="text-right py-2 px-2 font-semibold w-20">ארגז</th>
                <th className="text-right py-2 px-2 font-semibold">הערות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: "1px solid #e5e7eb",
                    background: index % 2 === 0 ? "#fff" : "#f8fafc",
                    height: 28,
                  }}
                >
                  <td className="px-2 py-1.5 text-gray-500">{index + 1}</td>
                  <td className="px-2 py-1.5">{item.sku || ""}</td>
                  <td className="px-2 py-1.5 font-medium">{item.description}</td>
                  <td className="px-2 py-1.5">{item.unit}</td>
                  <td className="px-2 py-1.5">
                    {item.description ? formatNumber(item.quantity) : ""}
                  </td>
                  <td className="px-2 py-1.5">{item.packageNumber || ""}</td>
                  <td className="px-2 py-1.5 text-gray-600">{item.notes || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Notes */}
        <section
          className="rounded-md mb-5 p-3 min-h-[64px] text-[12px]"
          style={{ border: "1px solid #d1d5db" }}
        >
          <p className="text-[11px] font-bold mb-1" style={{ color: blue }}>
            הערות
          </p>
          <p className="text-gray-700 whitespace-pre-wrap min-h-[36px]">
            {note.notes || ""}
          </p>
        </section>

        {/* Transport */}
        <section
          className="rounded-md mb-5 p-4 text-[12px]"
          style={{ border: `1px solid ${blue}40` }}
        >
          <p className="text-[11px] font-bold mb-2" style={{ color: blue }}>
            פרטי הובלה
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
            <Row label="נהג" value={note.driverName} />
            <Row label="רכב" value={note.vehicle} />
            <Row label="מספר רכב" value={note.vehicleNumber} />
            <Row
              label="מוביל חיצוני"
              value={note.externalCarrier ? "כן" : "לא"}
            />
            <Row label="שעת יציאה" value={note.departureTime} />
            <Row label="שעת מסירה" value={note.deliveryTime} />
            <Row label="כתובת יעד" value={note.destinationAddress} />
            <Row label="הערות לנהג" value={note.driverNotes} />
          </div>
        </section>

        {/* Delivery confirmation */}
        <section
          className="rounded-md mb-6 p-4 text-[12px]"
          style={{ border: "1px solid #d1d5db", background: "#fafafa" }}
        >
          <p className="text-[11px] font-bold mb-2" style={{ color: blue }}>
            אישור מסירה
          </p>
          <div className="space-y-1.5">
            <Check
              checked={!!note.equipmentCheckedIntact}
              label="הציוד נבדק ונמסר בשלמותו"
            />
            <Check
              checked={!!note.receivedComplete}
              label="התקבל ללא חוסרים"
            />
            <Check
              checked={!!note.receivedWithNotes}
              label={`התקבל עם הערות${note.receiptNotes ? `: ${note.receiptNotes}` : ""}`}
            />
          </div>
        </section>

        {/* Signatures */}
        <section className="grid grid-cols-2 gap-10 mb-8 text-[12px]">
          <SignatureBlock
            title="חתימת מוסר"
            nameHint="שם מלא"
            dateHint="תאריך"
            checked={!!note.senderSigned}
            blue={blue}
          />
          <SignatureBlock
            title="חתימת מקבל"
            nameHint={note.receiverName || "שם מלא"}
            dateHint={
              note.receivedAt ? formatDate(note.receivedAt) : "תאריך"
            }
            checked={!!note.receiverSigned}
            blue={blue}
          />
        </section>

        {/* Footer */}
        <footer
          className="pt-3 flex justify-between text-[10px] text-gray-500"
          style={{ borderTop: "1px solid #e5e7eb" }}
        >
          <span>עמוד 1 מתוך 1</span>
          <span>נוצר ב־{createdLabel}</span>
          <span>{COMPANY_PROFILE.name}</span>
        </footer>

        {/* Hidden future hooks for integrations */}
        <div className="hidden" data-qr={note.qrCodePayload ?? ""} data-barcode={note.barcodePayload ?? ""} data-status={note.status} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  ltr,
}: {
  label: string;
  value?: string | null;
  ltr?: boolean;
}) {
  return (
    <p>
      <span className="text-gray-500">{label}: </span>
      <span className="font-semibold" dir={ltr ? "ltr" : undefined}>
        {value || "—"}
      </span>
    </p>
  );
}

function Check({ checked, label }: { checked: boolean; label: string }) {
  return (
    <p className="flex items-start gap-2">
      <span
        className="inline-flex h-3.5 w-3.5 mt-0.5 border border-gray-400 rounded-[2px] items-center justify-center text-[10px] leading-none"
        style={{ background: checked ? "#1e40af" : "white", color: "white" }}
      >
        {checked ? "✓" : ""}
      </span>
      <span>{label}</span>
    </p>
  );
}

function SignatureBlock({
  title,
  nameHint,
  dateHint,
  checked,
  blue,
}: {
  title: string;
  nameHint: string;
  dateHint: string;
  checked: boolean;
  blue: string;
}) {
  return (
    <div>
      <p className="font-bold mb-6" style={{ color: blue }}>
        {title} {checked ? "✓" : ""}
      </p>
      <div className="h-16 border-b border-gray-400 mb-3" />
      <p className="text-gray-500 mb-2">שם מלא: {nameHint}</p>
      <p className="text-gray-500">תאריך: {dateHint}</p>
    </div>
  );
}
