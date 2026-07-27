# Vercel Environment Variables — Production Gate

> Root cause of 2026-07-27 Internal Server Error / login 500:
> **`SESSION_SECRET` was not set** on the Vercel project for
> `electric-ahmad.vercel.app`.
>
> Evidence (live):
> `POST https://electric-ahmad.vercel.app/api/auth/login`
> → `500` body:
> `סוד סשן חסר: יש להגדיר SESSION_SECRET ... / Missing session secret...`
>
> Source: `src/lib/env/required-secrets.ts` → `getSessionSecret()`
> called from `signOfficeSession` / `signFieldSession` during login.

## Required (Production + Preview)

Set in Vercel → Project → Settings → Environment Variables
(for **Production**, and ideally **Preview** too):

| Variable | Status if missing | Notes |
|----------|-------------------|--------|
| `SESSION_SECRET` | **Critical** | Random ≥ 32 chars, no `change-me`. Signs office/field cookies. |
| `DATABASE_URL` | **Critical** | Supabase Postgres pooler URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Required if storage used | Public project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required if storage used | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Required if storage used | **Server only** — never `NEXT_PUBLIC_` |

## Optional / not used by this app today

| Variable | Notes |
|----------|--------|
| `AUTH_SECRET` | Alias only if `SESSION_SECRET` unset |
| `DIRECT_URL` | Not required by current Prisma setup |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Not used (custom HMAC cookies) |
| `JWT_SECRET` | Not used |
| `SUPABASE_URL` | Use `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `OPENAI_API_KEY` | Optional (AI) |
| `GEMINI_API_KEY` | Optional (AI) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Optional monitoring |
| `CRON_SECRET` | Optional |
| `SMTP_PASSWORD` | Optional |

## Generate SESSION_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Paste into Vercel → Save → **Redeploy** (env changes require a new deployment).

## Verify after deploy

```bash
curl -s https://electric-ahmad.vercel.app/api/health
# expect: "ok": true, "config": { "sessionSecret": true, "databaseUrl": true, ... }

curl -s -X POST https://electric-ahmad.vercel.app/api/auth/login \
  -H "content-type: application/json" \
  -d "{\"username\":\"sysmgr\",\"password\":\"...\"}"
# expect: 200 + Set-Cookie (not 503 SESSION_SECRET missing)
```

Then open `/login` → sign in → portal home (no Internal Server Error).
