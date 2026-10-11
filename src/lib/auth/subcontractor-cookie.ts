import { SUBCONTRACTOR_ROLE } from "@/lib/auth/roles";
import { getSessionSecret } from "@/lib/env/required-secrets";

export const SUBCONTRACTOR_SESSION_COOKIE = "wego_sub_session";
export const SUBCONTRACTOR_SESSION_TTL_SECONDS = 60 * 60 * 12;

export type SubcontractorSessionPayload = {
  userId: string;
  subcontractorId: string;
  role: typeof SUBCONTRACTOR_ROLE;
  sessionVersion: number;
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
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(sig);
}

export async function signSubcontractorSession(
  payload: Omit<SubcontractorSessionPayload, "exp" | "role"> & {
    ttlSeconds?: number;
  }
): Promise<string> {
  const body: SubcontractorSessionPayload = {
    userId: payload.userId,
    subcontractorId: payload.subcontractorId,
    role: SUBCONTRACTOR_ROLE,
    sessionVersion: payload.sessionVersion ?? 0,
    exp:
      Math.floor(Date.now() / 1000) +
      (payload.ttlSeconds ?? SUBCONTRACTOR_SESSION_TTL_SECONDS),
  };
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(body)));
  const sig = await hmacSign(encoded);
  return `${encoded}.${sig}`;
}

export async function verifySubcontractorSession(
  token: string | undefined | null
): Promise<SubcontractorSessionPayload | null> {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  let expected: string;
  try {
    expected = await hmacSign(encoded);
  } catch (err) {
    console.error(
      "[sub-cookie] verifySubcontractorSession: session secret unavailable",
      err instanceof Error ? err.message : err
    );
    return null;
  }
  if (expected.length !== sig.length) return null;
  let ok = true;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== sig[i]) ok = false;
  }
  if (!ok) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded));
    const payload = JSON.parse(json) as SubcontractorSessionPayload;
    if (payload.role !== SUBCONTRACTOR_ROLE) return null;
    if (!payload.userId || !payload.subcontractorId) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function subcontractorSessionCookieOptions(
  maxAge = SUBCONTRACTOR_SESSION_TTL_SECONDS
) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
