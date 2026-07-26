/**
 * Sentry browser configuration.
 *
 * Only initialises when `NEXT_PUBLIC_SENTRY_DSN` is set (server-only DSN isn't
 * exposed to the client). No-op otherwise so local dev works without any
 * Sentry account.
 *
 * Kept intentionally minimal — no `Replay`, no `BrowserProfiling` — to avoid
 * shipping ~150KB of extra JS to the field portal on slow connections. Turn
 * those on later behind explicit `NEXT_PUBLIC_SENTRY_*` flags.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  try {
    Sentry.init({
      dsn,
      environment:
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: Number(
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0
      ),
      debug: false,
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
    });
  } catch (err) {
    console.warn("[sentry] client init failed — continuing without Sentry", err);
  }
}
