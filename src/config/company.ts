/**
 * Company profile for official documents (delivery notes, invoices) and UI branding.
 *
 * Values come from NEXT_PUBLIC_COMPANY_* env vars. If a value is missing, looks like
 * mojibake, or is a retired internal product name, we fall back to the client brand.
 */

const DEFAULT_NAME = "אחמד אבו גרה";
const DEFAULT_LEGAL_NAME = "ג.א הנדסת חשמל בע״מ";
const DEFAULT_TAGLINE = "ניהול פרויקטי חשמל";
const DEFAULT_LOGO_TEXT = "ג.א";
const DEFAULT_LOGO_URL = "/logopng.jpeg";

/** Colors sampled from the original client logo (red lightning + black wordmark). */
export const BRAND_COLORS = {
  primary: "#C8102E",
  primaryDark: "#9B0C24",
  primarySoft: "#FDECEE",
  secondary: "#111111",
  accent: "#C8102E",
  background: "#F6F7F8",
  surface: "#FFFFFF",
  border: "#E6E8EB",
  text: "#111111",
  textMuted: "#5B6470",
} as const;

const RETIRED_BRAND_NAMES = new Set([
  "nas system",
  "nas",
  "wego",
  "wego electric",
  "מערכת חשמל הזם",
  "הזם",
]);

/** Detect common UTF-8→Windows mojibake (e.g. ׳׳¢׳¨ instead of מערכת). */
function looksLikeMojibake(value: string): boolean {
  const gereshCount = (value.match(/\u05F3/g) || []).length;
  if (gereshCount >= 2) return true;
  if (/[\uFFFD\u0000-\u0008]/.test(value)) return true;
  return false;
}

function envText(name: string, fallback = ""): string {
  const raw = (process.env[name] ?? "").trim();
  if (!raw || looksLikeMojibake(raw)) return fallback;
  if (RETIRED_BRAND_NAMES.has(raw.toLowerCase())) return fallback;
  return raw;
}

function companyInitials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return DEFAULT_LOGO_TEXT;
  if (parts.length === 1) return parts[0].slice(0, 4);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

const name = envText("NEXT_PUBLIC_COMPANY_NAME", DEFAULT_NAME);
const legalName = envText("NEXT_PUBLIC_COMPANY_LEGAL_NAME", DEFAULT_LEGAL_NAME);
const tagline = envText("NEXT_PUBLIC_COMPANY_ACTIVITY", DEFAULT_TAGLINE);

export const COMPANY_PROFILE = {
  name,
  legalName,
  tagline,
  activity: tagline,
  address: envText("NEXT_PUBLIC_COMPANY_ADDRESS"),
  phone: envText("NEXT_PUBLIC_COMPANY_PHONE"),
  email: envText("NEXT_PUBLIC_COMPANY_EMAIL"),
  website: envText("NEXT_PUBLIC_COMPANY_WEBSITE"),
  vatId: envText("NEXT_PUBLIC_COMPANY_VAT_ID"),
  /** Original client logo. Do not substitute a generated mark. */
  logoUrl: envText("NEXT_PUBLIC_COMPANY_LOGO_URL", DEFAULT_LOGO_URL),
  logoText: envText(
    "NEXT_PUBLIC_COMPANY_LOGO_TEXT",
    companyInitials(name) || DEFAULT_LOGO_TEXT
  ),
  brandBlue: BRAND_COLORS.primary,
  brandBlueDark: BRAND_COLORS.primaryDark,
  brandBlueLight: BRAND_COLORS.primarySoft,
} as const;
