/**
 * Client-side instrumentation — runs before React hydration.
 *
 * Only initialises Sentry when `NEXT_PUBLIC_SENTRY_DSN` is set (see
 * `sentry.client.config.ts` for the details). No-op otherwise, so the field
 * portal keeps loading fine in local/dev without any Sentry credentials.
 */

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import("../sentry.client.config").catch((err) => {
    console.warn("[instrumentation-client] sentry import failed", err);
  });
}
