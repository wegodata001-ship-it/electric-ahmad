export type GeminiErrorKind =
  | "rate_limit"
  | "unavailable"
  | "timeout"
  | "auth"
  | "invalid_json"
  | "validation"
  | "permanent"
  | "unknown";

export function classifyGeminiError(error: unknown): GeminiErrorKind {
  const raw =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : "";
  const text = raw.toLowerCase();

  if (
    error instanceof Error &&
    (error.name === "AbortError" || /aborted|timeout|תם הזמן/.test(text))
  ) {
    return "timeout";
  }
  if (/\b429\b|resource.?exhausted|rate.?limit|quota/.test(text)) {
    return "rate_limit";
  }
  if (/\b503\b|\b500\b|\b502\b|unavailable|overloaded|internal/.test(text)) {
    return "unavailable";
  }
  if (/\b401\b|\b403\b|api.?key|permission|unauthenticated/.test(text)) {
    return "auth";
  }
  if (/json|לא התקבל json/.test(text)) {
    return "invalid_json";
  }
  if (/validation|סכמה|לא תקין/.test(text)) {
    return "validation";
  }
  if (/\b400\b|\b404\b|invalid.?argument|unsupported/.test(text)) {
    return "permanent";
  }
  return "unknown";
}

export function isTransientGeminiError(kind: GeminiErrorKind): boolean {
  return kind === "rate_limit" || kind === "unavailable" || kind === "unknown";
}

export function geminiErrorCode(kind: GeminiErrorKind): string {
  switch (kind) {
    case "rate_limit":
      return "GEMINI_429";
    case "unavailable":
      return "GEMINI_UNAVAILABLE";
    case "timeout":
      return "TIMEOUT";
    case "auth":
      return "GEMINI_AUTH";
    case "invalid_json":
      return "INVALID_JSON";
    case "validation":
      return "VALIDATION";
    default:
      return "GEMINI_ERROR";
  }
}

export function geminiUserMessage(kind: GeminiErrorKind, fallback?: string): string {
  switch (kind) {
    case "rate_limit":
      return "שירות ה-AI עמוס כרגע. ננסה שוב אוטומטית.";
    case "unavailable":
      return "שירות ה-AI לא זמין זמנית. ננסה שוב אוטומטית.";
    case "timeout":
      return "תם הזמן לסריקת AI.";
    case "auth":
      return "הגדרות AI חסרות או לא תקינות.";
    case "invalid_json":
      return "ה-AI החזיר תשובה לא תקינה. לא נשמרו נתונים חלקיים.";
    case "validation":
      return "תוצאת הסריקה נכשלה בבדיקה. לא נשמרו נתונים חלקיים.";
    default:
      return fallback || "לא הצלחנו להשלים את סריקת המסמך. הקובץ המקורי נשמר בפרויקט.";
  }
}
