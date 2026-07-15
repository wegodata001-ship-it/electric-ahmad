/**
 * Removes chapter/document prefixes that Gemini sometimes embeds in descriptions.
 * Example: "[01 גלובל גולד / 01.08.01 עבודות חשמל] צבירה..." → "צבירה..."
 */
export function cleanBoqDescription(text: string | null | undefined): string {
  if (!text) return "";

  let cleaned = text.trim();

  // Remove one or more leading [ ... ] prefixes
  cleaned = cleaned.replace(/^(\[[^\]]*\]\s*)+/g, "");
  // Also fullwidth brackets
  cleaned = cleaned.replace(/^([【][^】]*[】]\s*)+/g, "");
  // Leading "פרק ..." style noise before dash
  cleaned = cleaned.replace(/^(פרק\s+[\d.\-]+\s*[:\-–]\s*)/i, "");

  return cleaned.trim();
}
