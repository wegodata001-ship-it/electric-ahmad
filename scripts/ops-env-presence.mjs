import { readFileSync } from "node:fs";
const t = readFileSync(".env.local", "utf8");
const keys = [
  "SESSION_SECRET",
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "JWT_SECRET",
  "OPENAI_API_KEY",
  "CRON_SECRET",
  "SMTP_PASSWORD",
  "SENTRY_DSN",
];
for (const k of keys) {
  const m = t.match(new RegExp("^" + k + "=(.*)$", "m"));
  const raw = m ? m[1] : "";
  const v = raw.replace(/^["']|["']$/g, "").trim();
  console.log(k + ": " + (v ? "SET len=" + v.length : "MISSING"));
}
