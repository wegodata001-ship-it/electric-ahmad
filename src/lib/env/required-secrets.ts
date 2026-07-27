/**
 * Fail-closed secret validation for production.
 *
 * Design principles:
 *  - NO hardcoded fallbacks / dev defaults for anything that signs, encrypts,
 *    or authorizes requests.
 *  - Missing / empty / whitespace-only values are treated as absent.
 *  - Well-known placeholder values (e.g. containing `change-me`) are rejected
 *    even when technically "present" — those slipping into production would
 *    cause silent auth compromise.
 *
 * All error messages are bilingual (Hebrew + English) so ops sees the failure
 * clearly regardless of environment.
 */

import { supabaseConfig } from "@/config/storage";

/** Thrown when session/HMAC secrets are missing or invalid — map to HTTP 503. */
export class SessionSecretError extends Error {
  readonly status = 503;
  readonly code = "SESSION_SECRET_MISSING" as const;

  constructor(message: string) {
    super(message);
    this.name = "SessionSecretError";
  }
}

const KNOWN_BAD_SESSION_SECRETS: readonly string[] = [
  "wego-dev-field-session-secret-change-me",
];

function isBlank(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}

function looksLikePlaceholder(value: string): boolean {
  const lowered = value.toLowerCase();
  if (KNOWN_BAD_SESSION_SECRETS.some((bad) => value === bad)) return true;
  if (lowered.includes("change-me")) return true;
  if (lowered.includes("changeme")) return true;
  return false;
}

/**
 * Return a required environment secret or throw a clear bilingual error.
 * Empty strings and whitespace-only values are treated as missing.
 */
export function getRequiredSecret(name: string): string {
  const raw = process.env[name];
  if (isBlank(raw)) {
    throw new Error(
      `סוד סביבה חסר: ${name} / Missing required environment secret: ${name}`
    );
  }
  return raw as string;
}

/**
 * Return the HMAC session secret used for signing office/field cookies.
 *
 * Rules:
 *  - SESSION_SECRET is the canonical name.
 *  - AUTH_SECRET is accepted only when SESSION_SECRET is not set (alias for
 *    convenience with existing tooling).
 *  - Whichever value is used must be at least 32 characters and must NOT be a
 *    known placeholder / "change-me" value.
 *  - If neither is set, throw.
 */
export function getSessionSecret(): string {
  const primary = process.env.SESSION_SECRET;
  const alias = process.env.AUTH_SECRET;
  const chosenName = !isBlank(primary)
    ? "SESSION_SECRET"
    : !isBlank(alias)
      ? "AUTH_SECRET"
      : null;

  if (!chosenName) {
    throw new SessionSecretError(
      "סוד סשן חסר: יש להגדיר SESSION_SECRET ב־Vercel (Project → Settings → Environment Variables) / " +
        "Missing session secret: set SESSION_SECRET (preferred) or AUTH_SECRET in the host environment"
    );
  }

  const value = (chosenName === "SESSION_SECRET" ? primary : alias) as string;

  if (looksLikePlaceholder(value)) {
    throw new SessionSecretError(
      `סוד סשן פסול (${chosenName}) — ערך ברירת מחדל אסור בשימוש בייצור / ` +
        `Refusing to use placeholder session secret in ${chosenName}. ` +
        `Generate a strong random value (>= 32 chars).`
    );
  }

  if (value.length < 32) {
    throw new SessionSecretError(
      `סוד הסשן ${chosenName} קצר מ־32 תווים / ` +
        `${chosenName} must be at least 32 characters long (got ${value.length}).`
    );
  }

  return value;
}

/**
 * Configuration describing which optional secrets should be validated when
 * present. We NEVER invent a default; we only guarantee the value is not a
 * placeholder if the operator chose to set it.
 */
const OPTIONAL_SECRETS: readonly string[] = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "SMTP_PASSWORD",
  "NEXTAUTH_SECRET",
  "JWT_SECRET",
  "CRON_SECRET",
  "AUTH_SECRET",
];

function assertNotPlaceholder(name: string, value: string): void {
  if (looksLikePlaceholder(value)) {
    throw new Error(
      `סוד סביבה ${name} מכיל ערך ברירת מחדל אסור / ` +
        `Environment secret ${name} contains a placeholder value ("change-me"). ` +
        `Rotate to a real secret before starting the server.`
    );
  }
}

/**
 * Validate all secrets required for production at startup. Intended to run
 * once from `instrumentation.ts#register`. Behaviour:
 *   - In production: strict — throws on any missing/invalid required secret.
 *   - In development/test: warns to stderr for missing required secrets but
 *     does NOT throw, so local dev without a full `.env` still works.
 *   - Placeholder values (`change-me`, etc.) are rejected in ALL environments
 *     to make sure known-bad defaults never load, even locally.
 */
export function assertProductionSecrets(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  const requireOrCollect = (name: string, extra?: (v: string) => string | null) => {
    const raw = process.env[name];
    if (isBlank(raw)) {
      const msg = `Missing required secret: ${name}`;
      if (isProduction) errors.push(msg);
      else warnings.push(msg);
      return;
    }
    const value = raw as string;
    try {
      assertNotPlaceholder(name, value);
    } catch (err) {
      errors.push((err as Error).message);
      return;
    }
    if (extra) {
      const problem = extra(value);
      if (problem) {
        if (isProduction) errors.push(problem);
        else warnings.push(problem);
      }
    }
  };

  requireOrCollect("SESSION_SECRET", (v) =>
    v.length < 32
      ? `SESSION_SECRET must be at least 32 characters long (got ${v.length}).`
      : null
  );
  requireOrCollect("DATABASE_URL");

  const supabaseConfigured =
    !isBlank(supabaseConfig.url) ||
    !isBlank(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    !isBlank(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    !isBlank(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (supabaseConfigured) {
    requireOrCollect("NEXT_PUBLIC_SUPABASE_URL");
    requireOrCollect("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    requireOrCollect("SUPABASE_SERVICE_ROLE_KEY");
  }

  for (const name of OPTIONAL_SECRETS) {
    const raw = process.env[name];
    if (isBlank(raw)) continue;
    try {
      assertNotPlaceholder(name, raw as string);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }

  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`[env] ${w}`);
    }
  }

  if (errors.length > 0) {
    const joined = errors.map((e) => ` - ${e}`).join("\n");
    throw new Error(
      "בדיקת סודות הסביבה נכשלה / Environment secret validation failed:\n" +
        joined
    );
  }
}
