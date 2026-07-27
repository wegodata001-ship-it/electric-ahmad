import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Readiness / liveness probe.
 *
 * Must never require auth (used by Vercel + external uptime checks) and
 * must never crash on missing config. The endpoint does a cheap `SELECT 1`
 * against Postgres to prove the DB is reachable; a failure returns HTTP 503
 * with `db: "down"` so orchestration can pull the instance out of rotation.
 *
 * Also reports whether SESSION_SECRET is present (boolean only — never the value).
 * Missing session secret is why login/auth pages return 503 after Sprint 1 fail-closed.
 */
export async function GET() {
  const started = Date.now();
  const ts = new Date().toISOString();
  const service = "wego-electric";

  const sessionSecret =
    Boolean(process.env.SESSION_SECRET?.trim()) ||
    Boolean(process.env.AUTH_SECRET?.trim());
  const databaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const supabase =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  try {
    await prisma.$queryRaw`SELECT 1`;
    const ok = sessionSecret && databaseUrl;
    return NextResponse.json(
      {
        ok,
        db: "up",
        ts,
        service,
        latencyMs: Date.now() - started,
        config: {
          sessionSecret,
          databaseUrl,
          supabase,
        },
        ...(ok
          ? {}
          : {
              error: !sessionSecret
                ? "SESSION_SECRET missing"
                : "required config incomplete",
            }),
      },
      { status: ok ? 200 : 503 }
    );
  } catch (error) {
    // Never leak stack traces / connection strings to health consumers.
    const message = error instanceof Error ? error.message : String(error);
    console.error("[health] db probe failed", message);
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        ts,
        service,
        latencyMs: Date.now() - started,
        config: {
          sessionSecret,
          databaseUrl,
          supabase,
        },
        error: "database unreachable",
      },
      { status: 503 }
    );
  }
}
