"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { COMPANY_PROFILE } from "@/config/company";
import type { PdfPageSize } from "./types";

const PRINT_CSS = `
  .pdf-engine-root { font-family: 'Assistant', 'Heebo', Arial, sans-serif; color: #111827; }
  @media print {
    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    .pdf-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr, .pdf-avoid-break { page-break-inside: avoid; break-inside: avoid; }
  }
`;

/**
 * Single print chrome for every official document.
 * Browser print / Save-as-PDF is the system PDF output today.
 */
export function PdfPrintShell({
  title,
  pageSize = "A4",
  children,
}: {
  title: string;
  pageSize?: PdfPageSize;
  children: React.ReactNode;
}) {
  const search = useSearchParams();
  const blue = COMPANY_PROFILE.brandBlue;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);

  useEffect(() => {
    if (!search.get("download") && !search.get("autoprint")) return;

    let cancelled = false;
    const images = Array.from(document.images);
    const imagesReady = Promise.all(
      images.map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            })
      )
    );
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    const timeout = new Promise<void>((resolve) =>
      window.setTimeout(resolve, 1500)
    );

    void Promise.race([Promise.all([imagesReady, fontsReady]), timeout]).then(
      () => {
        if (!cancelled) window.setTimeout(() => window.print(), 50);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [search]);

  const sizeCss =
    pageSize === "A4-landscape"
      ? "size: A4 landscape; margin: 10mm 8mm 14mm 8mm;"
      : "size: A4 portrait; margin: 10mm 8mm 16mm 8mm;";

  return (
    <div
      className="pdf-engine-root min-h-screen bg-[#eef1f5] print:bg-white"
      dir="rtl"
      data-pdf-engine="v1"
    >
      <style>{`
        ${PRINT_CSS}
        @page {
          ${sizeCss}
          @bottom-center {
            content: "עמוד " counter(page) " מתוך " counter(pages);
            font-family: Assistant, Heebo, Arial, sans-serif;
            font-size: 9px;
            color: #6b7280;
          }
        }
        @media print {
          .ms-table-chunk {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .ms-table-chunk + .ms-table-chunk {
            page-break-before: auto;
          }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-gray-200 bg-white/95 px-4 py-3">
        <p className="text-sm font-bold text-slate-700">
          {title} · מסמך רשמי
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg px-4 py-2 text-sm font-bold text-white"
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
      </div>

      <div
        className={`pdf-sheet mx-auto my-6 bg-white px-6 py-6 shadow-lg print:my-0 print:shadow-none ${
          pageSize === "A4-landscape" ? "max-w-[297mm]" : "max-w-[210mm]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
