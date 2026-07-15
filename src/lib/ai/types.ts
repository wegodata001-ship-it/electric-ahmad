export type AiDocumentType =
  | "contract_boq"
  | "partial_invoice"
  | "final_invoice"
  | "technical_spec"
  | "invoice"
  | "work_plan"
  | "word"
  | "excel"
  | "pdf_generic";

export interface ParsedBoqItem {
  code: string | null;
  description: string | null;
  unit: string | null;
  contractQuantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  chapter: string | null;
  subChapter: string | null;
  category: string | null;
  sortOrder: number;
}

export interface ParsedProjectDetails {
  name: string | null;
  contractNumber: string | null;
  contractor: string | null;
  client: string | null;
  location: string | null;
  date: string | null;
  contractValue: number | null;
  subtotal: number | null;
  vatPercent: number | null;
  vatAmount: number | null;
  totalWithVat: number | null;
  paymentTerms: string | null;
  currency: string | null;
  notes: string | null;
}

export interface ParsedContractBoqResult {
  documentType: "contract_boq";
  project: ParsedProjectDetails;
  chapters: { name: string; sortOrder: number }[];
  items: ParsedBoqItem[];
  missingFields: string[];
  confidence: number;
}

export interface AiParseRequest {
  documentType: AiDocumentType;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  language?: "he" | "en";
}

export interface AiParseResult<T = unknown> {
  success: boolean;
  data: T | null;
  missingFields: string[];
  itemsDetected: number;
  error?: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  rawText?: string;
}
