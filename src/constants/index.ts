import type {
  BoqItemStatus,
  DocumentType,
  EmployeeRole,
  InvoiceStatus,
  ProjectStatus,
} from "@/types";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "פעיל",
  completed: "הושלם",
  on_hold: "מושהה",
  planning: "בתכנון",
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  on_hold: "bg-orange-50 text-orange-700 border-orange-200",
  planning: "bg-gray-50 text-gray-600 border-gray-200",
};

export const BOQ_STATUS_LABELS: Record<BoqItemStatus, string> = {
  not_started: "לא התחיל",
  in_progress: "בביצוע",
  completed: "הושלם",
  on_hold: "מושהה",
};

export const BOQ_STATUS_COLORS: Record<BoqItemStatus, string> = {
  not_started: "bg-gray-50 text-gray-600 border-gray-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  on_hold: "bg-orange-50 text-orange-700 border-orange-200",
};

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  worker: "עובד",
  foreman: "מנהל עבודה",
  engineer: "מהנדס",
  manager: "מנהל",
  admin: "מנהל מערכת",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "טיוטה",
  pending_foreman_approval: "ממתין לאישור מנהל עבודה",
  approved_by_foreman: "אושר על ידי מנהל עבודה",
  rejected_by_foreman: "נדחה על ידי מנהל עבודה",
  sent_to_client: "נשלח ללקוח",
  paid: "שולם",
  // Legacy labels (existing DB rows)
  submitted: "הוגש",
  approved: "אושר",
  rejected: "נדחה",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  pending_foreman_approval: "bg-amber-50 text-amber-800 border-amber-200",
  approved_by_foreman: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected_by_foreman: "bg-red-50 text-red-700 border-red-200",
  sent_to_client: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

/** Short office badges for foreman workflow */
export const INVOICE_FOREMAN_BADGE_LABELS: Partial<Record<InvoiceStatus, string>> =
  {
    pending_foreman_approval: "ממתין לאישור",
    approved_by_foreman: "אושר",
    rejected_by_foreman: "נדחה",
  };

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  pdf: "PDF",
  excel: "Excel",
  word: "Word",
  dwg: "DWG",
  image: "תמונה",
  video: "וידאו",
  other: "אחר",
};

export const UNITS = ["יח'", "מ\"ר", "מ\"א", "ק\"ג", "ליטר", "שעה", "יום", "מערכת"] as const;

export const BOQ_ITEMS = [
  { code: "01.01", description: "חיבור לוח חשמל", unit: "יח'" },
  { code: "01.02", description: "התקנת לוח ראשי", unit: "יח'" },
  { code: "01.03", description: "התקנת לוח משנה", unit: "יח'" },
  { code: "02.01", description: "הנחת כבל תקשורת", unit: "מ\"א" },
  { code: "02.02", description: "הנחת כבל חשמל 3x2.5", unit: "מ\"א" },
  { code: "02.03", description: "הנחת כבל חשמל 3x6", unit: "מ\"א" },
  { code: "02.04", description: "הנחת כבל חשמל 5x16", unit: "מ\"א" },
  { code: "03.01", description: "התקנת שקע חשמלי", unit: "יח'" },
  { code: "03.02", description: "התקנת מתג תאורה", unit: "יח'" },
  { code: "03.03", description: "התקנת מתג דו-קוטבי", unit: "יח'" },
  { code: "04.01", description: "התקנת גוף תאורה LED", unit: "יח'" },
  { code: "04.02", description: "התקנת ספוט", unit: "יח'" },
  { code: "04.03", description: "התקנת פס לד", unit: "מ\"א" },
  { code: "05.01", description: "התקנת מפסק ראשי", unit: "יח'" },
  { code: "05.02", description: "התקנת ממסר הגנה", unit: "יח'" },
  { code: "05.03", description: "התקנת מפסק דלף", unit: "יח'" },
  { code: "06.01", description: "התקנת מערכת אזעקה", unit: "מערכת" },
  { code: "06.02", description: "התקנת גלאי עשן", unit: "יח'" },
  { code: "06.03", description: "התקנת סירנה", unit: "יח'" },
  { code: "07.01", description: "התקנת מצלמת אבטחה", unit: "יח'" },
  { code: "07.02", description: "התקנת NVR", unit: "יח'" },
  { code: "07.03", description: "הנחת כבל RG6", unit: "מ\"א" },
  { code: "08.01", description: "התקנת נקודת רשת", unit: "יח'" },
  { code: "08.02", description: "התקנת ארון תקשורת", unit: "יח'" },
  { code: "08.03", description: "התקנת מתג רשת", unit: "יח'" },
  { code: "09.01", description: "התקנת מזגן", unit: "יח'" },
  { code: "09.02", description: "חיווט מזגן", unit: "יח'" },
  { code: "10.01", description: "התקנת עמוד תאורה", unit: "יח'" },
  { code: "10.02", description: "התקנת תאורת חירום", unit: "יח'" },
  { code: "10.03", description: "בדיקת מערכת חשמל", unit: "מערכת" },
] as const;

export const CONTRACTORS = [
  "א.ל.מ הנדסה בע\"מ",
  "בוני העיר קבלנות",
  "דניה סיבוס",
  "אשטרום נדל\"ן",
  "מגה פרויקטים",
  "סולל בונה",
  "מליסרון",
  "אזורים",
  "שיכון ובינוי",
  "אפריקה ישראל",
] as const;

export const LOCATIONS = [
  "תל אביב - מגדל עזריאלי",
  "ירושלים - פרויקט גבעת שאול",
  "חיפה - מרכז מסחרי",
  "ראשון לציון - פארק הייטק",
  "פתח תקווה - מגדלי BSR",
  "באר שבע - קמפוס אוניברסיטה",
  "נתניה - מרכז רפואי",
  "אשדוד - נמל חדש",
  "רמת גן - Diamond Tower",
  "הרצליה - פארק תעשייה",
] as const;

export const FIRST_NAMES = [
  "יוסי", "דוד", "משה", "אבי", "רון", "עמית", "איתי", "גל", "ניר", "תומר",
  "אלי", "שי", "עידו", "אור", "דני", "מיכאל", "אלון", "בן", "ערן", "גיא",
] as const;

export const LAST_NAMES = [
  "כהן", "לוי", "מזרחי", "פרץ", "אברהם", "ביטון", "דהן", "אזולאי", "שמעון", "גולן",
  "ברק", "רוזן", "שפירא", "חדד", "מלכה", "סבג", "אוחיון", "בן דוד", "אטיאס", "חיים",
] as const;
