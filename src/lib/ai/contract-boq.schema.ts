import { z } from "zod";
import { cleanBoqDescription } from "@/utils/boq-text";
import type { ParsedBoqItem, ParsedContractBoqResult, ParsedProjectDetails } from "./types";

const nullableString = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
  });

const nullableNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null || value === "") return null;
    const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
    if (!Number.isFinite(num)) {
      ctx.addIssue({ code: "custom", message: "מספר לא תקין" });
      return z.NEVER;
    }
    return num;
  });

const roomSchema = z
  .object({
    name: nullableString,
    sortOrder: z.number().optional(),
  })
  .transform((row, ctx) => {
    if (!row.name) {
      ctx.addIssue({ code: "custom", message: "שם חדר/פרק חסר" });
      return z.NEVER;
    }
    return { name: row.name, sortOrder: row.sortOrder ?? 0 };
  });

const itemSchema = z.object({
  code: nullableString.optional(),
  description: nullableString.optional(),
  unit: nullableString.optional(),
  contractQuantity: nullableNumber.optional(),
  unitPrice: nullableNumber.optional(),
  totalPrice: nullableNumber.optional(),
  chapter: nullableString.optional(),
  subChapter: nullableString.optional(),
  category: nullableString.optional(),
  sortOrder: z.number().optional(),
});

export const contractBoqRawSchema = z.object({
  documentType: z.string().optional(),
  project: z
    .object({
      name: nullableString.optional(),
      contractNumber: nullableString.optional(),
      contractor: nullableString.optional(),
      client: nullableString.optional(),
      location: nullableString.optional(),
      date: nullableString.optional(),
      contractValue: nullableNumber.optional(),
      subtotal: nullableNumber.optional(),
      vatPercent: nullableNumber.optional(),
      vatAmount: nullableNumber.optional(),
      totalWithVat: nullableNumber.optional(),
      paymentTerms: nullableString.optional(),
      currency: nullableString.optional(),
      notes: nullableString.optional(),
    })
    .optional(),
  rooms: z.array(roomSchema).optional(),
  chapters: z.array(roomSchema).optional(),
  items: z.array(itemSchema).optional(),
  missingFields: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type ContractBoqValidation =
  | { ok: true; data: ParsedContractBoqResult }
  | { ok: false; error: string };

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function emptyProject(): ParsedProjectDetails {
  return {
    name: null,
    contractNumber: null,
    contractor: null,
    client: null,
    location: null,
    date: null,
    contractValue: null,
    subtotal: null,
    vatPercent: null,
    vatAmount: null,
    totalWithVat: null,
    paymentTerms: null,
    currency: null,
    notes: null,
  };
}

export function normalizeContractBoq(raw: unknown): ContractBoqValidation {
  const parsed = contractBoqRawSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "תוצאת הסריקה נכשלה בבדיקה. לא נשמרו נתונים חלקיים.",
    };
  }

  const data = parsed.data;
  const projectIn = data.project ?? {};
  const items: ParsedBoqItem[] = (data.items ?? [])
    .map((item, index) => {
      const qty = asNullableNumber(item.contractQuantity);
      const unitPrice = asNullableNumber(item.unitPrice);
      let totalPrice = asNullableNumber(item.totalPrice);
      if (totalPrice == null && qty != null && unitPrice != null) {
        totalPrice = qty * unitPrice;
      }
      return {
        code: item.code ?? null,
        description: cleanBoqDescription(item.description) || item.description || null,
        unit: item.unit ?? null,
        contractQuantity: qty,
        unitPrice,
        totalPrice,
        chapter: item.chapter ?? null,
        subChapter: item.subChapter ?? null,
        category: item.category ?? null,
        sortOrder: item.sortOrder ?? index + 1,
      };
    })
    .filter((item) => Boolean(item.description || item.code));

  const chapters = [
    ...(data.rooms ?? []),
    ...(data.chapters ?? []),
  ].filter(
    (chapter, index, all) =>
      all.findIndex((other) => other.name === chapter.name) === index
  );

  const missingFields = [...(data.missingFields ?? [])];
  const requiredProjectFields: (keyof ParsedProjectDetails)[] = [
    "name",
    "contractNumber",
    "contractor",
    "location",
    "contractValue",
  ];
  const project: ParsedProjectDetails = {
    ...emptyProject(),
    ...projectIn,
    name: projectIn.name ?? null,
    contractNumber: projectIn.contractNumber ?? null,
    contractor: projectIn.contractor ?? null,
    client: projectIn.client ?? null,
    location: projectIn.location ?? null,
    date: projectIn.date ?? null,
    paymentTerms: projectIn.paymentTerms ?? null,
    currency: projectIn.currency ?? null,
    notes: projectIn.notes ?? null,
    subtotal: asNullableNumber(projectIn.subtotal),
    vatPercent: asNullableNumber(projectIn.vatPercent),
    vatAmount: asNullableNumber(projectIn.vatAmount),
    totalWithVat: asNullableNumber(projectIn.totalWithVat),
    contractValue: asNullableNumber(projectIn.contractValue),
  };

  if (project.contractValue == null && project.totalWithVat != null) {
    project.contractValue = project.totalWithVat;
  } else if (project.contractValue == null && project.subtotal != null && project.vatAmount == null) {
    project.contractValue = project.subtotal;
  }

  for (const field of requiredProjectFields) {
    const value = project[field];
    if (value == null || value === "") {
      const key = `project.${field}`;
      if (!missingFields.includes(key)) missingFields.push(key);
    }
  }
  if (items.length === 0 && !missingFields.includes("items")) {
    missingFields.push("items");
  }

  return {
    ok: true,
    data: {
      documentType: "contract_boq",
      project,
      chapters,
      rooms: chapters,
      items,
      missingFields,
      confidence: typeof data.confidence === "number" ? data.confidence : 0.5,
    },
  };
}
