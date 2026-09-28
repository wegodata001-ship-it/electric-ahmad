import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow/types";
import { PdfFooterBar, PdfLetterhead, PdfSignatureBlock } from "../letterhead";
import { formatDate, formatDateTime, formatNumber } from "@/utils/format";

export type WorkDiaryPdfModel = {
  documentNumber: string;
  status: string;
  statusLabel?: string;
  workDate: string;
  generatedAt: string;
  weather?: string | null;
  workType?: string | null;
  workSummary?: string | null;
  notes?: string | null;
  projectName: string;
  siteLabel: string;
  clientName?: string | null;
  address?: string | null;
  projectManagerName?: string | null;
  foremanName?: string | null;
  foremanSignatureUrl?: string | null;
  foremanSignedName?: string | null;
  foremanSignedAt?: string | null;
  clientSignatureUrl?: string | null;
  clientSignedName?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  workItems: {
    lineNumber: number;
    description: string;
    quantity: number;
    unit: string;
  }[];
  workers: {
    name: string;
    startTime?: string | null;
    endTime?: string | null;
    hours?: number;
    notes?: string | null;
  }[];
  approvals: {
    approverName: string;
    roleLabel: string;
    statusLabel: string;
    date?: string | null;
  }[];
  events: {
    date: string;
    actorName: string;
    action: string;
  }[];
  attachments: { name: string }[];
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
  const totalHours = model.workers.reduce(
    (sum, worker) => sum + (Number(worker.hours) || 0),
    0
  );
  const footerNumber = model.documentNumber.replace(/["\\]/g, "");
  const generatedLabel = formatDateTime(model.generatedAt).replace(/["\\]/g, "");

  return (
    <div data-pdf-template="work_diary">
      <style>{`
        @page {
          @bottom-left {
            content: "${footerNumber}";
            font-family: Assistant, Heebo, Arial, sans-serif;
            font-size: 8px;
            color: #6b7280;
          }
          @bottom-right {
            content: "הופק ${generatedLabel}";
            font-family: Assistant, Heebo, Arial, sans-serif;
            font-size: 8px;
            color: #6b7280;
          }
        }
      `}</style>
      <PdfLetterhead
        documentTitle="יומן עבודה"
        meta={[
          { label: "מספר", value: model.documentNumber },
          { label: "תאריך", value: formatDate(model.workDate) },
          { label: "סטטוס", value: statusLabel },
        ]}
      />

      {model.status === "approved" && (
        <section className="pdf-avoid-break mb-3 flex items-center justify-between border-y-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
          <span className="text-[15px] font-bold">✓ מאושר</span>
          <span>
            {model.approvedByName || "מאשר מוסמך"}
            {model.approvedAt ? ` · ${formatDateTime(model.approvedAt)}` : ""}
          </span>
        </section>
      )}

      <section className="pdf-avoid-break mb-3 grid grid-cols-2 gap-2 border border-gray-300 p-3 text-[12px]">
        <Field label="פרויקט" value={model.projectName} />
        <Field label="אתר / מיקום" value={model.siteLabel} />
        <Field label="לקוח" value={model.clientName} />
        <Field label="כתובת" value={model.address} />
        <Field label="מנהל פרויקט" value={model.projectManagerName} />
        <Field label="מנהל שטח" value={model.foremanName} />
        <Field label="אזור / סוג עבודה" value={model.workType} />
        <Field label="מזג אוויר" value={model.weather} />
      </section>

      {model.workSummary && (
        <section className="pdf-avoid-break mb-3">
          <h2 className="mb-1 text-[13px] font-bold text-slate-800">סיכום העבודה</h2>
          <p className="whitespace-pre-wrap border border-gray-200 bg-gray-50 p-3 text-[12px]">
            {model.workSummary}
          </p>
        </section>
      )}

      {model.workItems.length > 0 && (
        <section className="mb-3">
          <h2 className="mb-1 text-[13px] font-bold">פירוט עבודה</h2>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#1e3a8a] text-white">
                <TableHead>#</TableHead>
                <TableHead>תיאור העבודה</TableHead>
                <TableHead>כמות</TableHead>
                <TableHead>יחידה</TableHead>
              </tr>
            </thead>
            <tbody>
              {model.workItems.map((item) => (
                <tr key={`${item.lineNumber}-${item.description}`}>
                  <TableCell>{item.lineNumber}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{formatNumber(item.quantity, 2)}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {model.workers.length > 0 && (
        <section className="mb-3">
          <h2 className="mb-1 text-[13px] font-bold">עובדים</h2>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#1e3a8a] text-white">
                <TableHead>עובד</TableHead>
                <TableHead>התחלה</TableHead>
                <TableHead>סיום</TableHead>
                <TableHead>סה״כ שעות</TableHead>
                <TableHead>הערות</TableHead>
              </tr>
            </thead>
            <tbody>
              {model.workers.map((w, i) => (
                <tr key={i}>
                  <TableCell>{w.name}</TableCell>
                  <TableCell>{w.startTime || "—"}</TableCell>
                  <TableCell>{w.endTime || "—"}</TableCell>
                  <TableCell>
                    {w.hours != null ? `${formatNumber(w.hours, 2)} שעות` : "—"}
                  </TableCell>
                  <TableCell>{w.notes || ""}</TableCell>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="border px-2 py-1.5" colSpan={3}>
                  סה״כ עובדים: {model.workers.length}
                </td>
                <td className="border px-2 py-1.5" colSpan={2}>
                  סה״כ שעות עבודה: {formatNumber(totalHours, 2)}
                </td>
              </tr>
            </tfoot>
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

      {model.attachments.length > 0 && (
        <section className="pdf-avoid-break mb-4 text-[11px]">
          <h2 className="mb-1 text-[13px] font-bold">קבצים מצורפים</h2>
          <ul className="list-inside list-disc columns-2">
            {model.attachments.map((attachment, index) => (
              <li key={`${attachment.name}-${index}`}>{attachment.name}</li>
            ))}
          </ul>
        </section>
      )}

      <PdfSignatureBlock
        slots={[
          {
            title: "חתימת מנהל עבודה",
            name: model.foremanSignedName || model.foremanName,
            imageUrl: model.foremanSignatureUrl,
            meta: model.foremanSignedAt
              ? formatDateTime(model.foremanSignedAt)
              : null,
          },
          {
            title: "אישור מנהל",
            name: model.approvedByName,
            meta: model.approvedAt ? formatDateTime(model.approvedAt) : null,
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

      {model.approvals.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-1 text-[13px] font-bold">אישורים</h2>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-[#1e3a8a] text-white">
                <TableHead>מאשר</TableHead>
                <TableHead>תפקיד</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תאריך</TableHead>
              </tr>
            </thead>
            <tbody>
              {model.approvals.map((approval, index) => (
                <tr key={`${approval.approverName}-${index}`}>
                  <TableCell>{approval.approverName}</TableCell>
                  <TableCell>{approval.roleLabel}</TableCell>
                  <TableCell>{approval.statusLabel}</TableCell>
                  <TableCell>
                    {approval.date ? formatDateTime(approval.date) : "—"}
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {model.events.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-1 text-[13px] font-bold">היסטוריית פעולות</h2>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-gray-200 text-gray-900">
                <TableHead>תאריך ושעה</TableHead>
                <TableHead>משתמש</TableHead>
                <TableHead>פעולה</TableHead>
              </tr>
            </thead>
            <tbody>
              {model.events.map((event, index) => (
                <tr key={`${event.date}-${index}`}>
                  <TableCell>{formatDateTime(event.date)}</TableCell>
                  <TableCell>{event.actorName}</TableCell>
                  <TableCell>{event.action}</TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <PdfFooterBar
        left={model.documentNumber}
        right={`הופק ${formatDateTime(model.generatedAt)}`}
      />
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

function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="border px-2 py-1.5 text-right font-bold">{children}</th>;
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="border px-2 py-1.5 align-top">{children}</td>;
}
