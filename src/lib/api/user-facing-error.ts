/** Map technical / Prisma errors to short Hebrew messages for end users. */
export function toUserFacingError(error: unknown, fallback = "שגיאת שרת"): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : fallback;

  const msg = raw.trim();
  const lower = msg.toLowerCase();

  if (
    lower.includes("prisma") ||
    lower.includes("invocation") ||
    lower.includes("unique constraint") ||
    lower.includes("foreign key") ||
    lower.includes("p2002") ||
    lower.includes("p2003") ||
    lower.includes("p2025") ||
    lower.includes("sql") ||
    lower.includes("stack")
  ) {
    if (lower.includes("unique") || lower.includes("p2002")) {
      return "הערך כבר קיים במערכת. בחרו שם אחר או רעננו את המסך.";
    }
    if (lower.includes("foreign") || lower.includes("p2003")) {
      return "לא ניתן לבצע את הפעולה — חסר קישור לנתונים קשורים.";
    }
    if (lower.includes("p2025") || lower.includes("not found")) {
      return "הרשומה לא נמצאה. ייתכן שהיא נמחקה — רעננו את המסך.";
    }
    return "הפעולה נכשלה. נסו שוב או פנו למנהל המערכת.";
  }

  if (lower.includes("unauthorized") || lower.includes("forbidden")) {
    return "אין הרשאה לבצע פעולה זו.";
  }

  if (lower.includes("network") || lower.includes("fetch")) {
    return "אין חיבור לשרת. בדקו את הרשת ונסו שוב.";
  }

  // Already Hebrew / business message
  if (/[\u0590-\u05FF]/.test(msg)) return msg;

  return fallback;
}
