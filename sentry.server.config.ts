/**
 * Sentry server-runtime configuration.
 *
 * No-ops when `SENTRY_DSN` (or `NEXT_PUBLIC_SENTRY_DSN`) is not set so local
 * development and CI don't need Sentry credentials. The moment a DSN is
 * provided, Sentry is initialised with conservative defaults suited to a
 * privacy-sensitive B2B app in Hebrew:
 *
 *   - tracing off by default (opt-in via `SENTRY_TRACES_SAMPLE_RATE`)
 *   - `debug=false` even in dev to keep the console clean
 *   - environment defaults to `NODE_ENV`, overridable via `SENTRY_ENVIRONMENT`
 *
 * IMPORTANT: this file must not throw during import. Auth flows and every
 * server startup path load it, and a bad Sentry config must never break login.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
      debug: false,
      // Attach the release if the deploy pipeline injected one; skip otherwise
      // so Sentry doesn't group everything under `unknown`.
      release: process.env.SENTRY_RELEASE || undefined,
    });
  } catch (err) {
    console.warn("[sentry] server init failed — continuing without Sentry", err);
  }
}
