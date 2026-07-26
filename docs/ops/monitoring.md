# Monitoring runbook

Short reference for the observability plumbing added in P8.

## Overview

We rely on three cheap building blocks — everything else is opt-in:

1. **`/api/health` readiness probe** — the source of truth for "is the app up
   and can it talk to Postgres?".
2. **Sentry (`@sentry/nextjs`)** — error + optional performance telemetry.
   Fully no-op when the DSN env vars are absent, so local dev doesn't need any
   Sentry account.
3. **Prisma slow-query log** — in development only, warns on any query slower
   than `PRISMA_SLOW_QUERY_MS` (default 500ms).

We deliberately keep this minimal for the current sprint: no distributed
tracing, no custom OTel exporter, no OpenTelemetry collector. Layer those on
later when the app moves off a single Vercel region.

## Health checks

Endpoint: `GET /api/health` — public, never authenticated.

### Response shape

```json
{
  "ok": true,
  "db": "up",
  "ts": "2026-07-26T13:44:00.000Z",
  "service": "wego-electric",
  "latencyMs": 12
}
```

Fields:

- `ok` — overall status. `true` only when the DB probe succeeded.
- `db` — `"up"` or `"down"`. Derived from `SELECT 1` against the primary DB.
- `ts` — server timestamp when the probe ran.
- `service` — always `"wego-electric"` so multiple deploys can share a checker.
- `latencyMs` — round-trip of the DB probe (useful signal on its own).

### Status codes

| Condition            | Status |
| -------------------- | ------ |
| DB reachable         | 200    |
| DB unreachable / OOM | 503    |

### Alerts to configure

At minimum:

- **Uptime**: alert if `/api/health` returns non-200 twice in a row (any
  external checker: Better Uptime, UptimeRobot, Vercel Monitoring).
- **DB latency**: warn when `latencyMs > 250` for 3 consecutive checks;
  page when `latencyMs > 1000`.
- **5xx rate**: alert when 5xx > 2% of requests over 5 minutes (Vercel or
  Sentry outbound webhook).

## Sentry

Install is already in `package.json` (`@sentry/nextjs`). The three legacy
config files live at the repo root:

- `sentry.client.config.ts` — browser
- `sentry.server.config.ts` — Node runtime
- `sentry.edge.config.ts` — Edge runtime (Proxy + edge route handlers)

They are stitched into Next.js in `src/instrumentation.ts` (server + edge)
and `src/instrumentation-client.ts` (browser).

### Environment variables

Server-side (must NOT be prefixed with `NEXT_PUBLIC_`):

| Var                            | Purpose                                             |
| ------------------------------ | --------------------------------------------------- |
| `SENTRY_DSN`                   | Server + edge DSN. When absent, Sentry is disabled. |
| `SENTRY_ENVIRONMENT`           | Overrides `NODE_ENV` in the Sentry environment tag. |
| `SENTRY_RELEASE`               | Release version (injected by CI, e.g. git SHA).     |
| `SENTRY_TRACES_SAMPLE_RATE`    | 0–1. Default 0 (errors only, no perf).              |

Browser-side (exposed to clients, safe to leak but still not secret):

| Var                                       | Purpose                                     |
| ----------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN`                  | Browser DSN. Distinct from the server DSN.  |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT`          | Overrides `NODE_ENV` for the browser SDK.   |
| `NEXT_PUBLIC_SENTRY_RELEASE`              | Same idea but for the client bundle.        |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`   | 0–1. Default 0.                             |

### Local dev

Leave all Sentry env vars unset. All three configs detect the missing DSN
and short-circuit to a no-op. Login and every other flow still work.

### Enabling in production

1. Create a Sentry project (Node.js + Browser JavaScript for Next.js).
2. Grab both DSNs from the project settings.
3. Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in Vercel → Project →
   Settings → Environment Variables (all environments except Development).
4. Optionally set `SENTRY_TRACES_SAMPLE_RATE=0.05` to sample 5% of traces.
5. Redeploy — no code changes required.

### Alerts to configure inside Sentry

- **New issue** → Slack #ops. Filter: `level:error environment:production`.
- **Regression** → same channel.
- **Spike protection** → cap `event_rate > 500/min` to prevent runaway bills.

## Prisma slow query log

In development only, every query slower than the configured threshold logs a
warning:

```
[prisma] slow query 812ms — SELECT "public"."DeliveryNote"."id" FROM ...
```

The threshold defaults to 500ms and is tunable per-shell via
`PRISMA_SLOW_QUERY_MS=250 npm run dev`.

Production behaviour is unchanged (only `error` events are logged), because
`$on('query')` per-request forwarding adds measurable latency at scale.

## Security signals

Failed login attempts are written to server logs by
`src/lib/security/rate-limit.ts#logFailedLogin`:

```
[security] failed-login bucket=auth-login ip=1.2.3.4 id=jane@example.com reason=bad-password
```

Vercel captures these in the runtime logs — no extra plumbing required.
When we onboard a SIEM (Datadog Logs / Better Stack / etc.), grep the
`[security]` prefix to feed detections.

## Rate limits

Configured in-process (single-instance!) in
`src/lib/security/rate-limit.ts`. Buckets currently in use:

| Route                                         | Limit / window     |
| --------------------------------------------- | ------------------ |
| `POST /api/auth/login`                        | 10 / 15 min / IP   |
| `POST /api/field/auth/login`                  | 10 / 15 min / IP   |
| `POST /api/upload`                            | 60 / hour / IP+user|
| `POST /api/sign/delivery-note/[num]`          | 30 / hour / IP     |
| `POST /api/sign/work-diary/[num]`             | 30 / hour / IP     |
| `POST /api/sign/measurement-sheet/[id]`       | 30 / hour / IP     |
| `POST /api/ai/reparse`                        | 20 / hour / IP+user|

When exceeded, the API returns `429` with a Hebrew message and
`Retry-After` seconds. Adjust the constants in each route file if a legitimate
workflow trips a limit; document the change here.
