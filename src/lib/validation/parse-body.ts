/**
 * Small parsing helpers that combine JSON extraction + Zod validation.
 *
 * All failure paths throw a plain `Error` with a Hebrew message so it slots
 * straight into the existing `handleApiError` pipeline in `@/lib/api/response`
 * (which returns 400 with `error.message`). We deliberately avoid throwing
 * `ZodError` because those messages are English/technical and would leak
 * through to the UI.
 */

import type { z } from "zod";

/** Thrown for validation failures so callers can distinguish input errors. */
export class ValidationError extends Error {
  readonly status = 400;
  readonly issues: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    issues: Array<{ path: string; message: string }> = []
  ) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

function formatIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>
): { header: string; details: Array<{ path: string; message: string }> } {
  const details = issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "(root)",
    message: issue.message || "ערך לא תקין",
  }));

  const first = details[0];
  const header = first
    ? first.path === "(root)"
      ? first.message
      : `${first.path}: ${first.message}`
    : "ערכי הבקשה אינם תקינים";

  return { header, details };
}

/**
 * Read `request.json()` and validate with `schema.safeParse`.
 * Throws `ValidationError` on invalid JSON or validation failure.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError("גוף הבקשה אינו JSON תקין");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const { header, details } = formatIssues(result.error.issues);
    throw new ValidationError(header, details);
  }
  return result.data;
}

/**
 * Validate an already-extracted object (e.g. from `FormData`). Same error
 * shape as `parseJsonBody` so route handlers can share catch blocks.
 */
export function parseObjectBody<T>(
  input: unknown,
  schema: z.ZodType<T>
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const { header, details } = formatIssues(result.error.issues);
    throw new ValidationError(header, details);
  }
  return result.data;
}

/** Convert a FormData into a plain string-keyed object (drops File values). */
export function formDataToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
