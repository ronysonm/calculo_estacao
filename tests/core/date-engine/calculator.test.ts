/**
 * Date Engine Tests - Critical edge cases
 *
 * Tests all the date pitfalls that can break the application:
 * - Pitfall #1: Month off-by-one errors
 * - Pitfall #2: Timezone interpretation bugs
 * - Pitfall #3: Month overflow creating bizarre dates
 *
 * Plus standard functionality tests.
 *
 * NOTE: roundGaps represents the gap between the LAST protocol day
 * of round N and D0 of round N+1. With protocol [0,7,9] and gap=22:
 *   R2 D0 = R1 D0 + 9 + 22 = R1 D0 + 31
 */

import { describe, it, expect } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Protocol } from '../../../src/domain/value-objects/Protocol';
import { Lot } from '../../../src/domain/value-objects/Lot';
import {
  calculateHandlingDates,
  calculateAllHandlingDates,
  groupHandlingDatesByDate,
} from '../../../src/core/date-engine/calculator';
import { addDaysToDateOnly, isSunday } from '../../../src/core/date-engine/utils';

describe('DateOnly - Pitfall Prevention', () => {
  it('should prevent month off-by-one errors (Pitfall #1)', () => {
    // Month 2 should be February, NOT March
    const date = DateOnly.create(2026, 2, 1);
    expect(date.month).toBe(2);

    // When converted to Date, should be February
    const jsDate = date.toDate();
    expect(jsDate.getMonth()).toBe(1); // JavaScript uses 0-11
    expect(jsDate.getFullYear()).toBe(2026);
    expect(jsDate.getDate()).toBe(1);
  });

  it('should prevent timezone bugs (Pitfall #2)', () => {
    // Same date should be identical regardless of timezone
    const date1 = DateOnly.create(2026, 1, 15);
    const date2 = DateOnly.create(2026, 1, 15);

    expect(date1.equals(date2)).toBe(true);
    expect(date1.year).toBe(2026);
    expect(date1.month).toBe(1);
    expect(date1.day).toBe(15);
  });

  it('should prevent month overflow bugs (Pitfall #3)', () => {
    // Jan 31 + 1 day should be Feb 1, NOT March 3
    const jan31 = DateOnly.create(2026, 1, 31);
    const feb1 = addDaysToDateOnly(jan31, 1);

    expect(feb1.year).toBe(2026);
    expect(feb1.month).toBe(2); // February
    expect(feb1.day).toBe(1);
  });
});

describe('Date Arithmetic - Month Boundaries', () => {
  it('should handle Jan 31 + 1 day = Feb 1', () => {
    const jan31 = DateOnly.create(2026, 1, 31);
    const feb1 = addDaysToDateOnly(jan31, 1);

    expect(feb1.month).toBe(2);
    expect(feb1.day).toBe(1);
  });

  it('should handle Dec 31 + 1 day = Jan 1 (next year)', () => {
    const dec31 = DateOnly.create(2026, 12, 31);
    const jan1 = addDaysToDateOnly(dec31, 1);

    expect(jan1.year).toBe(2027);
    expect(jan1.month).toBe(1);
    expect(jan1.day).toBe(1);
  });

  it('should handle leap year: Feb 28, 2028 + 1 day = Feb 29', () => {
    const feb28 = DateOnly.create(2028, 2, 28);
    const feb29 = addDaysToDateOnly(feb28, 1);

    expect(feb29.year).toBe(2028);
    expect(feb29.month).toBe(2);
    expect(feb29.day).toBe(29);
  });

  it('should handle non-leap year: Feb 28, 2026 + 1 day = Mar 1', () => {
    const feb28 = DateOnly.create(2026, 2, 28);
    const mar1 = addDaysToDateOnly(feb28, 1);

    expect(mar1.year).toBe(2026);
    expect(mar1.month).toBe(3);
    expect(mar1.day).toBe(1);
  });

  it('should handle 30-day months: Apr 30 + 1 day = May 1', () => {
    const apr30 = DateOnly.create(2026, 4, 30);
    const may1 = addDaysToDateOnly(apr30, 1);

    expect(may1.month).toBe(5);
    expect(may1.day).toBe(1);
  });
});

describe('Sunday Detection', () => {
  it('should detect Sunday correctly (Jan 4, 2026 is Sunday)', () => {
    const sunday = DateOnly.create(2026, 1, 4);
    expect(isSunday(sunday)).toBe(true);
  });

  it('should return false for non-Sunday (Jan 5, 2026 is Monday)', () => {
    const monday = DateOnly.create(2026, 1, 5);
    expect(isSunday(monday)).toBe(false);
  });

  it('should detect Sunday at year boundary (Jan 3, 2027 is Sunday)', () => {
    const sunday = DateOnly.create(2027, 1, 3);
    expect(isSunday(sunday)).toBe(true);
  });
});

describe('calculateHandlingDates - Core Functionality', () => {
  it('should calculate dates for single lot, single round, simple protocol', () => {
    const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Primíparas', d0, protocol, [22, 22, 22]);

    const dates = calculateHandlingDates(lot, 1);

    expect(dates).toHaveLength(3); // D0, D7, D9

    // Rodada 1 D0 = Jan 1
    expect(dates[0]!.date.equals(DateOnly.create(2026, 1, 1))).toBe(true);
    expect(dates[0]!.protocolDay).toBe(0);
    expect(dates[0]!.roundName).toBe('Rodada 1');

    // Rodada 1 D7 = Jan 8
    expect(dates[1]!.date.equals(DateOnly.create(2026, 1, 8))).toBe(true);
    expect(dates[1]!.protocolDay).toBe(7);

    // Rodada 1 D9 = Jan 10
    expect(dates[2]!.date.equals(DateOnly.create(2026, 1, 10))).toBe(true);
    expect(dates[2]!.protocolDay).toBe(9);
  });

  it('should calculate dates for 4 rounds with gap-based intervals', () => {
    const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Primíparas', d0, protocol, [22, 22, 22]);

    const dates = calculateHandlingDates(lot, 4);

    expect(dates).toHaveLength(12); // 4 rounds × 3 dates

    // Rodada 1 D0 = Jan 1
    expect(dates[0]!.date.equals(DateOnly.create(2026, 1, 1))).toBe(true);
    expect(dates[0]!.roundName).toBe('Rodada 1');

    // Rodada 2 D0 = Jan 1 + 9 + 22 = Jan 1 + 31 = Feb 1
    expect(dates[3]!.date.equals(DateOnly.create(2026, 2, 1))).toBe(true);
    expect(dates[3]!.roundName).toBe('Rodada 2');
    expect(dates[3]!.protocolDay).toBe(0);

    // Rodada 3 D0 = Feb 1 + 9 + 22 = Feb 1 + 31 = Mar 4
    expect(dates[6]!.date.equals(DateOnly.create(2026, 3, 4))).toBe(true);
    expect(dates[6]!.roundName).toBe('Rodada 3');

    // Rodada 4 D0 = Mar 4 + 9 + 22 = Mar 4 + 31 = Apr 4
    expect(dates[9]!.date.equals(DateOnly.create(2026, 4, 4))).toBe(true);
    expect(dates[9]!.roundName).toBe('Rodada 4');
  });

  it('should handle month boundaries across rounds', () => {
    const protocol = Protocol.create('p1', 'D0-D8-D10', [0, 8, 10], 'D0-D8-D10');
    const d0 = DateOnly.create(2026, 1, 25); // Late January
    const lot = Lot.create('lot1', 'Test', d0, protocol, [22, 22, 22]);

    const dates = calculateHandlingDates(lot, 2);

    // Rodada 1 D10 = Jan 25 + 10 = Feb 4
    expect(dates[2]!.date.equals(DateOnly.create(2026, 2, 4))).toBe(true);

    // Rodada 2 D0 = Jan 25 + 10 + 22 = Jan 25 + 32 = Feb 26
    expect(dates[3]!.date.equals(DateOnly.create(2026, 2, 26))).toBe(true);

    // Rodada 2 D10 = Feb 26 + 10 = Mar 8
    expect(dates[5]!.date.equals(DateOnly.create(2026, 3, 8))).toBe(true);
  });

  it('should handle year boundaries', () => {
    const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
    const d0 = DateOnly.create(2026, 12, 20); // Late December
    const lot = Lot.create('lot1', 'Test', d0, protocol, [22, 22, 22]);

    const dates = calculateHandlingDates(lot, 2);

    // Rodada 1 D9 = Dec 20 + 9 = Dec 29
    expect(dates[2]!.date.equals(DateOnly.create(2026, 12, 29))).toBe(true);

    // Rodada 2 D0 = Dec 20 + 9 + 22 = Dec 20 + 31 = Jan 20, 2027
    expect(dates[3]!.date.equals(DateOnly.create(2027, 1, 20))).toBe(true);

    // Rodada 2 D9 = Jan 20 + 9 = Jan 29, 2027
    expect(dates[5]!.date.equals(DateOnly.create(2027, 1, 29))).toBe(true);
  });

  it('should match Excel model dates (Feb 2, 2026, gaps [22, 21, 22])', () => {
    const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
    const d0 = DateOnly.create(2026, 2, 2); // Monday Feb 2
    const lot = Lot.create('lot1', 'Lote 1', d0, protocol, [22, 21, 22]);

    const dates = calculateHandlingDates(lot, 4);

    // Rodada 1: Feb 2, Feb 9, Feb 11
    expect(dates[0]!.date.equals(DateOnly.create(2026, 2, 2))).toBe(true);
    expect(dates[1]!.date.equals(DateOnly.create(2026, 2, 9))).toBe(true);
    expect(dates[2]!.date.equals(DateOnly.create(2026, 2, 11))).toBe(true);

    // Rodada 2: Mar 5, Mar 12, Mar 14 (Feb 11 + 22 = Mar 5)
    expect(dates[3]!.date.equals(DateOnly.create(2026, 3, 5))).toBe(true);
    expect(dates[4]!.date.equals(DateOnly.create(2026, 3, 12))).toBe(true);
    expect(dates[5]!.date.equals(DateOnly.create(2026, 3, 14))).toBe(true);

    // Rodada 3: Apr 4, Apr 11, Apr 13 (Mar 14 + 21 = Apr 4)
    expect(dates[6]!.date.equals(DateOnly.create(2026, 4, 4))).toBe(true);
    expect(dates[7]!.date.equals(DateOnly.create(2026, 4, 11))).toBe(true);
    expect(dates[8]!.date.equals(DateOnly.create(2026, 4, 13))).toBe(true);

    // Rodada 4: May 5, May 12, May 14 (Apr 13 + 22 = May 5)
    expect(dates[9]!.date.equals(DateOnly.create(2026, 5, 5))).toBe(true);
    expect(dates[10]!.date.equals(DateOnly.create(2026, 5, 12))).toBe(true);
    expect(dates[11]!.date.equals(DateOnly.create(2026, 5, 14))).toBe(true);
  });
});

describe('calculateAllHandlingDates - Multiple Lots', () => {
  it('should calculate dates for multiple lots', () => {
    const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
    const lot1 = Lot.create('lot1', 'Lot1', DateOnly.create(2026, 1, 1), protocol, [22, 22, 22]);
    const lot2 = Lot.create('lot2', 'Lot2', DateOnly.create(2026, 1, 2), protocol, [22, 22, 22]);

    const allDates = calculateAllHandlingDates([lot1, lot2], 1);

    expect(allDates).toHaveLength(6); // 2 lots × 3 dates
    expect(allDates.filter((d) => d.lotId === 'lot1')).toHaveLength(3);
    expect(allDates.filter((d) => d.lotId === 'lot2')).toHaveLength(3);
  });
});

describe('groupHandlingDatesByDate - Overlap Detection', () => {
  it('should group dates correctly', () => {
    const protocol = Protocol.create('p1', 'D0-D7', [0, 7], 'custom');
    const lot1 = Lot.create('lot1', 'Lot1', DateOnly.create(2026, 1, 1), protocol, [22, 22, 22]);
    const lot2 = Lot.create('lot2', 'Lot2', DateOnly.create(2026, 1, 1), protocol, [22, 22, 22]);

    const allDates = calculateAllHandlingDates([lot1, lot2], 1);
    const grouped = groupHandlingDatesByDate(allDates);

    // Both lots have same D0, so should be grouped
    const jan1Key = '2026-01-01';
    const jan1Dates = grouped.get(jan1Key);
    expect(jan1Dates).toHaveLength(2);
    expect(jan1Dates![0]!.lotId).toBe('lot1');
    expect(jan1Dates![1]!.lotId).toBe('lot2');
  });
});

