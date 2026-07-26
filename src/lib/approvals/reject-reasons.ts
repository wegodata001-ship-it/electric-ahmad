export const REJECT_REASONS = [
  { id: "missing_data", label: "חסרים נתונים" },
  { id: "missing_photos", label: "חסרות תמונות" },
  { id: "qty_error", label: "טעות בכמויות" },
  { id: "measurement_error", label: "טעות במדידה" },
  { id: "calc_error", label: "טעות בחישוב" },
  { id: "other", label: "אחר" },
] as const;

export type RejectReasonId = (typeof REJECT_REASONS)[number]["id"];

export function formatRejectComment(input: {
  reasonId: string;
  notes: string;
  attachmentUrls?: string[];
}) {
  const reason =
    REJECT_REASONS.find((r) => r.id === input.reasonId)?.label || "אחר";
  const lines = [`[סיבה: ${reason}]`, input.notes.trim()];
  if (input.attachmentUrls?.length) {
    lines.push("", "קבצים מצורפים לתיקון:");
    for (const url of input.attachmentUrls) lines.push(`- ${url}`);
  }
  return lines.join("\n");
}
