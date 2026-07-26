/** Validate client signature data URL before accepting. */
export function assertValidSignatureDataUrl(raw: string) {
  const value = String(raw || "").trim();
  if (!value.startsWith("data:image/")) {
    throw new Error("החתימה אינה תקינה — יש לחתום מחדש");
  }
  if (value.length < 800) {
    throw new Error("החתימה קצרה מדי — יש לחתום בבירור בתוך המסגרת");
  }
  if (value.length > 2_500_000) {
    throw new Error("קובץ החתימה גדול מדי");
  }
  return value;
}
