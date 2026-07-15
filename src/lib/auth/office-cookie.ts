import {
  ADMIN_ROLE,
  LEGACY_SYSTEM_ADMIN_ROLE,
  PROJECT_MANAGER_ROLE,
  isOfficeRole,
} from "@/lib/auth/roles";

export const OFFICE_SESSION_COOKIE = "wego_office_session";
export const OFFICE_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h
export const OFFICE_SESSION_REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30d

export type OfficeSessionPayload = {
  userId: string;
  role: string;
  exp: number;
};

function getSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    "wego-dev-field-session-secret-change-me"
  );
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]!);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacSign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return toBase64Url(sig);
}

export async function signOfficeSession(payload: {
  userId: string;
  role: string;
  ttlSeconds?: number;
}): Promise<string> {
  if (!isOfficeRole(payload.role)) {
    throw new Error("תפקיד לא מורשה למערכת המשרד");
  }
  const body: OfficeSessionPayload = {
    userId: payload.userId,
    role: payload.role,
    exp:
      Math.floor(Date.now() / 1000) +
      (payload.ttlSeconds ?? OFFICE_SESSION_TTL_SECONDS),
  };
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(body)));
  const sig = await hmacSign(encoded);
  return `${encoded}.${sig}`;
}

export async function verifyOfficeSession(
  token: string | undefined | null
): Promise<OfficeSessionPayload | null> {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = await hmacSign(encoded);
  if (expected.length !== sig.length) return null;
  let ok = true;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== sig[i]) ok = false;
  }
  if (!ok) return null;

  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded));
    const payload = JSON.parse(json) as OfficeSessionPayload;
    if (!isOfficeRole(payload.role)) return null;
    if (!payload.userId) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function officeSessionCookieOptions(
  maxAge = OFFICE_SESSION_TTL_SECONDS
) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export const OFFICE_ALLOWED_ROLES = [
  PROJECT_MANAGER_ROLE,
  ADMIN_ROLE,
  LEGACY_SYSTEM_ADMIN_ROLE,
  "admin",
] as const;
