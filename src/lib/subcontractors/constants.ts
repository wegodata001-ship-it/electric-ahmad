export const SUBCONTRACTOR_STATUSES = ["active", "inactive"] as const;
export const ASSIGNMENT_STATUSES = ["active", "completed", "cancelled"] as const;
export const PORTAL_ROLES = ["owner", "worker"] as const;
export const WORK_STATUSES = [
  "assigned",
  "in_progress",
  "submitted",
  "returned",
  "partial",
  "approved",
] as const;

export const WORK_STATUS_LABELS: Record<string, string> = {
  assigned: "הוקצתה",
  in_progress: "בביצוע",
  submitted: "ממתין לאישור",
  returned: "הוחזר לתיקון",
  partial: "אושר חלקית",
  approved: "אושר",
};

export const WORK_STATUS_COLORS: Record<string, string> = {
  assigned: "bg-slate-100 text-slate-700",
  in_progress: "bg-sky-100 text-sky-800",
  submitted: "bg-amber-100 text-amber-800",
  returned: "bg-red-100 text-red-800",
  partial: "bg-violet-100 text-violet-800",
  approved: "bg-emerald-100 text-emerald-800",
};

export const PORTAL_ROLE_LABELS: Record<string, string> = {
  owner: "בעל העסק",
  worker: "עובד קבלן",
};
export const ENGAGEMENT_TYPES = [
  "fixed",
  "unit",
  "meter",
  "day",
  "hour",
  "mixed",
] as const;

export const MEASUREMENT_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "approved",
  "returned",
  "partial",
] as const;

export const ACCOUNT_STATUSES = [
  "draft",
  "submitted",
  "pm_review",
  "approved",
  "ready_for_payment",
  "paid",
  "returned",
] as const;

export const DOCUMENT_CATEGORIES = [
  "agreement",
  "insurance",
  "tax",
  "other",
  "work_order",
  "measurement",
  "account",
  "shared",
] as const;

export const PAYMENT_METHODS = ["transfer", "check", "cash", "other"] as const;

export const LEDGER_TYPES = [
  "engagement",
  "reported",
  "approved",
  "account_submitted",
  "account_approved",
  "payment",
  "advance",
  "deduction",
  "correction",
] as const;

export const ENGAGEMENT_LABELS: Record<string, string> = {
  fixed: "מחיר קבוע",
  unit: "לפי יחידה",
  meter: "לפי מטר",
  day: "לפי יום",
  hour: "לפי שעה",
  mixed: "שיטה מעורבת",
};

export const MEASUREMENT_STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  submitted: "הוגש לבדיקה",
  in_review: "בבדיקה",
  approved: "מאושר",
  returned: "הוחזר לתיקון",
  partial: "אושר חלקית",
};

export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  submitted: "הוגש",
  pm_review: "בבדיקת מנהל פרויקט",
  approved: "מאושר",
  ready_for_payment: "מוכן לתשלום",
  paid: "שולם",
  returned: "הוחזר לתיקון",
};

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  agreement: "הסכם התקשרות",
  insurance: "ביטוח",
  tax: "אישורי מס",
  other: "מסמך נוסף",
  work_order: "הזמנת עבודה",
  measurement: "מדידה",
  account: "חשבון",
  shared: "מסמך משותף",
};

export function money(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function qty(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
