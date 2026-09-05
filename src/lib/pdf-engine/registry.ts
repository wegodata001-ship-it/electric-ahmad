import type { PdfDocumentKind, PdfTemplateMeta } from "./types";

/** Registry of document kinds → print paths (stable for Document archive) */
export const PDF_TEMPLATE_REGISTRY: Record<PdfDocumentKind, PdfTemplateMeta> = {
  account: {
    kind: "account",
    titleHe: "חשבון קבלני",
    pageSize: "A4",
    printPath: (id) => `/print/invoices/${id}`,
  },
  invoice: {
    kind: "invoice",
    titleHe: "חשבונית",
    pageSize: "A4",
    printPath: (id) => `/print/invoices/${id}`,
  },
  work_diary: {
    kind: "work_diary",
    titleHe: "יומן עבודה",
    pageSize: "A4",
    printPath: (id) => `/print/work-diaries/${id}`,
  },
  delivery_note: {
    kind: "delivery_note",
    titleHe: "תעודת משלוח",
    pageSize: "A4",
    printPath: (id) => `/print/delivery-notes/${id}`,
  },
  ops_delivery_note: {
    kind: "ops_delivery_note",
    titleHe: "תעודת משלוח",
    pageSize: "A4",
    printPath: (id) => `/print/ops-delivery-notes/${id}`,
  },
  measurement: {
    kind: "measurement",
    titleHe: "דף מדידה",
    pageSize: "A4-landscape",
    printPath: (id) => `/print/measurement-sheets/${id}`,
  },
  client_signed: {
    kind: "client_signed",
    titleHe: "מסמך חתום",
    pageSize: "A4",
    printPath: (id) => id,
  },
};

export function getPdfTemplateMeta(kind: PdfDocumentKind): PdfTemplateMeta {
  const meta = PDF_TEMPLATE_REGISTRY[kind];
  if (!meta) throw new Error(`PDF template not registered: ${kind}`);
  return meta;
}
