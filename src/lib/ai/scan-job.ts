export const SCAN_STATUS = {
  UPLOADED: "uploaded",
  QUEUED: "queued",
  PROCESSING: "processing",
  VALIDATING: "validating",
  COMPLETED: "completed",
  FAILED: "failed",
  TIMED_OUT: "timed_out",
  CONFIRMED: "confirmed",
} as const;

export type ScanStatus = (typeof SCAN_STATUS)[keyof typeof SCAN_STATUS];

export const SCAN_TIMEOUT = {
  geminiMs: 180_000,
  staleLockMs: 4 * 60_000,
  jobTtlMs: 12 * 60_000,
  uiPollMs: 1_500,
  uiStillRunningMs: 4 * 60_000,
  maxAttempts: 3,
} as const;

const LEGACY_STATUS: Record<string, ScanStatus> = {
  success: SCAN_STATUS.COMPLETED,
  running: SCAN_STATUS.PROCESSING,
  processing: SCAN_STATUS.PROCESSING,
};

export function normalizeScanStatus(status: string | null | undefined): ScanStatus | string {
  if (!status) return SCAN_STATUS.QUEUED;
  return LEGACY_STATUS[status] ?? status;
}

export function isTerminalScanStatus(status: string): boolean {
  const normalized = normalizeScanStatus(status);
  return (
    normalized === SCAN_STATUS.COMPLETED ||
    normalized === SCAN_STATUS.FAILED ||
    normalized === SCAN_STATUS.TIMED_OUT ||
    normalized === SCAN_STATUS.CONFIRMED
  );
}

export function isActiveScanStatus(status: string): boolean {
  const normalized = normalizeScanStatus(status);
  return (
    normalized === SCAN_STATUS.UPLOADED ||
    normalized === SCAN_STATUS.QUEUED ||
    normalized === SCAN_STATUS.PROCESSING ||
    normalized === SCAN_STATUS.VALIDATING
  );
}

export const SCAN_STEP_LABELS: { id: ScanStatus; label: string }[] = [
  { id: SCAN_STATUS.UPLOADED, label: "הקובץ הועלה" },
  { id: SCAN_STATUS.QUEUED, label: "ממתין לסריקה" },
  { id: SCAN_STATUS.PROCESSING, label: "AI מעבד את המסמך" },
  { id: SCAN_STATUS.VALIDATING, label: "בודק את כתב הכמויות" },
  { id: SCAN_STATUS.COMPLETED, label: "הסריקה הושלמה" },
];

export function scanStepIndex(status: string): number {
  const normalized = normalizeScanStatus(status);
  if (normalized === SCAN_STATUS.CONFIRMED) return SCAN_STEP_LABELS.length - 1;
  const index = SCAN_STEP_LABELS.findIndex((step) => step.id === normalized);
  if (index >= 0) return index;
  if (normalized === SCAN_STATUS.FAILED || normalized === SCAN_STATUS.TIMED_OUT) {
    return SCAN_STEP_LABELS.length - 2;
  }
  return 0;
}

export function backoffMs(attempt: number): number {
  const exp = Math.min(Math.max(attempt, 1), 4);
  return 2 ** exp * 1000;
}

export function jobTimeoutAt(from = new Date()): Date {
  return new Date(from.getTime() + SCAN_TIMEOUT.jobTtlMs);
}

export function isStaleLock(heartbeatAt: Date | null | undefined, now = Date.now()): boolean {
  if (!heartbeatAt) return true;
  return now - heartbeatAt.getTime() > SCAN_TIMEOUT.staleLockMs;
}
