import { FIELD_MANAGER_ROLE } from "@/lib/auth/roles";
import { getSessionSecret } from "@/lib/env/required-secrets";

export const FIELD_SESSION_COOKIE = "wego_field_session";
export const FIELD_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export type FieldSessionPayload = {
  userId: string;
  employeeId: string;
  role: typeof FIELD_MANAGER_ROLE;
  exp: number;
};

function getSecret(): string {
  return getSessionSecret();
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
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

export async function signFieldSession(
  payload: Omit<FieldSessionPayload, "exp" | "role"> & {
    role?: typeof FIELD_MANAGER_ROLE;
    ttlSeconds?: number;
  }
): Promise<string> {
  const body: FieldSessionPayload = {
    userId: payload.userId,
    employeeId: payload.employeeId,
    role: FIELD_MANAGER_ROLE,
    exp:
      Math.floor(Date.now() / 1000) +
      (payload.ttlSeconds ?? FIELD_SESSION_TTL_SECONDS),
  };
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(body)));
  const sig = await hmacSign(encoded);
  return `${encoded}.${sig}`;
}

export async function verifyFieldSession(
  token: string | undefined | null
): Promise<FieldSessionPayload | null> {
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
    const payload = JSON.parse(json) as FieldSessionPayload;
    if (payload.role !== FIELD_MANAGER_ROLE) return null;
    if (!payload.userId || !payload.employeeId) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function fieldSessionCookieOptions(maxAge = FIELD_SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
