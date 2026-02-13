/**
 * useConflicts Hook
 *
 * Provides debounced access to conflict detection.
 * Prevents excessive recalculation on rapid lot changes.
 */

import { conflictSummarySignal } from '@/state/signals/conflicts';

/**
 * Hook to access conflict summary only
 */
export function useConflictSummary() {
  return conflictSummarySignal.value;
}
