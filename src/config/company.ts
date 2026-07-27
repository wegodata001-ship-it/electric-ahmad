/**
 * Company profile for official documents (delivery notes, invoices) and login branding.
 *
 * Values come from NEXT_PUBLIC_COMPANY_* env vars. If a value is missing or looks like
 * mojibake (common when Windows/process env overrides a good .env.local), we fall back
 * to the product brand defaults below — never show garbled Hebrew in the UI.
 */

const DEFAULT_NAME = "מערכת חשמל הזם";
const DEFAULT_LOGO_TEXT = "הזם";

/** Detect common UTF-8→Windows mojibake (e.g. ׳׳¢׳¨ instead of מערכת). */
function looksLikeMojibake(value: string): boolean {
  const gereshCount = (value.match(/\u05F3/g) || []).length;
  if (gereshCount >= 2) return true;
  // Replacement chars / control leftovers from bad decoding
  if (/[\uFFFD\u0000-\u0008]/.test(value)) return true;
  return false;
}

function envText(name: string, fallback = ""): string {
  const raw = (process.env[name] ?? "").trim();
  if (!raw || looksLikeMojibake(raw)) return fallback;
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

export const COMPANY_PROFILE = {
  name,
  legalName: envText("NEXT_PUBLIC_COMPANY_LEGAL_NAME", name),
  activity: envText("NEXT_PUBLIC_COMPANY_ACTIVITY", "חשמל"),
  address: envText("NEXT_PUBLIC_COMPANY_ADDRESS"),
  phone: envText("NEXT_PUBLIC_COMPANY_PHONE"),
  email: envText("NEXT_PUBLIC_COMPANY_EMAIL"),
  website: envText("NEXT_PUBLIC_COMPANY_WEBSITE"),
  vatId: envText("NEXT_PUBLIC_COMPANY_VAT_ID"),
  /** Optional full logo image URL */
  logoUrl: envText("NEXT_PUBLIC_COMPANY_LOGO_URL", "/logopng.jpeg"),
  /** Short mark for placeholder badge when logo image is unavailable */
  logoText: envText(
    "NEXT_PUBLIC_COMPANY_LOGO_TEXT",
    companyInitials(name) || DEFAULT_LOGO_TEXT
  ),
  brandBlue: "#1e40af",
  brandBlueDark: "#1e3a8a",
  brandBlueLight: "#dbeafe",
} as const;
