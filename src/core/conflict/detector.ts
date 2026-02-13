/**
 * Conflict Detector
 *
 * Detects two types of conflicts:
 * 1. Sunday conflicts - Handling dates that fall on Sunday (farm typically closed)
 * 2. Overlap conflicts - Multiple lots scheduled on the same date
 *
 * Performance: O(n) for both Sunday and overlap detection using Map
 */

import { HandlingDate } from '@/domain/value-objects/HandlingDate';
import { Conflict } from '@/domain/value-objects/Conflict';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { isSunday } from '@/core/date-engine/utils';
import { groupHandlingDatesByDate } from '@/core/date-engine/calculator';

/**
 * Detect all conflicts in a set of handling dates
 *
 * @param handlingDates - Array of handling dates to check
 * @returns Array of conflicts found
 */
export function detectConflicts(handlingDates: HandlingDate[]): Conflict[] {
  const conflicts: Conflict[] = [];

  // Detect Sunday conflicts (CONF-01)
  const sundayConflicts = detectSundayConflicts(handlingDates);
  conflicts.push(...sundayConflicts);

  // Detect overlap conflicts (CONF-02)
  const overlapConflicts = detectOverlapConflicts(handlingDates);
  conflicts.push(...overlapConflicts);

  return conflicts;
}

/**
 * Detect Sunday conflicts (internal)
 */
function detectSundayConflicts(handlingDates: HandlingDate[]): Conflict[] {
  const sundayConflicts: Conflict[] = [];

  for (const hd of handlingDates) {
    if (isSunday(hd.date)) {
      sundayConflicts.push(Conflict.sunday(hd));
    }
  }

  return sundayConflicts;
}

/**
 * Detect overlap conflicts (internal)
 */
function detectOverlapConflicts(handlingDates: HandlingDate[]): Conflict[] {
  const overlapConflicts: Conflict[] = [];

  const grouped = groupHandlingDatesByDate(handlingDates);

  for (const [dateKey, datesOnSameDay] of grouped.entries()) {
    const uniqueLotIds = new Set(datesOnSameDay.map((hd) => hd.lotId));

    if (uniqueLotIds.size > 1) {
      const date = DateOnly.fromISOString(dateKey);
      overlapConflicts.push(Conflict.overlap(date, datesOnSameDay));
    }
  }

  return overlapConflicts;
}

/**
 * Get conflict type for a date cell (for table rendering)
 *
 * @param date - Date to check
 * @param lotId - Lot ID
 * @param allHandlingDates - All handling dates
 * @returns 'sunday', 'overlap', 'multiple', or null
 */
export function getConflictTypeForCell(
  date: DateOnly,
  lotId: string,
  allHandlingDates: HandlingDate[]
): 'sunday' | 'overlap' | 'multiple' | null {
  const handlingDate = allHandlingDates.find(
    (hd) => hd.date.equals(date) && hd.lotId === lotId
  );

  if (!handlingDate) return null;

  const isSundayConflict = isSunday(date);

  const sameDate = allHandlingDates.filter((hd) => hd.date.equals(date));
  const uniqueLotIds = new Set(sameDate.map((hd) => hd.lotId));
  const isOverlapConflict = uniqueLotIds.size > 1;

  if (isSundayConflict && isOverlapConflict) return 'multiple';
  if (isSundayConflict) return 'sunday';
  if (isOverlapConflict) return 'overlap';

  return null;
}
