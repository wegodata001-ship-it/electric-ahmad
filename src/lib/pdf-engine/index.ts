/**
 * Central PDF Engine — single print/PDF mechanism for the whole system.
 *
 * Architecture:
 *   PdfPrintShell (chrome) + PdfLetterhead
 *     └── Template per document kind (account, diary, DN, measurement, …)
 *
 * Print routes under /print/* are thin loaders only.
 * Do not add a second PDF generator elsewhere.
 */

export type {
  PdfDocumentKind,
  PdfPageSize,
  PdfTemplateMeta,
  PdfRenderContext,
} from "./types";

export { PdfPrintShell } from "./print-shell";
export { PdfLetterhead, PdfFooterBar, PdfSignatureBlock } from "./letterhead";
export { PDF_TEMPLATE_REGISTRY, getPdfTemplateMeta } from "./registry";

export { AccountTemplate, InvoiceTemplate } from "./templates/account";
export type { AccountPdfModel, AccountPdfItem } from "./templates/account";

export { WorkDiaryTemplate } from "./templates/work-diary";
export type { WorkDiaryPdfModel } from "./templates/work-diary";

export { DeliveryNoteTemplate } from "./templates/delivery-note";
export type { DeliveryNotePdfModel } from "./templates/delivery-note";

export { MeasurementTemplate } from "./templates/measurement";
export type { MeasurementPdfModel } from "./templates/measurement";

export {
  maxSectionsPerMeasurementChunk,
  chunkArray,
} from "./column-chunking";
