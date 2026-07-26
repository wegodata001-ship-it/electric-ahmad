/**
 * Efficient bulk selection for large lists (Set-based, O(1) toggle/has).
 * Supports select-all on the current page without cloning arrays.
 */

export type BulkSelectionState = {
  selected: Set<string>;
  /** When true, all ids matching the current filter are selected (including unloaded). */
  allMatching: boolean;
};

export function createBulkSelection(): BulkSelectionState {
  return { selected: new Set(), allMatching: false };
}

export function toggleId(
  state: BulkSelectionState,
  id: string
): BulkSelectionState {
  const selected = new Set(state.selected);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  return { selected, allMatching: false };
}

export function selectPage(
  state: BulkSelectionState,
  ids: string[],
  selected: boolean
): BulkSelectionState {
  const next = new Set(state.selected);
  for (const id of ids) {
    if (selected) next.add(id);
    else next.delete(id);
  }
  return { selected: next, allMatching: false };
}

export function selectAllMatching(state: BulkSelectionState): BulkSelectionState {
  return { selected: new Set(state.selected), allMatching: true };
}

export function clearBulkSelection(): BulkSelectionState {
  return createBulkSelection();
}

export function isSelected(state: BulkSelectionState, id: string): boolean {
  return state.allMatching || state.selected.has(id);
}

export function selectedCount(
  state: BulkSelectionState,
  totalMatching: number
): number {
  return state.allMatching ? totalMatching : state.selected.size;
}
