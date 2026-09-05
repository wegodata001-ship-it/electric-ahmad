import { COMPANY_PROFILE } from "@/config/company";
import { PdfFooterBar } from "../letterhead";

export type DeliveryNotePdfModel = {
  documentNumber: string;
  statusLabel: string;
  noteDate: string;
  noteTime?: string | null;
  projectName?: string | null;
  clientName: string;
  address?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  foremanName?: string | null;
  notes?: string | null;
  foremanSignatureUrl?: string | null;
  foremanSignedName?: string | null;
  clientSignatureUrl?: string | null;
  clientSignedName?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  items: {
    description: string;
    quantity: number | string;
    unit?: string | null;
    notes?: string | null;
  }[];
  photos: { url: string; stage?: string | null; name?: string }[];
};

const STAGE_HE: Record<string, string> = {
  cargo: "סחורה",
  unloading: "פריקה",
  damage: "נזק",
  other: "אחר",
  loading: "טעינה",
};

/** Minimum body rows so a short list still fills the table professionally */
const MIN_ITEM_ROWS = 6;

/**
 * Official delivery-note PDF layout — A4 RTL, dense & readable.
 * Data/model unchanged; print routes stay the same.
 */
export function DeliveryNoteTemplate({ model }: { model: DeliveryNotePdfModel }) {
  const blue = COMPANY_PROFILE.brandBlue;
  const blueDark = COMPANY_PROFILE.brandBlueDark;
  const dateDisplay = model.noteTime
    ? `${model.noteDate} · ${model.noteTime}`
    : model.noteDate;

  const paddedItems = padItems(model.items, MIN_ITEM_ROWS);
  const photoLayout = photoGridClass(model.photos.length);

  return (
    <div
      data-pdf-template="delivery_note"
      className="text-[12.5px] leading-snug text-slate-900"
      dir="rtl"
    >
      {/* ── 1. Header: logo + company · document title ── */}
      <header
        className="pdf-avoid-break mb-3 flex items-stretch justify-between gap-4 pb-3"
        style={{ borderBottom: `3px solid ${blue}` }}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {COMPANY_PROFILE.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={COMPANY_PROFILE.logoUrl}
              alt={COMPANY_PROFILE.name}
              className="h-14 w-14 shrink-0 object-contain"
            />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center text-sm font-bold text-white"
              style={{ background: blue }}
            >
              {COMPANY_PROFILE.logoText}
            </div>
          )}
          <div className="min-w-0 text-[10.5px] leading-relaxed text-slate-600">
            <p className="text-[15px] font-bold leading-tight" style={{ color: blue }}>
              {COMPANY_PROFILE.name}
            </p>
            {COMPANY_PROFILE.legalName &&
              COMPANY_PROFILE.legalName !== COMPANY_PROFILE.name && (
                <p className="truncate">{COMPANY_PROFILE.legalName}</p>
              )}
            {COMPANY_PROFILE.activity && <p>{COMPANY_PROFILE.activity}</p>}
            <div className="mt-0.5 flex flex-wrap gap-x-3">
              {COMPANY_PROFILE.vatId && <span>ע.מ: {COMPANY_PROFILE.vatId}</span>}
              {COMPANY_PROFILE.phone && (
                <span dir="ltr">{COMPANY_PROFILE.phone}</span>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-left">
          <p
            className="text-[22px] font-black leading-none tracking-tight"
            style={{ color: blueDark }}
          >
            תעודת משלוח
          </p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">
            מסמך רשמי · Delivery Note
          </p>
        </div>
      </header>

      {/* ── 2. Document meta strip ── */}
      <section
        className="pdf-avoid-break mb-3 grid grid-cols-3 overflow-hidden rounded-md border text-[12px]"
        style={{ borderColor: `${blue}66` }}
      >
        <MetaCell
          label="מספר תעודה"
          value={model.documentNumber}
          accent={blue}
          strong
        />
        <MetaCell label="תאריך" value={dateDisplay} accent={blue} />
        <MetaCell
          label="סטטוס"
          value={model.statusLabel}
          accent={blue}
          emphasize
        />
      </section>

      {/* ── 3. Project / client / logistics ── */}
      <section
        className="pdf-avoid-break mb-3 overflow-hidden rounded-md border border-slate-300"
      >
        <div
          className="px-3 py-1.5 text-[11px] font-bold text-white"
          style={{ background: blue }}
        >
          פרטי משלוח
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-2.5 sm:grid-cols-3">
          <InfoField label="פרויקט" value={model.projectName} wide />
          <InfoField label="יעד / לקוח" value={model.clientName} wide />
          <InfoField label="כתובת" value={model.address} wide />
          <InfoField
            label="נהג / מנהל עבודה"
            value={model.driverName || model.foremanName}
          />
          <InfoField label="מספר רכב" value={model.vehicleNumber} />
          {model.foremanName && model.driverName && (
            <InfoField label="יוצר המסמך" value={model.foremanName} />
          )}
        </div>
      </section>

      {/* ── 4. Items table ── */}
      <section className="mb-3">
        <div
          className="mb-0 flex items-center justify-between rounded-t-md px-3 py-1.5 text-[11px] font-bold text-white"
          style={{ background: blueDark }}
        >
          <span>פירוט פריטים</span>
          <span className="font-medium opacity-90">
            {model.items.length} שורות
          </span>
        </div>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr style={{ background: blue, color: "#fff" }}>
              <th className="w-10 border border-slate-400 px-2 py-2 text-center font-bold">
                #
              </th>
              <th className="border border-slate-400 px-2 py-2 text-right font-bold">
                תיאור הפריט
              </th>
              <th className="w-16 border border-slate-400 px-2 py-2 text-center font-bold">
                כמות
              </th>
              <th className="w-14 border border-slate-400 px-2 py-2 text-center font-bold">
                יחידה
              </th>
              <th className="w-[28%] border border-slate-400 px-2 py-2 text-right font-bold">
                הערות
              </th>
            </tr>
          </thead>
          <tbody>
            {paddedItems.map((it, i) => {
              const empty = !it.description && !it.quantity;
              return (
                <tr
                  key={i}
                  className="pdf-avoid-break"
                  style={{
                    background: empty
                      ? "#fff"
                      : i % 2 === 0
                        ? "#fff"
                        : "#f8fafc",
                    minHeight: 28,
                  }}
                >
                  <td className="border border-slate-300 px-2 py-2 text-center text-slate-400">
                    {empty ? "" : i + 1}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-right font-medium">
                    {it.description || "\u00A0"}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center font-semibold tabular-nums">
                    {empty ? "" : it.quantity}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center text-slate-600">
                    {empty ? "" : it.unit || "יח'"}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-right text-slate-600">
                    {it.notes || "\u00A0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ── 5. Notes ── */}
      <section className="pdf-avoid-break mb-3 overflow-hidden rounded-md border border-slate-300">
        <div
          className="px-3 py-1.5 text-[11px] font-bold text-white"
          style={{ background: blue }}
        >
          הערות
        </div>
        <div className="min-h-[52px] px-3 py-2.5 text-[12.5px] whitespace-pre-wrap text-slate-800">
          {model.notes?.trim() || (
            <span className="text-slate-400">אין הערות</span>
          )}
        </div>
      </section>

      {/* ── 6. Photos gallery ── */}
      {model.photos.length > 0 && (
        <section className="pdf-avoid-break mb-3 overflow-hidden rounded-md border border-slate-300">
          <div
            className="px-3 py-1.5 text-[11px] font-bold text-white"
            style={{ background: blue }}
          >
            תמונות ({model.photos.length})
          </div>
          <div className={`grid gap-2.5 p-3 ${photoLayout}`}>
            {model.photos.map((p, i) => (
              <figure
                key={i}
                className="overflow-hidden rounded border border-slate-200 bg-slate-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.name || `תמונה ${i + 1}`}
                  className={
                    model.photos.length === 1
                      ? "mx-auto max-h-[220px] w-auto max-w-full object-contain"
                      : model.photos.length === 2
                        ? "h-[150px] w-full object-cover"
                        : "h-[120px] w-full object-cover"
                  }
                />
                {(p.stage || p.name) && (
                  <figcaption className="border-t border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600">
                    {p.stage ? STAGE_HE[p.stage] || p.stage : p.name}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ── 7. Signatures — receiver · manager · creator ── */}
      <section className="pdf-avoid-break mb-2 grid grid-cols-3 gap-2.5">
        <SignatureCard
          title="חתימת מקבל"
          name={model.clientSignedName}
          imageUrl={model.clientSignatureUrl}
          blue={blue}
        />
        <SignatureCard
          title="אישור מנהל"
          name={model.approvedByName}
          meta={model.approvedAt}
          blue={blue}
        />
        <SignatureCard
          title="חתימת יוצר המסמך"
          name={model.foremanSignedName || model.foremanName}
          imageUrl={model.foremanSignatureUrl}
          blue={blue}
        />
      </section>

      <PdfFooterBar
        left={`תעודת משלוח ${model.documentNumber} · ${dateDisplay}`}
        right={`${COMPANY_PROFILE.name} · מסמך רשמי`}
      />
    </div>
  );
}

function padItems(
  items: DeliveryNotePdfModel["items"],
  minRows: number
): DeliveryNotePdfModel["items"] {
  if (items.length >= minRows) return items;
  const pad = Array.from({ length: minRows - items.length }, () => ({
    description: "",
    quantity: "",
    unit: "",
    notes: "",
  }));
  return [...items, ...pad];
}

function photoGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1 place-items-center";
  if (count === 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-3";
  return "grid-cols-2 sm:grid-cols-3";
}

function MetaCell({
  label,
  value,
  accent,
  strong,
  emphasize,
}: {
  label: string;
  value: string;
  accent: string;
  strong?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div
      className="border-l border-slate-200 px-3 py-2 last:border-l-0"
      style={
        emphasize
          ? { background: `${accent}12` }
          : { background: "#fff" }
      }
    >
      <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={
          strong
            ? "mt-0.5 text-[15px] font-black tabular-nums"
            : "mt-0.5 text-[13px] font-bold"
        }
        style={strong || emphasize ? { color: accent } : undefined}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function InfoField({
  label,
  value,
  wide,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-1 sm:col-span-1" : undefined}>
      <p className="text-[9.5px] font-semibold text-slate-500">{label}</p>
      <p className="mt-0.5 text-[12.5px] font-semibold text-slate-900">
        {value?.trim() || "—"}
      </p>
    </div>
  );
}

function SignatureCard({
  title,
  name,
  imageUrl,
  meta,
  blue,
}: {
  title: string;
  name?: string | null;
  imageUrl?: string | null;
  meta?: string | null;
  blue: string;
}) {
  return (
    <div className="rounded-md border border-slate-300 bg-white p-2.5">
      <p
        className="mb-2 border-b pb-1 text-[10.5px] font-bold"
        style={{ borderColor: `${blue}44`, color: blue }}
      >
        {title}
      </p>
      <div className="flex h-[64px] items-center justify-center">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[60px] max-w-full object-contain"
          />
        ) : (
          <div className="h-10 w-full border-b border-dashed border-slate-400" />
        )}
      </div>
      <p className="mt-2 min-h-[16px] text-center text-[11px] font-semibold text-slate-800">
        {name?.trim() || "\u00A0"}
      </p>
      {meta && (
        <p className="text-center text-[9px] text-slate-500">{meta}</p>
      )}
    </div>
  );
}
