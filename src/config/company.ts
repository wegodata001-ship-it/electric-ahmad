/**
 * Company profile for official documents (delivery notes, invoices).
 * Override via env without code changes — each tenant brands their own docs.
 */

function companyInitials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "CO";
  if (parts.length === 1) return parts[0].slice(0, 4).toUpperCase();
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const name = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "WEGO ELECTRIC";

export const COMPANY_PROFILE = {
  name,
  legalName:
    process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME ?? "ווגו אלקטריק בע״מ",
  activity:
    process.env.NEXT_PUBLIC_COMPANY_ACTIVITY ??
    "קבלנות חשמל · תשתיות · מתח גבוה ונמוך",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "ישראל",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE ?? "050-0000000",
  email:
    process.env.NEXT_PUBLIC_COMPANY_EMAIL ?? "office@wego-electric.co.il",
  website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE ?? "",
  vatId: process.env.NEXT_PUBLIC_COMPANY_VAT_ID ?? "",
  /** Optional full logo image URL */
  logoUrl: process.env.NEXT_PUBLIC_COMPANY_LOGO_URL ?? "",
  /** Short mark for placeholder badge when no logoUrl */
  logoText:
    process.env.NEXT_PUBLIC_COMPANY_LOGO_TEXT ?? companyInitials(name),
  brandBlue: "#1e40af",
  brandBlueDark: "#1e3a8a",
  brandBlueLight: "#dbeafe",
} as const;
