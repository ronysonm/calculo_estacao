import { addDays } from 'date-fns';
import type { Protocol } from '@/domain/models/Protocol';
import type { Lot } from '@/domain/models/Lot';

/**
 * Represents a single manejo date with its protocol day number,
 * calculated date, and round label.
 */
export interface ManejoDate {
  readonly day: number;
  readonly date: Date;
  readonly roundLabel: string;
}

/**
 * Calculates a single manejo date from D0 + day offset + round offset.
 *
 * Formula: addDays(d0, (roundIndex * roundInterval) + dayOffset)
 *
 * This is the atomic building block for all date calculations. Uses ONLY
 * date-fns addDays to ensure correct handling of month boundaries, year
 * crossings, and leap years. NEVER use manual date arithmetic.
 *
 * @param d0 - The D0 (start date) for the lot
 * @param dayOffset - The protocol day offset (0, 7, 9, etc.)
 * @param roundIndex - Zero-based round index (0 = first round, 1 = second, etc.)
 * @param roundInterval - Days between rounds (typically 22)
 * @returns The calculated date
 */
export const calculateManejoDate = (
  d0: Date,
  dayOffset: number,
  roundIndex: number,
  roundInterval: number
): Date => {
  return addDays(d0, roundIndex * roundInterval + dayOffset);
};

/**
 * Calculates all manejo dates for a protocol across all rounds.
 *
 * Returns array ordered by round (A1, A2, ...) then by day within round.
 * Each ManejoDate contains the protocol day number, calculated date,
 * and round label.
 *
 * @param d0 - The D0 (start date) for the lot
 * @param protocol - Protocol defining the 3 manejo days
 * @param roundCount - Number of rounds (1-6)
 * @param roundInterval - Days between rounds
 * @returns Array of ManejoDate objects (length = 3 * roundCount)
 */
export const calculateProtocolDates = (
  d0: Date,
  protocol: Protocol,
  roundCount: number,
  roundInterval: number
): ManejoDate[] => {
  const results: ManejoDate[] = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    const roundLabel = `A${roundIndex + 1}`;

    for (const dayValue of protocol.days) {
      results.push({
        day: dayValue,
        date: calculateManejoDate(d0, dayValue, roundIndex, roundInterval),
        roundLabel
      });
    }
  }

  return results;
};

/**
 * Calculates the complete schedule for a lot (all rounds, all manejos).
 *
 * Convenience wrapper that uses the lot's D0 and per-lot round interval.
 *
 * @param lot - Lot containing D0 and roundInterval
 * @param protocol - Protocol defining the 3 manejo days
 * @param roundCount - Number of rounds (1-6)
 * @returns Array of ManejoDate objects (length = 3 * roundCount)
 */
export const calculateLotSchedule = (
  lot: Lot,
  protocol: Protocol,
  roundCount: number
): ManejoDate[] => {
  return calculateProtocolDates(lot.d0, protocol, roundCount, lot.roundInterval);
};
