import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  enforceRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Read-only production DB RTT probe (no mutations).
 * Rate-limited to prevent abuse.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limited = enforceRateLimit(
      {
        key: `perf-rtt:${ip}`,
        limit: 6,
        windowMs: 60_000,
      },
      "יותר מדי בדיקות ביצועים. נסו שוב בעוד דקה."
    );
    if (limited) return limited;

    const samples: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      await prisma.$queryRaw`SELECT 1`;
      samples.push(Math.round(performance.now() - t0));
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]!;

    return apiSuccess({
      vercelRegion: process.env.VERCEL_REGION ?? null,
      awsRegion: process.env.AWS_REGION ?? null,
      supabaseRegion: "eu-north-1",
      regionMatch: process.env.VERCEL_REGION === "arn1",
      samples,
      cold: samples[0],
      median,
      p95,
      measuredAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
