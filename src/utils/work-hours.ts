/** Parse "HH:mm" → minutes from midnight, or null if invalid. */
export function parseTimeToMinutes(value?: string | null): number | null {
  if (!value?.trim()) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Compute worked hours from start/end "HH:mm". Supports overnight (end < start). */
export function computeTotalHours(
  startTime?: string | null,
  endTime?: string | null
): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return 0;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}
