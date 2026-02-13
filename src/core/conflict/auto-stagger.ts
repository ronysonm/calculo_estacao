/**
 * Auto-Stagger
 *
 * Automatically spaces D0s with configurable gaps to prevent overlaps.
 * Respects locked lots (lots that should not be moved).
 */

import { Lot } from '@/domain/value-objects/Lot';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { addDaysToDateOnly } from '@/core/date-engine/utils';

export interface StaggerPreview {
  lot: Lot;
  oldD0: DateOnly;
  newD0: DateOnly;
  changed: boolean;
}

/**
 * Auto-stagger lots with specified spacing
 * Locked lots remain unchanged, unlocked lots are spaced around them
 *
 * @param lots - Array of lots to stagger
 * @param lockedLotIds - Set of lot IDs that should not be moved
 * @param spacingDays - Number of days between D0s (default 1)
 * @returns New array of lots with adjusted D0s
 */
export function autoStagger(
  lots: Lot[],
  lockedLotIds: Set<string>,
  spacingDays: number = 1
): Lot[] {
  if (lots.length === 0) return [];
  if (lots.length === 1) return lots;

  // Sort lots by current D0 (locked lots maintain their position)
  const sortedLots = [...lots].sort((a, b) => a.d0.compareTo(b.d0));

  // Find the earliest D0 among locked lots, or use first lot's D0
  let currentD0: DateOnly;
  const lockedLots = sortedLots.filter((lot) => lockedLotIds.has(lot.id));

  if (lockedLots.length > 0) {
    // Start from earliest locked lot
    currentD0 = lockedLots[0]!.d0;
  } else {
    // No locked lots, start from first lot
    currentD0 = sortedLots[0]!.d0;
  }

  const newLots: Lot[] = [];

  for (const lot of sortedLots) {
    if (lockedLotIds.has(lot.id)) {
      // Locked lot - keep its D0
      newLots.push(lot);
      // Update currentD0 to this locked lot's D0 + spacing
      currentD0 = addDaysToDateOnly(lot.d0, spacingDays);
    } else {
      // Unlocked lot - assign new D0 with spacing
      const newLot = lot.withD0(currentD0);
      newLots.push(newLot);
      // Move to next position
      currentD0 = addDaysToDateOnly(currentD0, spacingDays);
    }
  }

  return newLots;
}

/**
 * Preview auto-stagger changes
 * Shows what would change without actually applying
 *
 * @param lots - Array of lots
 * @param lockedLotIds - Set of locked lot IDs
 * @param spacingDays - Spacing between D0s
 * @returns Array of preview objects showing old D0 → new D0
 */
export function previewAutoStagger(
  lots: Lot[],
  lockedLotIds: Set<string>,
  spacingDays: number = 1
): StaggerPreview[] {
  const newLots = autoStagger(lots, lockedLotIds, spacingDays);

  return lots.map((oldLot) => {
    const newLot = newLots.find((l) => l.id === oldLot.id)!;
    return {
      lot: oldLot,
      oldD0: oldLot.d0,
      newD0: newLot.d0,
      changed: !oldLot.d0.equals(newLot.d0),
    };
  });
}

/**
 * Calculate optimal spacing to avoid overlaps
 * Returns minimum spacing needed based on protocol length
 *
 * @param lots - Array of lots
 * @returns Recommended spacing in days
 */
export function calculateOptimalSpacing(lots: Lot[]): number {
  if (lots.length === 0) return 1;

  // Find the maximum protocol span
  let maxSpan = 0;
  for (const lot of lots) {
    const lastInterval = lot.protocol.intervals[lot.protocol.intervals.length - 1] || 0;
    if (lastInterval > maxSpan) {
      maxSpan = lastInterval;
    }
  }

  // Optimal spacing is slightly more than max protocol span
  // to ensure no overlaps even in the same round
  return Math.ceil(maxSpan / 2) + 1;
}
