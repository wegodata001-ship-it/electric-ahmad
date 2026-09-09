import { formatNumber } from "@/utils/format";
import { PdfFooterBar, PdfLetterhead, PdfSignatureBlock } from "../letterhead";
import { COMPANY_PROFILE } from "@/config/company";
import {
  chunkArray,
  maxSectionsPerMeasurementChunk,
} from "../column-chunking";
import { calculateMeasurementQuantity } from "@/lib/measurement/quantities";

export type MeasurementPdfModel = {
  title: string;
  documentNumber?: string | null;
  projectName?: string | null;
  contractor?: string | null;
  version?: number | null;
  rooms: { id: string; name: string }[];
  sections: {
    id: string;
    code?: string | null;
    description?: string | null;
    unit?: string | null;
    contractQuantity?: number;
    invoicedQuantity?: number;
    previousApprovedQuantity?: number;
  }[];
  qty: (rowId: string, boqId: string) => number;
  clientSignedAt?: string | null;
  clientSignedName?: string | null;
  clientSignatureUrl?: string | null;
};

type Section = MeasurementPdfModel["sections"][number];

/**
 * Measurement sheet template — wide BOQ grids split into stacked tables
 * (same row order; room + total columns repeated). Font size stays readable.
 */
export function MeasurementTemplate({ model }: { model: MeasurementPdfModel }) {
  const blue = COMPANY_PROFILE.brandBlue;
  const perChunk = maxSectionsPerMeasurementChunk();
  const sectionChunks = chunkArray(model.sections, perChunk);
  const chunkCount = Math.max(1, sectionChunks.length);

  const sectionTotal = (boqId: string) =>
    model.rooms.reduce((s, room) => s + model.qty(room.id, boqId), 0);

  const sectionMetrics = (s: Section) =>
    calculateMeasurementQuantity({
      contractQuantity: Number(s.contractQuantity) || 0,
      previousApprovedQuantity:
        Number(s.previousApprovedQuantity ?? s.invoicedQuantity) || 0,
      currentQuantity: sectionTotal(s.id),
    });

  /** Row total across ALL sections (full sheet) — shown in every chunk's סה״כ */
  const roomGrandTotal = (roomId: string) =>
    model.sections.reduce((acc, s) => acc + model.qty(roomId, s.id), 0);

  const sheetCumulativeTotal = model.sections.reduce(
    (sum, section) => sum + sectionMetrics(section).cumulativeQuantity,
    0
  );

  return (
    <div data-pdf-template="measurement" className="max-w-[297mm]">
      <PdfLetterhead
        documentTitle="דף מדידה"
        meta={[
          { label: "כותרת", value: model.title },
          { label: "פרויקט", value: model.projectName || "—" },
          ...(model.contractor
            ? [{ label: "לקוח", value: model.contractor }]
            : []),
          ...(model.version != null
            ? [{ label: "גרסה", value: `V${model.version}` }]
            : []),
          ...(chunkCount > 1
            ? [
                {
                  label: "חלוקת טבלאות",
                  value: `${chunkCount} טבלאות · עד ${perChunk} סעיפים בכל אחת`,
                },
              ]
            : []),
        ]}
      />

      {sectionChunks.map((chunk, chunkIndex) => (
        <MeasurementTableChunk
          key={`chunk-${chunkIndex}`}
          blue={blue}
          model={model}
          sections={chunk}
          chunkIndex={chunkIndex}
          chunkCount={chunkCount}
          sectionTotal={sectionTotal}
          sectionMetrics={sectionMetrics}
          roomGrandTotal={roomGrandTotal}
          sheetGrandTotal={sheetCumulativeTotal}
        />
      ))}

      {model.clientSignatureUrl && (
        <div className="pdf-avoid-break">
          <PdfSignatureBlock
            slots={[
              {
                title: "חתימת לקוח",
                name: model.clientSignedName,
                imageUrl: model.clientSignatureUrl,
                meta: model.clientSignedAt
                  ? new Date(model.clientSignedAt).toLocaleString("he-IL")
                  : null,
              },
            ]}
          />
        </div>
      )}

      <PdfFooterBar
        left={`דף מדידה · ${model.title}${
          model.projectName ? ` · ${model.projectName}` : ""
        }`}
        right={
          chunkCount > 1
            ? `${model.sections.length} סעיפים ב־${chunkCount} טבלאות`
            : undefined
        }
      />
    </div>
  );
}

function MeasurementTableChunk({
  blue,
  model,
  sections,
  chunkIndex,
  chunkCount,
  sectionTotal,
  sectionMetrics,
  roomGrandTotal,
  sheetGrandTotal,
}: {
  blue: string;
  model: MeasurementPdfModel;
  sections: Section[];
  chunkIndex: number;
  chunkCount: number;
  sectionTotal: (id: string) => number;
  sectionMetrics: (s: Section) => ReturnType<typeof calculateMeasurementQuantity>;
  roomGrandTotal: (roomId: string) => number;
  sheetGrandTotal: number;
}) {
  const partLabel =
    chunkCount > 1
      ? `טבלה ${chunkIndex + 1} מתוך ${chunkCount}`
      : null;

  const rangeLabel =
    chunkCount > 1 && sections.length
      ? `סעיפים ${sections[0]?.code || "…"} – ${sections[sections.length - 1]?.code || "…"}`
      : null;

  return (
    <section
      className="ms-table-chunk mb-5"
      style={{
        breakInside: "avoid",
        pageBreakInside: "avoid",
      }}
    >
      {/* Running context — repeats with each chunk / page continuation */}
      <div
        className="mb-2 flex flex-wrap items-end justify-between gap-2 border-b pb-1.5 text-[10px]"
        style={{ borderColor: `${blue}55` }}
      >
        <div>
          <p className="font-bold text-slate-800">
            {model.projectName || "פרויקט"} · {model.title}
          </p>
          <p className="text-slate-500">
            דף מדידה · מסמך רשמי
            {rangeLabel ? ` · ${rangeLabel}` : ""}
          </p>
        </div>
        {partLabel && (
          <p
            className="rounded px-2 py-0.5 font-bold text-white"
            style={{ background: blue }}
          >
            {partLabel}
          </p>
        )}
      </div>

      <table
        className="w-full border-collapse text-[10px]"
        style={{ tableLayout: "fixed" }}
      >
        <thead>
          <tr style={{ background: blue, color: "#fff" }}>
            <th
              className="border border-gray-400 px-2 py-2 text-right"
              style={{ width: "22%" }}
            >
              שורה / יחידה
            </th>
            {sections.map((s) => (
              <th
                key={s.id}
                className="border border-gray-400 px-1 py-2 text-center"
              >
                <div className="font-mono text-[9px] opacity-90">{s.code}</div>
                <div className="leading-tight">{s.description}</div>
                <div className="mt-0.5 text-[8px] opacity-90">
                  כמות חוזה {formatNumber(Number(s.contractQuantity) || 0)}
                </div>
                {sectionMetrics(s).isOverrun && (
                  <div className="mt-0.5 text-[8px] font-black text-red-100">
                    ⚠ חריגה +{formatNumber(sectionMetrics(s).overrunQuantity)}
                  </div>
                )}
              </th>
            ))}
            <th
              className="border border-gray-400 px-2 py-2 text-center"
              style={{ width: "12%" }}
            >
              סה״כ
            </th>
          </tr>
        </thead>
        <tbody>
          {model.rooms.map((room, i) => (
            <tr
              key={room.id}
              style={{
                background: i % 2 === 0 ? "#fff" : "#f8fafc",
                pageBreakInside: "avoid",
                breakInside: "avoid",
              }}
            >
              <td className="border border-gray-300 px-2 py-1.5 font-semibold">
                {room.name}
              </td>
              {sections.map((s) => (
                <td
                  key={s.id}
                  className="border border-gray-300 px-1 py-1.5 text-center"
                >
                  {formatNumber(model.qty(room.id, s.id)) || ""}
                </td>
              ))}
              <td className="border border-gray-300 px-1 py-1.5 text-center font-bold">
                {formatNumber(roomGrandTotal(room.id)) || ""}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-bold">
            <td className="border border-gray-400 px-2 py-1.5">
              סה״כ שבוצע (מצטבר)
            </td>
            {sections.map((s) => (
              <td
                key={`t-${s.id}`}
                className="border border-gray-400 px-1 py-1.5 text-center"
              >
                {formatNumber(sectionMetrics(s).cumulativeQuantity)}
              </td>
            ))}
            <td className="border border-gray-400 px-1 py-1.5 text-center">
              {formatNumber(sheetGrandTotal)}
            </td>
          </tr>
          <tr className="bg-gray-50">
            <td className="border border-gray-400 px-2 py-1.5 font-bold">
              יתרה
            </td>
            {sections.map((s) => {
              const metrics = sectionMetrics(s);
              return (
                <td
                  key={`r-${s.id}`}
                  className="border border-gray-400 px-1 py-1.5 text-center font-bold"
                  style={{
                    color: metrics.isOverrun
                      ? "#dc2626"
                      : metrics.isComplete
                        ? "#059669"
                        : "#374151",
                  }}
                >
                  {formatNumber(metrics.remainingQuantity)}
                  {metrics.isOverrun ? " · חריגה מכמות חוזה" : ""}
                </td>
              );
            })}
            <td className="border border-gray-400" />
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
