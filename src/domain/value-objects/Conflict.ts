import { HandlingDate } from './HandlingDate';
import { DateOnly } from './DateOnly';

/**
 * Conflict types
 */
export type ConflictType = 'sunday' | 'overlap';

/**
 * Conflict - Represents a scheduling conflict
 *
 * Two types of conflicts:
 * - Sunday: Handling date falls on Sunday (farm typically closed)
 * - Overlap: Multiple lots scheduled on the same date
 */
export class Conflict {
  constructor(
    public readonly type: ConflictType,
    public readonly date: DateOnly,
    public readonly handlingDates: readonly HandlingDate[]
  ) {
    if (handlingDates.length === 0) {
      throw new Error('Conflict must have at least one handling date');
    }
  }

  /**
   * Create a Sunday conflict
   */
  static sunday(handlingDate: HandlingDate): Conflict {
    return new Conflict('sunday', handlingDate.date, [handlingDate]);
  }

  /**
   * Create an overlap conflict
   */
  static overlap(date: DateOnly, handlingDates: HandlingDate[]): Conflict {
    if (handlingDates.length < 2) {
      throw new Error('Overlap conflict must have at least 2 handling dates');
    }
    return new Conflict('overlap', date, handlingDates);
  }

  /**
   * Check equality
   */
  equals(other: Conflict): boolean {
    return (
      this.type === other.type &&
      this.date.equals(other.date) &&
      this.handlingDates.length === other.handlingDates.length &&
      this.handlingDates.every((hd, idx) => hd.equals(other.handlingDates[idx]!))
    );
  }
}
