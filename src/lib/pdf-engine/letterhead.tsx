import { COMPANY_PROFILE } from "@/config/company";

/** Shared company letterhead for all PDF templates */
export function PdfLetterhead({
  documentTitle,
  meta,
}: {
  documentTitle: string;
  meta?: { label: string; value: string }[];
}) {
  const blue = COMPANY_PROFILE.brandBlue;

  return (
    <header
      className="pdf-avoid-break mb-4 flex justify-between gap-4 pb-3"
      style={{ borderBottom: `2.5px solid ${blue}` }}
    >
      <div className="flex items-start gap-3">
        {COMPANY_PROFILE.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={COMPANY_PROFILE.logoUrl}
            alt={COMPANY_PROFILE.name}
            className="h-[68px] w-[68px] object-contain"
          />
        ) : (
          <div
            className="flex h-[68px] w-[68px] items-center justify-center text-sm font-bold text-white"
            style={{ background: blue }}
          >
            {COMPANY_PROFILE.logoText}
          </div>
        )}
        <div className="text-[10.5px] leading-relaxed text-gray-700">
          <p className="text-[16px] font-bold" style={{ color: blue }}>
            {COMPANY_PROFILE.name}
          </p>
          {COMPANY_PROFILE.legalName &&
            COMPANY_PROFILE.legalName !== COMPANY_PROFILE.name && (
              <p>{COMPANY_PROFILE.legalName}</p>
            )}
          {COMPANY_PROFILE.activity && <p>{COMPANY_PROFILE.activity}</p>}
          {COMPANY_PROFILE.vatId && <p>ע.מ / ח.פ: {COMPANY_PROFILE.vatId}</p>}
          {COMPANY_PROFILE.address && <p>{COMPANY_PROFILE.address}</p>}
          <div className="mt-0.5 flex flex-wrap gap-x-3">
            {COMPANY_PROFILE.phone && <span dir="ltr">{COMPANY_PROFILE.phone}</span>}
            {COMPANY_PROFILE.email && <span dir="ltr">{COMPANY_PROFILE.email}</span>}
          </div>
        </div>
      </div>

      <div className="min-w-[168px] text-left">
        <p className="text-[20px] font-bold leading-tight" style={{ color: blue }}>
          {documentTitle}
        </p>
        {meta && meta.length > 0 && (
          <div
            className="mt-2 space-y-0.5 rounded border px-2.5 py-2 text-[11px]"
            style={{
              borderColor: `${blue}55`,
              background: COMPANY_PROFILE.brandBlueLight,
            }}
          >
            {meta.map((m) => (
              <p key={m.label}>
                <span className="text-gray-500">{m.label}: </span>
                <span className="font-bold">{m.value}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export function PdfFooterBar({
  left,
  right,
}: {
  left?: string;
  right?: string;
}) {
  return (
    <footer
      className="pdf-avoid-break mt-3 flex justify-between border-t border-gray-200 pt-2 text-[9px] text-gray-500"
    >
      <span>{left || COMPANY_PROFILE.name}</span>
      <span>{right || "מסמך רשמי · WEGO"}</span>
    </footer>
  );
}

export function PdfSignatureBlock({
  slots,
}: {
  slots: { title: string; name?: string | null; imageUrl?: string | null; meta?: string | null }[];
}) {
  return (
    <section className="pdf-avoid-break mt-5 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(slots.length, 4)}, 1fr)` }}>
      {slots.map((s) => (
        <div key={s.title} className="rounded border border-gray-300 p-2.5 text-[11px]">
          <p className="mb-2 font-bold text-gray-600">{s.title}</p>
          {s.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.imageUrl} alt={s.title} className="h-14 max-w-full object-contain" />
          ) : (
            <div className="h-14 border-b border-dashed border-gray-400" />
          )}
          <p className="mt-2 min-h-[16px] font-semibold">{s.name || " "}</p>
          {s.meta && <p className="text-[9px] text-gray-500">{s.meta}</p>}
        </div>
      ))}
    </section>
  );
}
