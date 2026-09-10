/**
 * Schedule non-critical work after the HTTP response is sent.
 * Falls back to fire-and-forget outside a Next.js request (scripts/bench).
 */
export type ScheduleBackground = (task: () => Promise<void>) => void;

export function scheduleBackgroundOrAwait(
  schedule: ScheduleBackground | undefined,
  task: () => Promise<void>
): Promise<void> {
  if (schedule) {
    schedule(task);
    return Promise.resolve();
  }
  return task();
}

/** Never swallow workflow side-effect failures silently. */
export function logBackgroundError(label: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[workflow-bg] ${label}: ${message}`, stack ? { stack } : err);
}

/** Route helper: wrap Next.js `after` so rejected background tasks are logged. */
export function createAfterScheduler(
  afterFn: (task: Promise<unknown> | (() => Promise<unknown>)) => void,
  context?: string
): ScheduleBackground {
  return (task) => {
    afterFn(async () => {
      try {
        await task();
      } catch (err) {
        logBackgroundError(context ?? "schedule-background", err);
      }
    });
  };
}
