import { apiSuccess } from "@/lib/api/response";

/** Public liveness probe — must never require auth (used to verify Vercel routing). */
export async function GET() {
  return apiSuccess({
    ok: true,
    service: "wego-electric",
    ts: new Date().toISOString(),
  });
}
