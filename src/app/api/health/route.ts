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
 * Response shape stays stable — dashboards depend on it:
 *   { ok: boolean, db: 'up' | 'down', ts: string, service: string, error?: string }
 */
export async function GET() {
  const started = Date.now();
  const ts = new Date().toISOString();
  const service = "wego-electric";

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        ok: true,
        db: "up",
        ts,
        service,
        latencyMs: Date.now() - started,
      },
      { status: 200 }
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
        error: "database unreachable",
      },
      { status: 503 }
    );
  }
}
