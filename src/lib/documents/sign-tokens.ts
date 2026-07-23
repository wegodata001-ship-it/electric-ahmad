import { createHash, randomBytes } from "crypto";

export function generateSignToken(): { raw: string; hash: string; publicId: string } {
  const raw = randomBytes(32).toString("base64url");
  const publicId = randomBytes(9).toString("base64url");
  const hash = hashSignToken(raw);
  return { raw, hash, publicId };
}

export function hashSignToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function buildSignUrl(opts: {
  baseUrl: string;
  kind: "work-diary" | "delivery-note" | "measurement-sheet";
  documentNumber: string;
  publicId: string;
  rawToken: string;
}): string {
  const path =
    opts.kind === "work-diary"
      ? `/sign/work-diary/${opts.documentNumber}`
      : opts.kind === "delivery-note"
        ? `/sign/delivery-note/${opts.documentNumber}`
        : `/sign/measurement-sheet/${opts.documentNumber}`;
  const url = new URL(path, opts.baseUrl);
  url.searchParams.set("t", `${opts.publicId}.${opts.rawToken}`);
  return url.toString();
}

export function parseSignQuery(tokenParam: string | null): {
  publicId: string;
  raw: string;
} | null {
  if (!tokenParam) return null;
  const dot = tokenParam.indexOf(".");
  if (dot <= 0) return null;
  return {
    publicId: tokenParam.slice(0, dot),
    raw: tokenParam.slice(dot + 1),
  };
}

export function whatsappShareUrl(phone: string | null | undefined, message: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const text = encodeURIComponent(message);
  if (digits) return `https://wa.me/${digits}?text=${text}`;
  return `https://wa.me/?text=${text}`;
}
