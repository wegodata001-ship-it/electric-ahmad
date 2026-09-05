"use client";

import type { DeliveryNote } from "@/types";
import { formatDate, formatNumber } from "@/utils/format";
import { COMPANY_PROFILE } from "@/config/company";

/**
 * @deprecated Legacy layout — use DeliveryNoteTemplate from @/lib/pdf-engine.
 * Kept temporarily for any non-print previews; print routes use the central engine.
 */
export function DeliveryNoteDocument({ note }: { note: DeliveryNote }) {
  const blue = COMPANY_PROFILE.brandBlue;

  return (
    <div className="dn-sheet mx-auto max-w-[210mm] bg-white px-8 py-7 text-[#111827] shadow-lg print:my-0 print:shadow-none">
      {/* Header */}
      <header
        className="mb-5 flex justify-between gap-6 pb-4"
        style={{ borderBottom: `2px solid ${blue}` }}
      >
        <div className="flex items-start gap-3">
          {COMPANY_PROFILE.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={COMPANY_PROFILE.logoUrl}
              alt={COMPANY_PROFILE.name}
              className="h-16 w-16 object-contain"
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center text-sm font-bold text-white"
              style={{ background: blue }}
            >
              {COMPANY_PROFILE.logoText}
            </div>
          )}
          <div className="text-[11px] leading-relaxed text-gray-700">
            <p className="text-[15px] font-bold" style={{ color: blue }}>
              {COMPANY_PROFILE.name}
            </p>
            {COMPANY_PROFILE.legalName &&
              COMPANY_PROFILE.legalName !== COMPANY_PROFILE.name && (
                <p>{COMPANY_PROFILE.legalName}</p>
              )}
            {COMPANY_PROFILE.activity && <p>{COMPANY_PROFILE.activity}</p>}
            {COMPANY_PROFILE.vatId && <p>ע.מ / ח.פ: {COMPANY_PROFILE.vatId}</p>}
            {COMPANY_PROFILE.address && <p>{COMPANY_PROFILE.address}</p>}
            {COMPANY_PROFILE.phone && <p dir="ltr">{COMPANY_PROFILE.phone}</p>}
            {COMPANY_PROFILE.email && <p dir="ltr">{COMPANY_PROFILE.email}</p>}
          </div>
        </div>
        <div className="min-w-[170px] text-left">
          <p className="text-[22px] font-bold leading-tight" style={{ color: blue }}>
            תעודת משלוח
          </p>
          <div
            className="mt-3 space-y-1 rounded border px-3 py-2 text-[12px]"
            style={{ borderColor: `${blue}55`, background: COMPANY_PROFILE.brandBlueLight }}
          >
            <p>
              <span className="text-gray-500">מספר תעודה: </span>
              <span className="font-bold">{note.noteNumber}</span>
            </p>
            <p>
              <span className="text-gray-500">תאריך: </span>
              {formatDate(note.date)}
            </p>
          </div>
        </div>
      </header>

      {/* Header fields */}
      <section className="mb-5 grid grid-cols-2 gap-x-8 gap-y-2 border border-gray-300 p-3 text-[12px]">
        <Field label="פרויקט" value={note.projectName} />
        <Field label="לקוח" value={note.client} />
        <Field
          label="כתובת"
          value={[note.address, note.city].filter(Boolean).join(", ")}
        />
        <Field label="איש קשר" value={note.contactName} />
        <Field label="טלפון" value={note.phone} ltr />
        <Field label="מספר רכב" value={note.vehicleNumber || note.vehicle} />
      </section>

      {/* Items — exact columns from template */}
      <section className="mb-5">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr style={{ background: blue, color: "#fff" }}>
              <th className="w-[12%] border border-gray-400 px-2 py-2 text-right font-semibold">
                כמות
              </th>
              <th className="w-[12%] border border-gray-400 px-2 py-2 text-right font-semibold">
                יחידה
              </th>
              <th className="border border-gray-400 px-2 py-2 text-right font-semibold">
                תיאור הפריט
              </th>
              <th className="w-[28%] border border-gray-400 px-2 py-2 text-right font-semibold">
                הערות
              </th>
            </tr>
          </thead>
          <tbody>
            {note.items.map((item, index) => (
              <tr
                key={item.id || index}
                style={{ background: index % 2 === 0 ? "#fff" : "#f9fafb" }}
              >
                <td className="border border-gray-300 px-2 py-2 font-medium">
                  {formatNumber(item.quantity)}
                </td>
                <td className="border border-gray-300 px-2 py-2">{item.unit}</td>
                <td className="border border-gray-300 px-2 py-2">
                  {item.description}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-gray-600">
                  {item.notes || ""}
                </td>
              </tr>
            ))}
            {/* Empty rows for paper-like look when few items */}
            {note.items.length < 6 &&
              Array.from({ length: 6 - note.items.length }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-gray-300 px-2 py-3">&nbsp;</td>
                  <td className="border border-gray-300 px-2 py-3" />
                  <td className="border border-gray-300 px-2 py-3" />
                  <td className="border border-gray-300 px-2 py-3" />
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      {/* Notes */}
      <section className="mb-6 min-h-[56px] border border-gray-300 p-3 text-[12px]">
        <p className="mb-1 text-[11px] font-bold" style={{ color: blue }}>
          הערות
        </p>
        <p className="min-h-[32px] whitespace-pre-wrap text-gray-800">
          {note.notes || ""}
        </p>
      </section>

      {/* Signatures */}
      <section className="mb-6 grid grid-cols-2 gap-6 text-[12px] sm:grid-cols-4">
        <div className="border border-gray-300 p-3">
          <p className="mb-2 font-bold" style={{ color: blue }}>
            שם מקבל
          </p>
          <p className="min-h-[36px] font-semibold">
            {note.receiverName || ""}
          </p>
        </div>
        <div className="border border-gray-300 p-3">
          <p className="mb-2 font-bold" style={{ color: blue }}>
            חתימת מקבל
          </p>
          <div className="flex h-16 items-center justify-center">
            {note.receiverSignatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={note.receiverSignatureUrl}
                alt="חתימת מקבל"
                className="max-h-16 max-w-full object-contain"
              />
            ) : (
              <div className="h-10 w-full border-b border-gray-400" />
            )}
          </div>
        </div>
        <div className="border border-gray-300 p-3">
          <p className="mb-2 font-bold" style={{ color: blue }}>
            חתימת עובד
          </p>
          <div className="flex h-16 flex-col items-center justify-center gap-1">
            {note.employeeSignatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={note.employeeSignatureUrl}
                alt="חתימת עובד"
                className="max-h-14 max-w-full object-contain"
              />
            ) : (
              <div className="h-10 w-full border-b border-gray-400" />
            )}
            {note.employeeSignedName && (
              <p className="text-[10px] text-gray-500">{note.employeeSignedName}</p>
            )}
          </div>
        </div>
        <div className="border border-gray-300 p-3">
          <p className="mb-2 font-bold" style={{ color: blue }}>
            תאריך קבלה
          </p>
          <p className="min-h-[36px] font-semibold">
            {note.receivedAt ? formatDate(note.receivedAt) : ""}
          </p>
        </div>
      </section>

      <footer
        className="flex justify-between pt-3 text-[10px] text-gray-500"
        style={{ borderTop: "1px solid #e5e7eb" }}
      >
        <span>{COMPANY_PROFILE.name}</span>
        <span>תעודת משלוח {note.noteNumber}</span>
      </footer>
    </div>
  );
}

function Field({
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
