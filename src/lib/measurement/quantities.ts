export type MeasurementQuantityInput = {
  contractQuantity: number;
  previousApprovedQuantity?: number;
  currentQuantity?: number;
};

export type MeasurementQuantityResult = {
  contractQuantity: number;
  previousApprovedQuantity: number;
  currentQuantity: number;
  cumulativeQuantity: number;
  remainingQuantity: number;
  overrunQuantity: number;
  isComplete: boolean;
  isOverrun: boolean;
};

function finite(value: number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * SSOT for measurement progress.
 * Remaining is deliberately signed: contract - (previous approved + current).
 * Contract overrun is valid business data and must never be clamped.
 */
export function calculateMeasurementQuantity(
  input: MeasurementQuantityInput
): MeasurementQuantityResult {
  const contractQuantity = finite(input.contractQuantity);
  const previousApprovedQuantity = finite(input.previousApprovedQuantity);
  const currentQuantity = finite(input.currentQuantity);
  const cumulativeQuantity = previousApprovedQuantity + currentQuantity;
  const remainingQuantity = contractQuantity - cumulativeQuantity;

  return {
    contractQuantity,
    previousApprovedQuantity,
    currentQuantity,
    cumulativeQuantity,
    remainingQuantity,
    overrunQuantity: Math.max(0, -remainingQuantity),
    isComplete: remainingQuantity === 0,
    isOverrun: remainingQuantity < 0,
  };
}

export function hasMeasurementData(values: Iterable<number>): boolean {
  for (const value of values) {
    if (finite(value) !== 0) return true;
  }
  return false;
}
