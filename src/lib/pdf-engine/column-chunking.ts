/**
 * Split wide measurement BOQ columns into readable chunks for A4 print.
 * Never shrink fonts — prefer multiple tables stacked vertically.
 */

/** A4 landscape usable width after 8mm margins (approx mm) */
const A4_LANDSCAPE_CONTENT_MM = 297 - 16;

/** Fixed columns that repeat on every chunk */
const ROOM_COL_MM = 32;
const TOTAL_COL_MM = 20;

/** Minimum readable width per BOQ section column at ~10px font */
const SECTION_COL_MM = 26;

/** Hard floor so tiny screens / margins still produce chunks */
const MIN_SECTIONS_PER_CHUNK = 3;
const MAX_SECTIONS_PER_CHUNK = 10;

export function maxSectionsPerMeasurementChunk(
  availableWidthMm: number = A4_LANDSCAPE_CONTENT_MM
): number {
  const forSections = availableWidthMm - ROOM_COL_MM - TOTAL_COL_MM;
  const fitted = Math.floor(forSections / SECTION_COL_MM);
  return Math.max(
    MIN_SECTIONS_PER_CHUNK,
    Math.min(MAX_SECTIONS_PER_CHUNK, fitted)
  );
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  if (items.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
