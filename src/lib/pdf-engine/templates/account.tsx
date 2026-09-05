import { COMPANY_PROFILE } from "@/config/company";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/utils/format";
import { PdfFooterBar, PdfLetterhead, PdfSignatureBlock } from "../letterhead";

export type AccountPdfItem = {
  code?: string | null;
  description: string;
  unit?: string | null;
  contractQuantity: number;
  previousQuantity: number;
  quantity: number;
  cumulativeQuantity: number;
  quantityPercent: number;
  unitPrice: number;
  total: number;
  cumulativeAmount: number;
  financialPercent: number;
};

export type AccountPdfModel = {
  /** Document label: חשבון קבלני / חשבונית */
  documentTitle?: string;
  invoiceNumber: string;
  sequenceNumber?: number | string | null;
  date: string | Date;
  billingMonth?: string | null;
  billTo?: string | null;
  contractor?: string | null;
  notes?: string | null;
  projectName?: string | null;
  projectContractNumber?: string | null;
  projectLocation?: string | null;
  projectForemanName?: string | null;
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  totalWithVat: number;
  overallPercent: number;
  items: AccountPdfItem[];
  approverName?: string | null;
  contractorSignUrl?: string | null;
  companySignUrl?: string | null;
};

/**
 * NEW contractor account (חשבון קבלני) template — not the legacy layout.
 * Runs on the central PDF engine only.
 */
export function AccountTemplate({ model }: { model: AccountPdfModel }) {
  const blue = COMPANY_PROFILE.brandBlue;
  const blueDark = COMPANY_PROFILE.brandBlueDark;
  const title = model.documentTitle || "חשבון קבלני";
  const accountNo = String(model.sequenceNumber || model.invoiceNumber);

  return (
    <div data-pdf-template="account">
      <PdfLetterhead
        documentTitle={title}
        meta={[
          { label: "מספר חשבון", value: accountNo },
          { label: "תאריך", value: formatDate(model.date) },
          { label: "חודש חיוב", value: model.billingMonth || "—" },
          {
            label: "מס׳ חוזה / פרויקט",
            value: model.projectContractNumber || "—",
          },
        ]}
      />

      {/* Parties */}
      <section className="pdf-avoid-break mb-4 grid grid-cols-2 gap-3 text-[11px]">
        <PartyCard
          title="לכבוד — הלקוח / המזמין"
          blue={blue}
          rows={[
            ["שם", model.billTo],
            ["קבלן מבצע", model.contractor || COMPANY_PROFILE.name],
          ]}
        />
        <PartyCard
          title="פרטי הפרויקט"
          blue={blue}
          rows={[
            ["שם הפרויקט", model.projectName],
            ["מספר חוזה", model.projectContractNumber],
            ["מיקום", model.projectLocation],
            ["מנהל עבודה", model.projectForemanName],
          ]}
        />
      </section>

      <p className="mb-2 text-[11px] text-gray-600">
        חשבון זה מבוסס על מדידות וביצוע מצטבר בפרויקט. הסכומים במטבע ש״ח.
      </p>

      {/* BOQ progress table — redesigned columns */}
      <section className="mb-4 overflow-hidden rounded border border-gray-300">
        <div
          className="px-3 py-1.5 text-[11px] font-bold text-white"
          style={{ background: blueDark }}
        >
          פירוט סעיפים — ביצוע מצטבר
        </div>
        <table className="w-full border-collapse text-[8px]">
          <thead>
            <tr style={{ background: `${blue}18` }}>
              <Th>סעיף</Th>
              <Th>תיאור העבודה</Th>
              <Th>יח׳</Th>
              <Th>כמות חוזה</Th>
              <Th>בוצע קודם</Th>
              <Th>בוצע בתקופה</Th>
              <Th>מצטבר</Th>
              <Th>% כמותי</Th>
              <Th>מחיר יח׳</Th>
              <Th>סכום תקופה</Th>
              <Th>סכום מצטבר</Th>
              <Th>% כספי</Th>
            </tr>
          </thead>
          <tbody>
            {model.items.map((item, index) => (
              <tr
                key={`${item.code}-${index}`}
                style={{
                  background: index % 2 === 0 ? "#fff" : "#f8fafc",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <Td mono>{item.code || "—"}</Td>
                <Td strong>{item.description}</Td>
                <Td>{item.unit || "—"}</Td>
                <Td align="right">{formatNumber(item.contractQuantity)}</Td>
                <Td align="right">{formatNumber(item.previousQuantity)}</Td>
                <Td align="right" strong>
                  {formatNumber(item.quantity)}
                </Td>
                <Td align="right">{formatNumber(item.cumulativeQuantity)}</Td>
                <Td align="right">{formatPercent(item.quantityPercent)}</Td>
                <Td align="right">{formatCurrency(item.unitPrice)}</Td>
                <Td align="right" strong>
                  {formatCurrency(item.total)}
                </Td>
                <Td align="right">{formatCurrency(item.cumulativeAmount)}</Td>
                <Td align="right">{formatPercent(item.financialPercent)}</Td>
              </tr>
            ))}
            {model.items.length === 0 && (
              <tr>
                <td colSpan={12} className="py-8 text-center text-[11px] text-gray-400">
                  אין סעיפים בחשבון זה
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* New totals block */}
      <section className="pdf-avoid-break mb-4 grid grid-cols-[1.2fr_0.8fr] gap-3">
        <div className="rounded border border-gray-300 p-3 text-[11px]">
          <p className="mb-2 font-bold" style={{ color: blue }}>
            הערות לחשבון
          </p>
          <p className="min-h-[56px] whitespace-pre-wrap text-gray-700">
            {model.notes?.trim() || "—"}
          </p>
          <p className="mt-3 text-[10px] text-gray-500">
            אחוז ביצוע כולל (משוקלל):{" "}
            <span className="font-bold text-gray-800">
              {formatPercent(model.overallPercent)}
            </span>
            {" · "}
            מספר סעיפים:{" "}
            <span className="font-bold text-gray-800">{model.items.length}</span>
          </p>
        </div>

        <div
          className="overflow-hidden rounded border text-[11px]"
          style={{ borderColor: `${blue}66` }}
        >
          <div
            className="px-3 py-1.5 font-bold text-white"
            style={{ background: blue }}
          >
            סיכום לתשלום
          </div>
          <div className="space-y-2 p-3">
            <SumRow label='סה"כ לפני מע"מ' value={formatCurrency(model.subtotal)} />
            <SumRow
              label={`מע"מ (${formatNumber(model.vatPercent, 1)}%)`}
              value={formatCurrency(model.vatAmount)}
            />
            <div className="border-t border-gray-200 pt-2">
              <p className="text-[10px] text-gray-500">סה&quot;כ כולל מע&quot;מ</p>
              <p className="text-[22px] font-bold" style={{ color: blueDark }}>
                {formatCurrency(model.totalWithVat)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <PdfSignatureBlock
        slots={[
          {
            title: "חתימת קבלן / מגיש",
            name: model.contractor || COMPANY_PROFILE.name,
            imageUrl: model.contractorSignUrl,
          },
          {
            title: "אישור מנהל",
            name: model.approverName,
          },
          {
            title: "חתימת מזמין / לקוח",
            name: model.billTo,
            imageUrl: model.companySignUrl,
          },
          {
            title: "תאריך",
            name: formatDate(model.date),
          },
        ]}
      />

      <PdfFooterBar
        left={`${title} ${accountNo}`}
        right={`${COMPANY_PROFILE.name} · עמוד להמשך אוטומטי בהדפסה`}
      />
    </div>
  );
}

function PartyCard({
  title,
  blue,
  rows,
}: {
  title: string;
  blue: string;
  rows: [string, string | null | undefined][];
}) {
  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: `${blue}44` }}>
      <div className="px-3 py-1.5 text-[10px] font-bold text-white" style={{ background: blue }}>
        {title}
      </div>
      <div className="space-y-1 px-3 py-2.5">
        {rows.map(([label, value]) => (
          <p key={label}>
            <span className="text-gray-500">{label}: </span>
            <span className="font-semibold">{value?.trim() || "—"}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-gray-300 px-1 py-1.5 text-right font-bold text-gray-800">
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  mono,
  strong,
}: {
  children: React.ReactNode;
  align?: "right";
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-1 py-1 align-middle ${mono ? "font-mono text-gray-600" : ""} ${strong ? "font-semibold" : ""}`}
      style={{ textAlign: align }}
    >
      {children}
    </td>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

/** Tax invoice variant — same engine, invoice title */
export function InvoiceTemplate({ model }: { model: AccountPdfModel }) {
  return (
    <AccountTemplate
      model={{ ...model, documentTitle: model.documentTitle || "חשבונית מס" }}
    />
  );
}
