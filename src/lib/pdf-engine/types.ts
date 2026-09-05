/**
 * Central PDF Engine — single print/PDF mechanism for the whole product.
 * Each document kind is a Template only; print routes are thin loaders.
 */

export type PdfDocumentKind =
  | "account"
  | "invoice"
  | "work_diary"
  | "delivery_note"
  | "ops_delivery_note"
  | "measurement"
  | "client_signed";

export type PdfPageSize = "A4" | "A4-landscape";

export type PdfTemplateMeta = {
  kind: PdfDocumentKind;
  titleHe: string;
  pageSize: PdfPageSize;
  /** Public print path builder kept stable for Document archive URLs */
  printPath: (id: string) => string;
};

export type PdfRenderContext = {
  documentId: string;
  autoprint?: boolean;
};
