/**
 * Shared document mutation guards.
 *
 * Centralises the "may this document be edited or soft-deleted?" decision for
 * every entity that has a workflow / signature lifecycle. The intent is
 * defence-in-depth: repositories call these helpers before applying any content
 * change or soft-delete so that a client cannot bypass workflow gates by
 * hand-crafting a PATCH/DELETE body.
 *
 * Errors are thrown with Hebrew messages so callers can surface them via
 * `apiError(err.message, 400)` without translation.
 */

/**
 * Statuses considered fully immutable across every document family.
 * Any of these means: no content edits, no soft-delete, no status downgrade.
 * Individual doc types add their own extra locked statuses on top.
 */
export const UNIVERSAL_IMMUTABLE_STATUSES: readonly string[] = [
  "approved",
  "locked",
  "signed",
  "client_signed",
  "receiver_signed",
  "sent_to_client",
  "sent_to_receiver",
  "sent",
  "delivered",
  "paid",
  "archived",
  "completed",
  "cancelled",
  "invoiced",
  "used_for_measurement",
  "used_for_account",
  "used_for_invoice",
  "closed",
] as const;

/** Statuses in which content edits are allowed for work diaries. */
export const DIARY_EDITABLE_STATUSES: readonly string[] = [
  "draft",
  "revision",
] as const;

/** Ops (portal) delivery notes editable statuses. */
export const OPS_DN_EDITABLE_STATUSES: readonly string[] = [
  "draft",
  "revision",
] as const;

/** Legacy warehouse delivery notes editable statuses. */
export const LEGACY_DN_EDITABLE_STATUSES: readonly string[] = [
  "draft",
  "issued",
  "in_transit",
] as const;

/** Legacy delivery-note statuses that fully lock the document. */
export const LEGACY_DN_LOCKED_STATUSES: readonly string[] = [
  "locked",
  "sent",
  "delivered",
  "cancelled",
] as const;

/** Partial invoice statuses in which content edits are allowed. */
export const INVOICE_EDITABLE_STATUSES: readonly string[] = [
  "draft",
  "rejected_by_foreman",
  "rejected",
] as const;

/** Measurement sheet statuses in which content edits are allowed. */
export const MEASUREMENT_EDITABLE_STATUSES: readonly string[] = [
  "draft",
  "in_progress",
  "revision",
] as const;

export type AssertDocumentMutableOpts = {
  /** If set (non-null), the document is treated as locked regardless of status. */
  lockedAt?: Date | null;
  /**
   * Explicit allow-list of statuses in which mutation is legal.
   * When provided, the current status MUST be in this list; otherwise the
   * universal immutable list is used as the reject set.
   */
  allowStatuses?: readonly string[];
  /** Optional Hebrew label to make errors more specific (e.g. "יומן העבודה"). */
  entityLabel?: string;
};

/**
 * Guard for content-editing operations.
 * Throws with a Hebrew message when the document must not be mutated.
 */
export function assertDocumentMutable(
  status: string,
  opts?: AssertDocumentMutableOpts
): void {
  const label = opts?.entityLabel ?? "המסמך";

  if (opts?.lockedAt) {
    throw new Error(`${label} נעול לעריכה`);
  }

  const normalized = String(status ?? "").trim();

  if (opts?.allowStatuses && opts.allowStatuses.length > 0) {
    if (!opts.allowStatuses.includes(normalized)) {
      throw new Error(
        `לא ניתן לערוך ${label} במצב הנוכחי (${normalized || "לא ידוע"})`
      );
    }
    return;
  }

  if (UNIVERSAL_IMMUTABLE_STATUSES.includes(normalized)) {
    throw new Error(`${label} נעול לעריכה`);
  }
}

/**
 * Guard for soft-delete operations. Blocks when the document is locked,
 * signed, approved, archived, cancelled, or otherwise past the editable
 * portion of its lifecycle.
 */
export function assertCanSoftDelete(
  status: string,
  lockedAt?: Date | null,
  opts?: { entityLabel?: string; editableStatuses?: readonly string[] }
): void {
  const label = opts?.entityLabel ?? "המסמך";

  if (lockedAt) {
    throw new Error(`לא ניתן למחוק ${label} לאחר נעילה`);
  }

  const normalized = String(status ?? "").trim();

  if (opts?.editableStatuses && opts.editableStatuses.length > 0) {
    if (!opts.editableStatuses.includes(normalized)) {
      throw new Error(
        `לא ניתן למחוק ${label} במצב הנוכחי (${normalized || "לא ידוע"})`
      );
    }
    return;
  }

  if (UNIVERSAL_IMMUTABLE_STATUSES.includes(normalized)) {
    throw new Error(`לא ניתן למחוק ${label} במצב הנוכחי (${normalized})`);
  }
}
