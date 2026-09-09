import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { getSessionSecret } from "@/lib/env/required-secrets";

const VERSION = "v1";

function encryptionKey(): Buffer {
  return createHash("sha256")
    .update(`wego-document-share-token:${getSessionSecret()}`)
    .digest();
}

export function encryptShareToken(rawToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(rawToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, encrypted]
    .map((part) =>
      typeof part === "string" ? part : part.toString("base64url")
    )
    .join(".");
}

export function decryptShareToken(ciphertext: string | null): string | null {
  if (!ciphertext) return null;
  try {
    const [version, ivValue, tagValue, encryptedValue] =
      ciphertext.split(".");
    if (
      version !== VERSION ||
      !ivValue ||
      !tagValue ||
      !encryptedValue
    ) {
      return null;
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivValue, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
