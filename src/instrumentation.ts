/**
 * Next.js instrumentation hook — runs once on server boot before any request
 * is handled. We use it as the single fail-closed startup gate for required
 * environment secrets and to bootstrap Sentry on the server + edge runtimes.
 *
 * Behaviour:
 *  - Node runtime: validate secrets (throws in production on missing/bad
 *    values) and load the server-side Sentry config (no-op if no DSN).
 *  - Edge runtime: skip secret validation (process.env is per-request) and
 *    load the edge Sentry config only.
 *
 * See src/lib/env/required-secrets.ts for the validation matrix and the
 * sentry.*.config.ts files at the project root for the Sentry init logic.
 */

import type { Instrumentation } from "next";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionSecrets } = await import(
      "@/lib/env/required-secrets"
    );
    assertProductionSecrets();

    // Sentry — no-op when DSN is not set. Import failures must never crash
    // the server, so we swallow them and log a warning.
    try {
      await import("../sentry.server.config");
    } catch (err) {
      console.warn("[instrumentation] server sentry import failed", err);
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    try {
      await import("../sentry.edge.config");
    } catch (err) {
      console.warn("[instrumentation] edge sentry import failed", err);
    }
  }
}

/**
 * Forward request-scoped errors to Sentry when it is configured. Sentry
 * exposes `captureRequestError` as the canonical implementation for the
 * `onRequestError` hook; we call it dynamically so the app still builds
 * without Sentry and stays a no-op locally.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/nextjs");
    const captureRequestError = (
      Sentry as unknown as {
        captureRequestError?: Instrumentation.onRequestError;
      }
    ).captureRequestError;
    if (typeof captureRequestError === "function") {
      await captureRequestError(err, request, context);
    } else if (typeof Sentry.captureException === "function") {
      Sentry.captureException(err);
    }
  } catch {
    // Swallow — instrumentation must never break user-facing requests.
  }
};
