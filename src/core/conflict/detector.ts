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
import { Holiday } from '@/domain/value-objects/Holiday';
import { isSunday } from '@/core/date-engine/utils';
import { groupHandlingDatesByDate } from '@/core/date-engine/calculator';

/**
 * Detect all conflicts in a set of handling dates
 *
 * @param handlingDates - Array of handling dates to check
 * @returns Array of conflicts found
 */
export function detectConflicts(
  handlingDates: HandlingDate[],
  holidays: readonly Holiday[] = []
): Conflict[] {
  const conflicts: Conflict[] = [];
  conflicts.push(...detectSundayConflicts(handlingDates));
  conflicts.push(...detectOverlapConflicts(handlingDates));
  conflicts.push(...detectHolidayConflicts(handlingDates, holidays));
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
 * Detect holiday conflicts — one per handling date that falls on a holiday.
 */
export function detectHolidayConflicts(
  handlingDates: readonly HandlingDate[],
  holidays: readonly Holiday[]
): Conflict[] {
  if (holidays.length === 0) return [];
  return handlingDates
    .filter((hd) => holidays.some((h) => h.date.equals(hd.date)))
    .map((hd) => Conflict.holiday(hd));
}

/** All possible conflict type values for a single cell */
export type CellConflictType =
  | 'sunday' | 'overlap' | 'holiday'
  | 'sunday-overlap' | 'sunday-holiday' | 'overlap-holiday'
  | 'sunday-overlap-holiday';

/**
 * Get conflict type for a date cell (for table rendering).
 *
 * Returns a combined type when multiple conflicts coincide,
 * so the UI can render split-color cells.
 *
 * @returns CellConflictType or null if no conflict
 */
export function getConflictTypeForCell(
  date: DateOnly,
  lotId: string,
  allHandlingDates: HandlingDate[],
  holidays: readonly Holiday[] = []
): CellConflictType | null {
  const handlingDate = allHandlingDates.find(
    (hd) => hd.date.equals(date) && hd.lotId === lotId
  );

  if (!handlingDate) return null;

  const isSundayConflict = isSunday(date);

  const sameDate = allHandlingDates.filter((hd) => hd.date.equals(date));
  const uniqueLotIds = new Set(sameDate.map((hd) => hd.lotId));
  const isOverlapConflict = uniqueLotIds.size > 1;

  const isHolidayConflict = holidays.some((h) => h.date.equals(date));

  const count = +isSundayConflict + +isOverlapConflict + +isHolidayConflict;
  if (count === 0) return null;

  // Triple
  if (isSundayConflict && isOverlapConflict && isHolidayConflict) return 'sunday-overlap-holiday';

  // Double
  if (isSundayConflict && isOverlapConflict) return 'sunday-overlap';
  if (isSundayConflict && isHolidayConflict) return 'sunday-holiday';
  if (isOverlapConflict && isHolidayConflict) return 'overlap-holiday';

  // Single
  if (isSundayConflict) return 'sunday';
  if (isOverlapConflict) return 'overlap';
  return 'holiday';
}
