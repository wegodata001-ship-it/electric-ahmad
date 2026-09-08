/**
 * Shared Zod schemas for API input validation.
 *
 * Design principles:
 *  - Keep primitives small and reusable. Compose per-route schemas from them
 *    so validation is consistent across handlers.
 *  - IDs in Prisma are cuid strings — we accept the historical `min(8).max(64)`
 *    range instead of z.string().cuid() so we don't reject legacy ids that pre-date
 *    cuid2, and we don't fail on future id-scheme changes.
 *  - Empty strings from HTML forms become `undefined` where the field is optional
 *    so downstream repositories don't try to persist blanks.
 *  - Every schema keeps the same Hebrew user-facing tone as the rest of the app.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** Prisma cuid id. Safe range that also tolerates uuid v4 (36 chars). */
export const idString = z.string().min(8).max(64);

/** Optional id — accepts empty string / null / undefined and normalizes to undefined. */
export const idStringOptional = z
  .union([idString, z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v === "" || v === null ? undefined : v))
  .optional();

/** Non-empty trimmed string (must contain at least one non-whitespace char). */
export const nonEmptyString = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v.length > 0, { message: "שדה חובה" });

/** Optional trimmed string — empty/whitespace becomes undefined. */
export const optionalTrimmedString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim() : v))
  .transform((v) => (!v ? undefined : v))
  .optional();

/** ISO date-ish string (we don't parse into Date so callers keep their formats). */
export const isoDateString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim() : v))
  .transform((v) => (!v ? undefined : v))
  .optional();

/** Non-negative finite number (accepts `"12.5"` or number). */
export const nonNegativeNumber = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "string" ? Number(v) : v))
  .refine((v) => Number.isFinite(v) && v >= 0, { message: "מספר לא תקין" });

export const optionalNonNegativeNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : undefined;
  })
  .optional();

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

/** Unified login accepts either email or username under multiple keys. */
export const officeLoginSchema = z
  .object({
    username: z.string().max(200).optional(),
    email: z.string().max(200).optional(),
    password: z.string().min(1).max(200),
    rememberMe: z.boolean().optional(),
  })
  .refine(
    (v) =>
      (typeof v.username === "string" && v.username.trim().length > 0) ||
      (typeof v.email === "string" && v.email.trim().length > 0),
    { message: "יש להזין שם משתמש או אימייל", path: ["username"] }
  );

export const fieldLoginSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

/* ------------------------------------------------------------------ */
/* Partial invoices (PATCH body)                                       */
/* ------------------------------------------------------------------ */

const invoiceItemSchema = z
  .object({
    id: idStringOptional,
    boqItemId: idStringOptional,
    description: optionalTrimmedString,
    quantity: optionalNonNegativeNumber,
    unitPrice: optionalNonNegativeNumber,
    unit: optionalTrimmedString,
  })
  .passthrough();

export const partialInvoicePatchSchema = z
  .object({
    date: isoDateString,
    dueDate: isoDateString,
    billingMonth: optionalTrimmedString,
    billTo: z.any().optional(),
    contractor: z.any().optional(),
    notes: optionalTrimmedString,
    status: optionalTrimmedString,
    items: z.array(invoiceItemSchema).optional(),
  })
  .passthrough();

/* ------------------------------------------------------------------ */
/* Delivery notes (PATCH body)                                         */
/* ------------------------------------------------------------------ */

const deliveryNoteItemSchema = z
  .object({
    id: idStringOptional,
    description: optionalTrimmedString,
    quantity: optionalNonNegativeNumber,
    unit: optionalTrimmedString,
  })
  .passthrough();

export const deliveryNotePatchSchema = z
  .object({
    noteNumber: optionalTrimmedString,
    date: isoDateString,
    status: optionalTrimmedString,
    client: optionalTrimmedString,
    clientId: idStringOptional,
    projectId: idStringOptional,
    orderNumber: optionalTrimmedString,
    contactName: optionalTrimmedString,
    phone: optionalTrimmedString,
    phoneSecondary: optionalTrimmedString,
    address: optionalTrimmedString,
    city: optionalTrimmedString,
    notes: optionalTrimmedString,
    receiverName: optionalTrimmedString,
    receivedAt: isoDateString,
    receiverSignatureUrl: optionalTrimmedString,
    employeeSignatureUrl: optionalTrimmedString,
    employeeSignedName: optionalTrimmedString,
    senderSigned: z.boolean().optional(),
    receiverSigned: z.boolean().optional(),
    driverName: optionalTrimmedString,
    driverPhone: optionalTrimmedString,
    vehicle: optionalTrimmedString,
    vehicleNumber: optionalTrimmedString,
    externalCarrier: z.boolean().optional(),
    deliveryTime: optionalTrimmedString,
    destination: optionalTrimmedString,
    destinationAddress: optionalTrimmedString,
    driverNotes: optionalTrimmedString,
    items: z.array(deliveryNoteItemSchema).optional(),
  })
  .passthrough();

/* ------------------------------------------------------------------ */
/* Measurement sheets — approvals                                      */
/* ------------------------------------------------------------------ */

export const measurementSheetSubmitSchema = z
  .object({
    approverIds: z.array(idString).min(1).optional(),
    approverId: idString.optional(),
  })
  .refine(
    (v) =>
      (Array.isArray(v.approverIds) && v.approverIds.length > 0) ||
      Boolean(v.approverId),
    { message: "יש לבחור מאשרים", path: ["approverIds"] }
  );

/* ------------------------------------------------------------------ */
/* BOQ                                                                 */
/* ------------------------------------------------------------------ */

export const boqCreateSchema = z.object({
  projectId: idString,
  description: nonEmptyString,
  code: optionalTrimmedString,
  unit: optionalTrimmedString,
  contractQuantity: nonNegativeNumber,
  unitPrice: nonNegativeNumber,
  category: optionalTrimmedString,
  notes: optionalTrimmedString,
  itemKind: z.enum(["regular", "exceptional"]).optional(),
  status: optionalTrimmedString,
});

export const boqUpdateSchema = z.object({
  code: optionalTrimmedString,
  description: optionalTrimmedString,
  unit: optionalTrimmedString,
  contractQuantity: optionalNonNegativeNumber,
  unitPrice: optionalNonNegativeNumber,
  category: optionalTrimmedString,
  notes: optionalTrimmedString,
  itemKind: z.enum(["regular", "exceptional"]).optional(),
  status: optionalTrimmedString,
});

/* ------------------------------------------------------------------ */
/* Workflow                                                            */
/* ------------------------------------------------------------------ */

export const workflowTransitionSchema = z.object({
  action: nonEmptyString,
  comment: optionalTrimmedString,
  approverIds: z.array(idString).optional(),
});

/* ------------------------------------------------------------------ */
/* Approvals inbox — approve / reject                                  */
/* ------------------------------------------------------------------ */

export const approvalsDecisionSchema = z.object({
  kind: z
    .enum(["work_diary", "delivery_note", "measurement_sheet"])
    .optional(),
  documentId: idString,
  decision: z.enum(["approved", "rejected"]),
  correctionMode: z.enum(["manual", "note"]).optional(),
  comment: optionalTrimmedString,
  reviewNotes: z.array(z.any()).optional(),
  rejectReasonId: optionalTrimmedString,
  rejectAttachments: z.array(z.string()).optional(),
  approveOptions: z
    .object({
      saveToDocuments: z.boolean().optional(),
      notifyCreator: z.boolean().optional(),
      sendToClient: z.boolean().optional(),
    })
    .partial()
    .optional(),
});

/* ------------------------------------------------------------------ */
/* Sign (public client signature endpoints)                            */
/* ------------------------------------------------------------------ */

export const clientSignatureBodySchema = z.object({
  t: z.string().min(1).max(400).optional(),
  token: z.string().min(1).max(400).optional(),
  signatureDataUrl: z
    .string()
    .min(1)
    .max(2_000_000, { message: "החתימה גדולה מדי" }),
  signerName: nonEmptyString,
  saveToDocuments: z.boolean().optional(),
});

/* ------------------------------------------------------------------ */
/* Upload (multipart) — validated after FormData -> plain object       */
/* ------------------------------------------------------------------ */

export const uploadFieldsSchema = z.object({
  projectId: idString,
  type: optionalTrimmedString,
  title: optionalTrimmedString,
  folderPath: optionalTrimmedString,
  documentId: idStringOptional,
  boqItemId: idStringOptional,
  reportId: idStringOptional,
  employeeId: idStringOptional,
  bucketKey: optionalTrimmedString,
});
