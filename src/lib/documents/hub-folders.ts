/**
 * Documents Hub V2 — מבנה תיקיות מרכז המסמכים בפרויקט
 */

export const HUB_FOLDERS = [
  { id: "work_diary", label: "יומני עבודה" },
  { id: "measurement", label: "דפי מדידה" },
  { id: "invoice", label: "חשבונות" },
  { id: "delivery", label: "תעודות משלוח" },
  { id: "change", label: "שינויים" },
  { id: "signed", label: "מסמכים חתומים" },
  { id: "revision", label: "הוחזרו לתיקון" },
  { id: "draft", label: "טיוטות" },
  { id: "versions", label: "גרסאות" },
  { id: "files", label: "קבצים ותמונות" },
] as const;

export type HubFolderId = (typeof HUB_FOLDERS)[number]["id"];

export type HubDocKind =
  | "work_diary"
  | "delivery_note"
  | "measurement_sheet"
  | "invoice"
  | "change_order"
  | "file"
  | "signed";

export type StatusTone =
  | "green"
  | "yellow"
  | "red"
  | "blue"
  | "signed"
  | "gray"
  | "orange";

export function kindLabel(kind: string): string {
  switch (kind) {
    case "work_diary":
      return "יומן עבודה";
    case "delivery_note":
      return "תעודת משלוח";
    case "measurement_sheet":
      return "דף מדידה";
    case "invoice":
    case "partial_invoice":
      return "חשבון";
    case "change_order":
      return "שינוי עבודה";
    case "signed":
      return "מסמך חתום";
    default:
      return "מסמך";
  }
}

export function statusUi(status: string): {
  label: string;
  tone: StatusTone;
} {
  switch (status) {
    case "approved":
    case "locked":
    case "completed":
    case "used_for_measurement":
    case "used_for_account":
    case "used_for_invoice":
      return { label: "מאושר", tone: "green" };
    case "pending_approval":
    case "in_approval":
    case "submitted":
      return { label: "ממתין", tone: "yellow" };
    case "revision":
    case "revision_requested":
      return { label: "הוחזר לתיקון", tone: "red" };
    case "sent_to_client":
    case "sent_to_receiver":
      return { label: "נשלח ללקוח", tone: "blue" };
    case "client_signed":
    case "signed":
    case "receiver_signed":
      return { label: "נחתם על ידי הלקוח", tone: "signed" };
    case "draft":
    case "in_progress":
      return { label: "טיוטה", tone: "gray" };
    case "cancelled":
      return { label: "בוטל", tone: "orange" };
    default:
      return { label: status || "—", tone: "gray" };
  }
}

export function resolveHubFolder(input: {
  kind: string;
  status: string;
  sourceType?: string | null;
  folderPath?: string | null;
  type?: string | null;
}): HubFolderId {
  const st = String(input.sourceType || "");
  const status = String(input.status || "");
  const folder = String(input.folderPath || "");

  if (
    st.endsWith("_signed") ||
    status === "client_signed" ||
    status === "signed" ||
    folder.includes("חתומ")
  ) {
    return "signed";
  }

  if (status === "revision" || status === "revision_requested") {
    return "revision";
  }

  if (status === "draft" || status === "in_progress") {
    return "draft";
  }

  if (input.kind === "work_diary" || st === "work_diary" || folder.startsWith("יומני עבודה")) {
    return "work_diary";
  }
  if (
    input.kind === "measurement_sheet" ||
    st.includes("measurement") ||
    folder.startsWith("דוחות ביצוע") ||
    folder.startsWith("דפי מדידה") ||
    folder.startsWith("מדידות")
  ) {
    return "measurement";
  }
  if (
    input.kind === "delivery_note" ||
    st.includes("delivery") ||
    folder.startsWith("תעודות משלוח")
  ) {
    return "delivery";
  }
  if (
    input.kind === "invoice" ||
    st.includes("invoice") ||
    st.includes("account") ||
    folder.startsWith("חשבונות") ||
    folder.startsWith("חשבון")
  ) {
    return "invoice";
  }
  if (
    input.kind === "change_order" ||
    st.includes("change") ||
    folder.includes("שינו")
  ) {
    return "change";
  }

  if (input.type === "image" || input.type === "video" || folder.startsWith("תמונות") || folder.startsWith("סרטונים")) {
    return "files";
  }

  return "files";
}

export const TONE_CLASS: Record<StatusTone, string> = {
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  yellow: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-800 border-red-200",
  blue: "bg-sky-50 text-sky-800 border-sky-200",
  signed: "bg-violet-50 text-violet-800 border-violet-200",
  gray: "bg-stone-100 text-stone-700 border-stone-200",
  orange: "bg-orange-50 text-orange-800 border-orange-200",
};
