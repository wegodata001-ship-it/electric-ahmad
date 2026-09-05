import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow/types";
import { PdfFooterBar, PdfLetterhead, PdfSignatureBlock } from "../letterhead";

export type WorkDiaryPdfModel = {
  documentNumber: string;
  status: string;
  statusLabel?: string;
  workDate: string;
  weather?: string | null;
  workType?: string | null;
  workSummary?: string | null;
  notes?: string | null;
  siteLabel: string;
  clientName?: string | null;
  address?: string | null;
  foremanName?: string | null;
  foremanSignatureUrl?: string | null;
  foremanSignedName?: string | null;
  clientSignatureUrl?: string | null;
  clientSignedName?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  workers: {
    name: string;
    startTime?: string | null;
    endTime?: string | null;
    hours?: number;
    notes?: string | null;
  }[];
  photos: { url: string; stage?: string | null; name?: string }[];
};

const STAGE_HE: Record<string, string> = {
  site: "אתר",
  execution: "ביצוע",
  before: "לפני",
  after: "אחרי",
  other: "אחר",
};

export function WorkDiaryTemplate({ model }: { model: WorkDiaryPdfModel }) {
  const statusLabel =
    model.statusLabel ||
    WORKFLOW_STATUS_LABELS[model.status as keyof typeof WORKFLOW_STATUS_LABELS] ||
    model.status;

  return (
    <div data-pdf-template="work_diary">
      <PdfLetterhead
        documentTitle="יומן עבודה"
        meta={[
          { label: "מספר", value: model.documentNumber },
          { label: "תאריך", value: model.workDate },
          { label: "סטטוס", value: statusLabel },
        ]}
      />

      <section className="pdf-avoid-break mb-3 grid grid-cols-2 gap-2 border border-gray-300 p-3 text-[12px]">
        <Field label="פרויקט / אתר" value={model.siteLabel} />
        <Field label="לקוח" value={model.clientName} />
        <Field label="כתובת" value={model.address} />
        <Field label="מנהל עבודה" value={model.foremanName} />
        <Field label="סוג עבודה" value={model.workType} />
        <Field label="מזג אוויר" value={model.weather} />
      </section>

      {model.workSummary && (
        <section className="pdf-avoid-break mb-3">
          <h2 className="mb-1 text-[13px] font-bold text-slate-800">תיאור העבודה</h2>
          <p className="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-[12px]">
            {model.workSummary}
          </p>
        </section>
      )}

      {model.workers.length > 0 && (
        <section className="mb-3">
          <h2 className="mb-1 text-[13px] font-bold">עובדים</h2>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="border px-2 py-1 text-right">שם</th>
                <th className="border px-2 py-1 text-right">התחלה</th>
                <th className="border px-2 py-1 text-right">סיום</th>
                <th className="border px-2 py-1 text-right">שעות</th>
                <th className="border px-2 py-1 text-right">הערות</th>
              </tr>
            </thead>
            <tbody>
              {model.workers.map((w, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{w.name}</td>
                  <td className="border px-2 py-1">{w.startTime || "—"}</td>
                  <td className="border px-2 py-1">{w.endTime || "—"}</td>
                  <td className="border px-2 py-1">{w.hours ?? "—"}</td>
                  <td className="border px-2 py-1">{w.notes || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {model.notes && (
        <section className="pdf-avoid-break mb-3 text-[12px]">
          <h2 className="mb-1 text-[13px] font-bold">הערות</h2>
          <p className="whitespace-pre-wrap">{model.notes}</p>
        </section>
      )}

      {model.photos.length > 0 && (
        <section className="mb-3">
          <h2 className="mb-2 text-[13px] font-bold">תמונות</h2>
          <div className="grid grid-cols-2 gap-3">
            {model.photos.map((p, i) => (
              <figure key={i} className="overflow-hidden rounded border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-36 w-full object-cover" />
                {p.stage && (
                  <figcaption className="bg-gray-50 px-2 py-1 text-[10px]">
                    {STAGE_HE[p.stage] || p.stage}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      <PdfSignatureBlock
        slots={[
          {
            title: "חתימת יוצר המסמך",
            name: model.foremanSignedName || model.foremanName,
            imageUrl: model.foremanSignatureUrl,
          },
          {
            title: "אישור מנהל",
            name: model.approvedByName,
            meta: model.approvedAt,
          },
          ...(model.clientSignatureUrl
            ? [
                {
                  title: "חתימת לקוח",
                  name: model.clientSignedName,
                  imageUrl: model.clientSignatureUrl,
                },
              ]
            : []),
        ]}
      />

      <PdfFooterBar left={`יומן עבודה ${model.documentNumber}`} />
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <p>
      <span className="text-gray-500">{label}: </span>
      <span className="font-semibold">{value || "—"}</span>
    </p>
  );
}
