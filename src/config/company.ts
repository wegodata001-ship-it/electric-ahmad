/**
 * Company profile for official documents (delivery notes, invoices).
 * Set via env — never hardcode a client brand in source.
 */

function companyInitials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 4).toUpperCase();
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const name = (process.env.NEXT_PUBLIC_COMPANY_NAME ?? "").trim();

export const COMPANY_PROFILE = {
  name,
  legalName: (process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME ?? "").trim(),
  activity: (process.env.NEXT_PUBLIC_COMPANY_ACTIVITY ?? "").trim(),
  address: (process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "").trim(),
  phone: (process.env.NEXT_PUBLIC_COMPANY_PHONE ?? "").trim(),
  email: (process.env.NEXT_PUBLIC_COMPANY_EMAIL ?? "").trim(),
  website: (process.env.NEXT_PUBLIC_COMPANY_WEBSITE ?? "").trim(),
  vatId: (process.env.NEXT_PUBLIC_COMPANY_VAT_ID ?? "").trim(),
  /** Optional full logo image URL */
  logoUrl: (process.env.NEXT_PUBLIC_COMPANY_LOGO_URL ?? "").trim(),
  /** Short mark for placeholder badge when no logoUrl */
  logoText:
    (process.env.NEXT_PUBLIC_COMPANY_LOGO_TEXT ?? "").trim() ||
    companyInitials(name),
  brandBlue: "#1e40af",
  brandBlueDark: "#1e3a8a",
  brandBlueLight: "#dbeafe",
} as const;
