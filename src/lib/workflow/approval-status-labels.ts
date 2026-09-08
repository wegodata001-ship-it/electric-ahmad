const APPROVAL_STATUS_LABELS: Record<string, string> = {
  approved: "אושר",
  pending: "ממתין לאישור",
  cancelled: "בוטל",
  rejected: "נדחה",
  returned_for_correction: "הוחזר לתיקון",
};

export function approvalStatusLabel(status: string | null | undefined): string {
  const normalized = String(status ?? "").trim();
  return APPROVAL_STATUS_LABELS[normalized] || normalized || "לא ידוע";
}
