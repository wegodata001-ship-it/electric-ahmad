import { COMPANY_PROFILE } from "@/config/company";
import {
  formatDate,
  formatNumber,
  formatPercent,
} from "@/utils/format";
import {
  PdfFooterBar,
  PdfLetterhead,
  PdfSignatureBlock,
  type PdfCompanyProfile,
} from "../letterhead";

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
  previousAmount: number;
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
  createdAt?: string | Date | null;
  billingMonth?: string | null;
  billTo?: string | null;
  contractor?: string | null;
  notes?: string | null;
  projectName?: string | null;
  projectContractNumber?: string | null;
  projectLocation?: string | null;
  projectForemanName?: string | null;
  company?: Partial<PdfCompanyProfile>;
  statusLabel?: string | null;
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  totalWithVat: number;
  previousTotal: number;
  currentTotal: number;
  cumulativeTotal: number;
  overallPercent: number;
  items: AccountPdfItem[];
  approverName?: string | null;
  contractorSignUrl?: string | null;
  companySignUrl?: string | null;
};

type ChapterSummary = {
  code: string;
  previous: number;
  current: number;
  cumulative: number;
};

/** The single contractor-account template used by the central PDF engine. */
export function AccountTemplate({ model }: { model: AccountPdfModel }) {
  const company: PdfCompanyProfile = { ...COMPANY_PROFILE, ...model.company };
  const blue = company.brandBlue;
  const blueDark = company.brandBlueDark;
  const title = model.documentTitle || "חשבון חלקי";
  const accountNo = String(model.sequenceNumber || model.invoiceNumber);
  const chapterSummaries = summarizeChapters(model.items);
  const itemCodes = new Set<string>(
    model.items.flatMap((item) => {
      const code = item.code?.trim();
      return code ? [code] : [];
    })
  );
  const companyForCss = company.name.replace(/["\\]/g, "");

  return (
    <div data-pdf-template="account" className="account-document">
      <style>{`
        @page account-cover {
          size: A4 portrait;
          margin: 10mm 10mm 16mm;
          @bottom-left { content: "${companyForCss}"; font-size: 8px; color: #6b7280; }
        }
        @page account-detail {
          size: A4 landscape;
          margin: 8mm 8mm 15mm;
          @bottom-left { content: "${companyForCss}"; font-size: 8px; color: #6b7280; }
        }
        @page account-summary {
          size: A4 portrait;
          margin: 10mm 10mm 16mm;
          @bottom-left { content: "${companyForCss}"; font-size: 8px; color: #6b7280; }
        }
        @media print {
          .account-cover-page { page: account-cover; break-after: page; }
          .account-detail-page { page: account-detail; break-after: page; }
          .account-summary-page { page: account-summary; }
          .account-detail-table thead { display: table-header-group; }
          .account-detail-table tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <section className="account-cover-page min-h-[245mm]">
        <PdfLetterhead
          documentTitle={`${title} מס׳ ${accountNo}`}
          companyProfile={company}
          meta={[
            { label: "פרויקט", value: model.projectName || "—" },
            {
              label: "מס׳ חוזה / פרויקט",
              value: model.projectContractNumber || "—",
            },
            { label: "חודש ביצוע", value: model.billingMonth || "—" },
          ]}
        />

        <div className="mb-9 mt-8 text-center">
          <p className="text-[28px] font-bold" style={{ color: blueDark }}>
            חשבון חלקי מס׳ {accountNo}
          </p>
          <p className="mt-2 text-[16px] font-semibold text-gray-600">
            חודש ביצוע {model.billingMonth || "—"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 border-y border-gray-300 py-6 text-[12px]">
          <InfoSection
            title="פרטי המזמין / הלקוח"
            rows={[["שם", model.billTo]]}
            blue={blue}
          />
          <InfoSection
            title="פרטי הפרויקט"
            rows={[
              ["שם הפרויקט", model.projectName],
              ["מספר חוזה / פרויקט", model.projectContractNumber],
              ["מיקום", model.projectLocation],
              ["מנהל עבודה", model.projectForemanName],
              ["חודש ביצוע", model.billingMonth],
            ]}
            blue={blue}
          />
        </div>

        <div className="mt-7 grid grid-cols-4 gap-x-6 border-b border-gray-200 pb-5 text-[11px]">
          <InfoLine label="מספר אסמכתא" value={model.invoiceNumber} />
          <InfoLine label="תאריך החשבון" value={formatDate(model.date)} />
          <InfoLine
            label="תאריך הפקה"
            value={formatDate(model.createdAt || model.date)}
          />
          <InfoLine label="סטטוס" value={model.statusLabel || "—"} />
        </div>

        <p className="mt-6 text-[10px] leading-5 text-gray-500">
          החשבון מבוסס על נתוני הסעיפים והכמויות שנשמרו במערכת במועד יצירתו.
          הסכומים מוצגים בש״ח.
        </p>
      </section>

      <section className="account-detail-page">
        <table className="account-detail-table w-full table-fixed border-collapse text-[9px]">
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[20%]" />
            <col className="w-[5%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={12} className="pb-3 text-right">
                <CompactAccountHeader
                  accountNo={accountNo}
                  billingMonth={model.billingMonth}
                  projectName={model.projectName}
                  contractNumber={model.projectContractNumber}
                  company={company}
                  blue={blue}
                />
                <p className="mt-3 text-[14px] font-bold text-gray-900">
                  פירוט ביצוע – חשבון חלקי מס׳ {accountNo}
                </p>
              </th>
            </tr>
            <tr className="text-white" style={{ background: blueDark }}>
              <Th>מס׳ סעיף</Th>
              <Th>תיאור העבודה</Th>
              <Th>יחידה</Th>
              <Th>כמות חוזה</Th>
              <Th>כמות קודמת</Th>
              <Th>ביצוע נוכחי</Th>
              <Th>כמות מצטברת</Th>
              <Th>% ביצוע</Th>
              <Th>מחיר יחידה</Th>
              <Th>סכום קודם</Th>
              <Th>סכום נוכחי</Th>
              <Th>סכום מצטבר</Th>
            </tr>
          </thead>
          <tbody>
            {model.items.map((item, index) => {
              const parent = isParentItem(item.code, itemCodes);
              return (
                <tr
                  key={`${item.code}-${index}`}
                  className={parent ? "font-bold" : ""}
                  style={{
                    background: parent
                      ? "#e5e7eb"
                      : index % 2 === 0
                        ? "#fff"
                        : "#f9fafb",
                    borderBottom: "1px solid #d1d5db",
                  }}
                >
                  <Td mono>{item.code || "—"}</Td>
                  <Td strong={parent}>{item.description}</Td>
                  {parent ? (
                    <td colSpan={10} />
                  ) : (
                    <>
                      <Td>{item.unit || "—"}</Td>
                      <Td numeric>{formatNumber(item.contractQuantity)}</Td>
                      <Td numeric>{formatNumber(item.previousQuantity)}</Td>
                      <Td numeric strong>{formatNumber(item.quantity)}</Td>
                      <Td numeric>{formatNumber(item.cumulativeQuantity)}</Td>
                      <Td numeric>{formatPercent(item.quantityPercent)}</Td>
                      <Td numeric>{formatMoney(item.unitPrice)}</Td>
                      <Td numeric>{formatMoney(item.previousAmount)}</Td>
                      <Td numeric strong>{formatMoney(item.total)}</Td>
                      <Td numeric>{formatMoney(item.cumulativeAmount)}</Td>
                    </>
                  )}
                </tr>
              );
            })}
            {model.items.length === 0 && (
              <tr>
                <td colSpan={12} className="py-10 text-center text-[11px] text-gray-400">
                  אין סעיפים בחשבון זה
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {chapterSummaries.length > 0 && (
          <section className="pdf-avoid-break mt-7">
            <h2 className="mb-2 text-[13px] font-bold" style={{ color: blueDark }}>
              סיכום לפי פרקים / מבנים
            </h2>
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="border-y border-gray-300 bg-gray-100">
                  <Th>פרק</Th>
                  <Th>מצטבר קודם</Th>
                  <Th>נוכחי</Th>
                  <Th>מצטבר</Th>
                </tr>
              </thead>
              <tbody>
                {chapterSummaries.map((chapter) => (
                  <tr key={chapter.code} className="border-b border-gray-200">
                    <Td strong>פרק {chapter.code}</Td>
                    <Td numeric>{formatMoney(chapter.previous)}</Td>
                    <Td numeric>{formatMoney(chapter.current)}</Td>
                    <Td numeric strong>{formatMoney(chapter.cumulative)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>

      <section className="account-summary-page min-h-[245mm]">
        <CompactAccountHeader
          accountNo={accountNo}
          billingMonth={model.billingMonth}
          projectName={model.projectName}
          contractNumber={model.projectContractNumber}
          company={company}
          blue={blue}
        />

        <h2 className="mb-5 mt-7 text-[20px] font-bold" style={{ color: blueDark }}>
          סיכום חשבון חלקי מס׳ {accountNo}
        </h2>

        <div className="border-y-2 border-gray-800 text-[12px]">
          <FinancialRow label="מצטבר חשבון קודם" value={model.previousTotal} />
          <FinancialRow
            label="ביצוע בחשבון הנוכחי"
            value={model.currentTotal}
            emphasized
          />
          <FinancialRow
            label="סה״כ חשבון מצטבר"
            value={model.cumulativeTotal}
            strong
          />
          <div className="my-1 border-t border-gray-300" />
          <FinancialRow
            label="לתשלום בחשבון הנוכחי לפני מע״מ"
            value={model.subtotal}
            strong
          />
          {model.vatPercent > 0 && (
            <FinancialRow
              label={`מע״מ (${formatNumber(model.vatPercent, 1)}%)`}
              value={model.vatAmount}
            />
          )}
        </div>

        <div
          className="mt-5 border-y-4 px-4 py-4"
          style={{ borderColor: blueDark }}
        >
          <p className="text-[11px] font-bold text-gray-600">
            סה״כ לתשלום כולל מע״מ
          </p>
          <p className="mt-1 text-[28px] font-bold" style={{ color: blueDark }}>
            {formatMoney(model.totalWithVat)}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 border-y border-gray-300 py-3 text-[11px]">
          <InfoLine
            label="מצטבר קודם"
            value={formatMoney(model.previousTotal)}
          />
          <InfoLine
            label="חשבון נוכחי"
            value={formatMoney(model.currentTotal)}
          />
          <InfoLine
            label="מצטבר חדש"
            value={formatMoney(model.cumulativeTotal)}
          />
        </div>

        <p className="mt-3 text-[10px] text-gray-500">
          אחוז ביצוע כספי מצטבר משוקלל: {formatPercent(model.overallPercent)}
          {" · "}
          מספר סעיפים מצטבר: {model.items.length}
        </p>

        {model.notes?.trim() && (
          <section className="pdf-avoid-break mt-7 border-t border-gray-300 pt-3">
            <h3 className="text-[12px] font-bold" style={{ color: blueDark }}>
              הערות לחשבון
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-gray-700">
              {model.notes.trim()}
            </p>
          </section>
        )}

        <PdfSignatureBlock
          slots={[
            {
              title: "חתימת קבלן / מגיש",
              name: model.contractor || company.name,
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
          right={company.name}
        />
      </section>
    </div>
  );
}

function InfoSection({
  title,
  blue,
  rows,
}: {
  title: string;
  blue: string;
  rows: [string, string | null | undefined][];
}) {
  return (
    <section>
      <h2
        className="mb-3 border-b pb-1.5 text-[13px] font-bold"
        style={{ color: blue, borderColor: `${blue}66` }}
      >
        {title}
      </h2>
      <div className="space-y-2">
        {rows.filter(([, value]) => value?.trim()).map(([label, value]) => (
          <p key={label}>
            <span className="text-gray-500">{label}: </span>
            <span className="font-semibold">{value?.trim() || "—"}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border border-gray-300 px-1 py-1.5 text-right font-bold">
      {children}
    </th>
  );
}

function Td({
  children,
  numeric,
  mono,
  strong,
}: {
  children: React.ReactNode;
  numeric?: boolean;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-1 py-1.5 align-middle ${numeric ? "whitespace-nowrap text-left tabular-nums" : "text-right"} ${mono ? "font-mono text-gray-600" : ""} ${strong ? "font-semibold" : ""}`}
    >
      {children}
    </td>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="mt-0.5 font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function CompactAccountHeader({
  accountNo,
  billingMonth,
  projectName,
  contractNumber,
  company,
  blue,
}: {
  accountNo: string;
  billingMonth?: string | null;
  projectName?: string | null;
  contractNumber?: string | null;
  company: PdfCompanyProfile;
  blue: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-5 border-b-2 pb-2 text-[9px]"
      style={{ borderColor: blue }}
    >
      <div className="flex items-center gap-2">
        {company.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoUrl}
            alt={company.name}
            className="h-9 w-9 object-contain"
          />
        )}
        <p className="text-[12px] font-bold" style={{ color: blue }}>
          {company.name}
        </p>
      </div>
      <div className="flex gap-5 text-left">
        <span>{projectName || "—"}</span>
        <span>מס׳ פרויקט / חוזה: {contractNumber || "—"}</span>
        <span>חשבון חלקי מס׳ {accountNo}</span>
        <span>חודש: {billingMonth || "—"}</span>
      </div>
    </div>
  );
}

function FinancialRow({
  label,
  value,
  strong,
  emphasized,
}: {
  label: string;
  value: number;
  strong?: boolean;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-gray-200 px-3 py-2.5 last:border-0 ${
        strong ? "font-bold" : ""
      } ${emphasized ? "bg-gray-50" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}

function chapterCode(code?: string | null): string {
  const normalized = code?.trim() || "ללא קוד";
  const root = normalized.split(/[.\-]/)[0] || normalized;
  return /^\d+$/.test(root) ? root.padStart(2, "0") : root;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function summarizeChapters(items: AccountPdfItem[]): ChapterSummary[] {
  const result = new Map<string, ChapterSummary>();
  for (const item of items) {
    const code = chapterCode(item.code);
    const current = result.get(code) ?? {
      code,
      previous: 0,
      current: 0,
      cumulative: 0,
    };
    current.previous += item.previousAmount;
    current.current += item.total;
    current.cumulative += item.cumulativeAmount;
    result.set(code, current);
  }
  const collator = new Intl.Collator("he", { numeric: true });
  return [...result.values()].sort((a, b) => collator.compare(a.code, b.code));
}

function isParentItem(
  code: string | null | undefined,
  allCodes: Set<string>
): boolean {
  const normalized = code?.trim();
  if (!normalized) return false;
  return [...allCodes].some(
    (candidate) =>
      candidate !== normalized &&
      (candidate.startsWith(`${normalized}.`) ||
        candidate.startsWith(`${normalized}-`))
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
