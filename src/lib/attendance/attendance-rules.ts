/**
 * Pure attendance decision helpers — unit-testable without DB/GPS.
 */

export const ATTENDANCE_DEBOUNCE_MS = 45_000;

export type DebounceDecision =
  | { block: false }
  | {
      block: true;
      action: "check_in" | "check_out";
      at: Date;
    };

/**
 * Debounce duplicate scans of the *same* action only.
 * - Open attendance → next scan is check-out; do NOT block because check-in was recent.
 * - No open attendance → next scan is check-in; block if a recent in/out happened.
 */
export function decideDebounce(opts: {
  openExists: boolean;
  /** Most recent checkout for this user (if any within window) */
  recentCheckOutAt: Date | null;
  /** Most recent check-in for this user (if any within window) */
  recentCheckInAt: Date | null;
  now?: number;
  debounceMs?: number;
}): DebounceDecision {
  const now = opts.now ?? Date.now();
  const windowMs = opts.debounceMs ?? ATTENDANCE_DEBOUNCE_MS;
  const since = now - windowMs;

  if (opts.openExists) {
    if (
      opts.recentCheckOutAt &&
      opts.recentCheckOutAt.getTime() >= since
    ) {
      return {
        block: true,
        action: "check_out",
        at: opts.recentCheckOutAt,
      };
    }
    return { block: false };
  }

  const recentOut =
    opts.recentCheckOutAt && opts.recentCheckOutAt.getTime() >= since
      ? opts.recentCheckOutAt
      : null;
  const recentIn =
    opts.recentCheckInAt && opts.recentCheckInAt.getTime() >= since
      ? opts.recentCheckInAt
      : null;

  if (recentOut && (!recentIn || recentOut.getTime() >= recentIn.getTime())) {
    return { block: true, action: "check_out", at: recentOut };
  }
  if (recentIn) {
    return { block: true, action: "check_in", at: recentIn };
  }
  return { block: false };
}

export function isTrustedDevice(d: {
  approved: boolean;
  enrolledAt: Date | null;
}): boolean {
  return Boolean(d.approved && d.enrolledAt);
}

export function needsEnrollmentForDevice(opts: {
  device: { userId: string | null; approved: boolean; enrolledAt: Date | null } | null;
  userId: string;
}): boolean {
  if (!opts.device) return true;
  if (opts.device.userId !== opts.userId) return true;
  return !isTrustedDevice(opts.device);
}
