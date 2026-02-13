/**
 * Date Engine Calculator - Core calculation functions
 *
 * CRITICAL: This is the heart of the application. All date calculations for
 * handling dates across lots and rounds happen here.
 *
 * Uses date-fns exclusively to prevent date arithmetic pitfalls.
 */

import { Lot } from '@/domain/value-objects/Lot';
import { HandlingDate } from '@/domain/value-objects/HandlingDate';
import { DEFAULT_ROUNDS } from '@/domain/constants';
import { addDaysToDateOnly } from './utils';

/**
 * Calculate all handling dates for a single lot across all rounds
 *
 * @param lot - The lot to calculate dates for
 * @param rounds - Number of rounds (default 4: Rodada 1, Rodada 2, Rodada 3, Rodada 4)
 * @returns Array of HandlingDate objects
 *
 * Example:
 * - Lot: Primíparas, D0: Jan 1, 2026, Protocol: [0, 7, 9]
 * - Round interval: 22 days
 * - Results:
 *   - Rodada 1 D0: Jan 1, 2026
 *   - Rodada 1 D7: Jan 8, 2026
 *   - Rodada 1 D9: Jan 10, 2026
 *   - Rodada 2 D0: Jan 23, 2026 (Jan 1 + 22 days)
 *   - Rodada 2 D7: Jan 30, 2026
 *   - Rodada 2 D9: Feb 1, 2026
 *   - ... (Rodada 3 and Rodada 4)
 */
export function calculateHandlingDates(
  lot: Lot,
  rounds: number = DEFAULT_ROUNDS
): HandlingDate[] {
  const handlingDates: HandlingDate[] = [];

  // Get all intervals for this lot (includes round offset + protocol day)
  const intervals = lot.getIntervals(rounds);

  for (const interval of intervals) {
    // Calculate the actual date by adding dayOffset to D0
    const date = addDaysToDateOnly(lot.d0, interval.dayOffset);

    // Create HandlingDate
    const handlingDate = HandlingDate.create(
      lot.id,
      lot.name,
      interval.roundId,
      interval.roundName,
      interval.protocolDay,
      date
    );

    handlingDates.push(handlingDate);
  }

  return handlingDates;
}

/**
 * Calculate all handling dates for multiple lots
 *
 * @param lots - Array of lots
 * @param rounds - Number of rounds (default 4)
 * @returns Flat array of all handling dates for all lots
 */
export function calculateAllHandlingDates(
  lots: Lot[],
  rounds: number = DEFAULT_ROUNDS
): HandlingDate[] {
  const allDates: HandlingDate[] = [];

  for (const lot of lots) {
    const lotDates = calculateHandlingDates(lot, rounds);
    allDates.push(...lotDates);
  }

  return allDates;
}

/**
 * Group handling dates by date (for overlap detection)
 *
 * @param handlingDates - Array of handling dates
 * @returns Map of date string -> array of handling dates on that date
 */
export function groupHandlingDatesByDate(
  handlingDates: HandlingDate[]
): Map<string, HandlingDate[]> {
  const grouped = new Map<string, HandlingDate[]>();

  for (const hd of handlingDates) {
    const dateKey = hd.date.toISOString();
    const existing = grouped.get(dateKey);

    if (existing) {
      existing.push(hd);
    } else {
      grouped.set(dateKey, [hd]);
    }
  }

  return grouped;
}

