/**
 * Central digital signature module (reusable across document kinds).
 * Delivery notes are the first consumer; diaries / measurements / invoices follow the same contracts.
 */

export type SignableDocumentKind =
  | "delivery_note"
  | "work_diary"
  | "measurement_sheet"
  | "invoice"
  | "agreement"
  | "other";

export const SIGNED_STATUS_LABEL = "נחתם על ידי הלקוח";

export const SIGN_KIND_LABEL: Record<SignableDocumentKind, string> = {
  delivery_note: "תעודת משלוח",
  work_diary: "יומן עבודה",
  measurement_sheet: "דף מדידה",
  invoice: "חשבונית",
  agreement: "הסכם",
  other: "מסמך",
};

/** Project Documents Hub folder for signed copies */
export function projectSignedFolder(kind: SignableDocumentKind): string {
  switch (kind) {
    case "delivery_note":
      return "תעודות משלוח";
    case "work_diary":
      return "יומני עבודה";
    case "measurement_sheet":
      return "דפי מדידה";
    case "invoice":
      return "חשבוניות";
    case "agreement":
      return "הסכמים";
    default:
      return "מסמכים חתומים";
  }
}

/** Client module folder path: לקוחות / {name} / תעודות משלוח */
export function clientSignedFolder(
  clientName: string,
  kind: SignableDocumentKind
): string {
  const safe = clientName.trim() || "לקוח";
  return `לקוחות/${safe}/${projectSignedFolder(kind)}`;
}

export function confirmButtonLabel(kind: SignableDocumentKind): string {
  if (kind === "delivery_note") return "אני מאשר את קבלת המשלוח";
  return "אני מאשר וחותם על המסמך";
}

export function buildSignShareMessage(opts: {
  kindLabel: string;
  documentNumber: string;
  url: string;
}): string {
  return `שלום,\n\nמצורפת ${opts.kindLabel} ${opts.documentNumber} לבדיקתך ולחתימה דיגיטלית.\n\nלצפייה ולחתימה:\n${opts.url}\n\nתודה.`;
}

export function whatsappShareLink(phone: string | undefined, message: string) {
  const text = encodeURIComponent(message);
  const digits = (phone || "").replace(/\D/g, "");
  if (digits) return `https://wa.me/${digits}?text=${text}`;
  return `https://wa.me/?text=${text}`;
}

export function smsShareLink(phone: string | undefined, message: string) {
  const body = encodeURIComponent(message);
  const digits = (phone || "").replace(/\D/g, "");
  // iOS uses &body=, Android often ?body=
  if (digits) return `sms:${digits}?&body=${body}`;
  return `sms:?&body=${body}`;
}

export function emailShareLink(opts: {
  email?: string | null;
  subject: string;
  body: string;
}) {
  const to = opts.email ? encodeURIComponent(opts.email) : "";
  const subject = encodeURIComponent(opts.subject);
  const body = encodeURIComponent(opts.body);
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
