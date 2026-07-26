/**
 * Sprint 2 — Sentry smoke: send a test exception if DSN is configured.
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync } from "node:fs";
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const release =
  process.env.SENTRY_RELEASE ||
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ||
  "ops-sprint2-local";
const environment =
  process.env.SENTRY_ENVIRONMENT ||
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
  process.env.NODE_ENV ||
  "development";

const report = {
  measuredAt: new Date().toISOString(),
  dsnConfigured: Boolean(dsn),
  release,
  environment,
  eventSent: false,
  eventId: null,
  error: null,
};

if (!dsn) {
  report.error =
    "SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN not set — cannot send test event. Configure in production host ENV.";
  writeFileSync(
    new URL("./ops-sentry-smoke-results.json", import.meta.url),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}

Sentry.init({
  dsn,
  release,
  environment,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
});

try {
  const eventId = Sentry.captureException(
    new Error(`[ops-sprint2] Sentry smoke test ${new Date().toISOString()}`)
  );
  await Sentry.flush(5000);
  report.eventSent = Boolean(eventId);
  report.eventId = eventId || null;
} catch (e) {
  report.error = e.message;
}

writeFileSync(
  new URL("./ops-sentry-smoke-results.json", import.meta.url),
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report, null, 2));
process.exit(report.eventSent ? 0 : 1);
