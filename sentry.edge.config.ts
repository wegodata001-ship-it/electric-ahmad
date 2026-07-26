/**
 * Sentry edge-runtime configuration.
 *
 * Runs inside Next.js Proxy / edge route handlers. Same no-op-when-missing
 * philosophy as `sentry.server.config.ts`.
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
      release: process.env.SENTRY_RELEASE || undefined,
    });
  } catch (err) {
    console.warn("[sentry] edge init failed — continuing without Sentry", err);
  }
}
