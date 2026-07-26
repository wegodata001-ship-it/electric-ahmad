/**
 * In-memory sliding-window rate limiter.
 *
 * Intended for single-instance protection of sensitive endpoints (login,
 * upload, public sign, AI). It is NOT a distributed limiter — if we run more
 * than one Node instance the counters diverge, and if the process restarts we
 * forget everything. That's an acceptable trade-off for the current sprint:
 * the app runs as a single Vercel serverless region and the goal is
 * hardening against script kiddies / accidental floods, not a state-level
 * adversary. Anything stronger needs Redis / Upstash / Vercel KV.
 *
 * Design notes:
 *  - True sliding window: we store the timestamps of the last N attempts and
 *    drop anything older than `windowMs`. That avoids the fencepost issue
 *    fixed-window counters have where a burst spans two buckets.
 *  - Buckets are pruned lazily on each call. A cheap size cap keeps memory
 *    bounded even under high fan-in (many distinct keys).
 *  - `checkRateLimit` never throws — callers pick between returning the 429
 *    Response and short-circuiting via `enforceRateLimit`.
 *  - All user-facing messages are Hebrew to match the rest of the app.
 */

import { NextResponse, type NextRequest } from "next/server";

type Bucket = {
  /** Ordered oldest → newest attempt timestamps (ms since epoch). */
  hits: number[];
  /** Cached expiry for the oldest hit — enables fast eviction sweeps. */
  oldestExpiresAt: number;
};

const store = new Map<string, Bucket>();

/** Hard cap on distinct keys to prevent memory blowup from IP fan-in / abuse. */
const MAX_KEYS = 5000;

export type RateLimitInput = {
  /** Composite key — usually `${bucket}:${ip}` or `${bucket}:${ip}:${userId}`. */
  key: string;
  /** Max hits allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
  /** Effective limit that produced this decision (mirrors input for callers). */
  limit: number;
  /** Window in milliseconds (mirrors input for callers). */
  windowMs: number;
};

function prune(bucket: Bucket, cutoff: number): void {
  // Cheap fast path — nothing to drop.
  if (bucket.hits.length === 0 || bucket.hits[0]! >= cutoff) return;
  let i = 0;
  while (i < bucket.hits.length && bucket.hits[i]! < cutoff) i++;
  bucket.hits.splice(0, i);
  bucket.oldestExpiresAt = bucket.hits[0] ?? 0;
}

function evictIfHuge(): void {
  if (store.size <= MAX_KEYS) return;
  // Drop the oldest ~10% by first-hit time. Map iteration is insertion order,
  // which is a good enough approximation of "least recently created".
  const dropCount = Math.max(1, Math.floor(store.size / 10));
  let dropped = 0;
  for (const k of store.keys()) {
    store.delete(k);
    dropped++;
    if (dropped >= dropCount) break;
  }
}

/**
 * Consume one hit against the bucket identified by `key` and return whether
 * the caller is over the limit. The current hit is always recorded (so
 * bad actors can't blow past the limit by ignoring 429s — repeated attempts
 * only push the retry-after further out).
 */
export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  const { key, limit, windowMs } = input;
  const now = Date.now();
  const cutoff = now - windowMs;

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { hits: [], oldestExpiresAt: 0 };
    store.set(key, bucket);
    evictIfHuge();
  } else {
    prune(bucket, cutoff);
  }

  bucket.hits.push(now);
  if (bucket.hits.length === 1) bucket.oldestExpiresAt = now;

  const used = bucket.hits.length;
  if (used <= limit) {
    return {
      ok: true,
      remaining: Math.max(0, limit - used),
      retryAfterSec: 0,
      limit,
      windowMs,
    };
  }

  const oldest = bucket.hits[0]!;
  const retryAfterMs = Math.max(0, oldest + windowMs - now);
  return {
    ok: false,
    remaining: 0,
    retryAfterSec: Math.ceil(retryAfterMs / 1000),
    limit,
    windowMs,
  };
}

/** Reset a key (used by tests / manual admin actions). */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/** Best-effort client IP extraction from Next.js request headers. */
export function getClientIp(req: NextRequest | Request): string {
  const headers = "headers" in req ? req.headers : new Headers();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // First entry is the original client; the rest are upstream proxies.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "unknown";
}

/**
 * Build a 429 Response with a Hebrew message and the standard
 * `Retry-After` header. Reused by every route so the shape stays consistent.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  message = "יותר מדי ניסיונות. נסו שוב בעוד רגע."
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      retryAfterSec: result.retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, result.retryAfterSec)),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/**
 * Enforce a limit in one call: on exceed returns a `NextResponse` the caller
 * must return immediately. On success returns `null`.
 */
export function enforceRateLimit(
  input: RateLimitInput,
  message?: string
): NextResponse | null {
  const res = checkRateLimit(input);
  if (res.ok) return null;
  return rateLimitResponse(res, message);
}

/** Log a failed auth attempt — cheap security signal until we wire a real SIEM. */
export function logFailedLogin(details: {
  bucket: string;
  ip: string;
  identifier?: string;
  reason: string;
}): void {
  const identifier = details.identifier
    ? details.identifier.replace(/[\r\n]/g, " ").slice(0, 120)
    : undefined;
  console.warn(
    `[security] failed-login bucket=${details.bucket} ip=${details.ip}` +
      (identifier ? ` id=${identifier}` : "") +
      ` reason=${details.reason}`
  );
}
