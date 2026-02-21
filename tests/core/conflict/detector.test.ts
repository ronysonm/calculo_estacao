import { describe, it, expect } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { HandlingDate } from '../../../src/domain/value-objects/HandlingDate';
import {
  detectHolidayConflicts,
  getConflictTypeForCell,
} from '../../../src/core/conflict/detector';
import { expandNationalHolidays } from '../../../src/domain/value-objects/Holiday';

function makeHandlingDate(date: DateOnly, lotId = 'lot-1'): HandlingDate {
  return new HandlingDate(lotId, 'Lote 1', 0, 'R1', 0, date);
}

describe('detectHolidayConflicts', () => {
  it('returns empty array when no handling dates match holidays', () => {
    const date = DateOnly.create(2026, 2, 15); // not a holiday
    const hd = makeHandlingDate(date);
    const holidays = expandNationalHolidays([2026]);
    expect(detectHolidayConflicts([hd], holidays)).toHaveLength(0);
  });

  it('detects national holiday conflict', () => {
    const date = DateOnly.create(2026, 9, 7); // Independência
    const hd = makeHandlingDate(date);
    const holidays = expandNationalHolidays([2026]);
    const result = detectHolidayConflicts([hd], holidays);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('holiday');
    expect(result[0]!.date.equals(date)).toBe(true);
  });

  it('detects custom holiday conflict', () => {
    const date = DateOnly.create(2026, 3, 15);
    const hd = makeHandlingDate(date);
    const customHoliday = { date, name: 'Feriado Municipal', isCustom: true };
    const result = detectHolidayConflicts([hd], [customHoliday]);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('holiday');
  });

  it('returns empty array when holidays list is empty', () => {
    const date = DateOnly.create(2026, 9, 7);
    const hd = makeHandlingDate(date);
    expect(detectHolidayConflicts([hd], [])).toHaveLength(0);
  });

  it('creates one conflict per handling date on a holiday', () => {
    const date = DateOnly.create(2026, 12, 25); // Natal
    const holidays = expandNationalHolidays([2026]);
    const hd1 = makeHandlingDate(date, 'lot-1');
    const hd2 = makeHandlingDate(date, 'lot-2');
    const result = detectHolidayConflicts([hd1, hd2], holidays);
    expect(result).toHaveLength(2);
  });
});

describe('getConflictTypeForCell with holidays', () => {
  it('returns holiday for cell on a holiday (non-Sunday)', () => {
    // Sep 7, 2026 is Monday (Independência)
    const date = DateOnly.create(2026, 9, 7);
    const hd = makeHandlingDate(date);
    const holidays = expandNationalHolidays([2026]);
    const result = getConflictTypeForCell(date, 'lot-1', [hd], holidays);
    expect(result).toBe('holiday');
  });

  it('returns sunday-holiday when Sunday + holiday', () => {
    // Feb 22, 2026 is a Sunday; we also mark it as a custom holiday
    const date = DateOnly.create(2026, 2, 22);
    const hd = makeHandlingDate(date);
    const customHoliday = { date, name: 'Feriado no Domingo', isCustom: true };
    const result = getConflictTypeForCell(date, 'lot-1', [hd], [customHoliday]);
    expect(result).toBe('sunday-holiday');
  });

  it('returns overlap-holiday when overlap + holiday (non-Sunday)', () => {
    // Sep 7, 2026 is Monday (Independência) — two lots on same date
    const date = DateOnly.create(2026, 9, 7);
    const hd1 = makeHandlingDate(date, 'lot-1');
    const hd2 = makeHandlingDate(date, 'lot-2');
    const holidays = expandNationalHolidays([2026]);
    const result = getConflictTypeForCell(date, 'lot-1', [hd1, hd2], holidays);
    expect(result).toBe('overlap-holiday');
  });

  it('returns sunday-overlap when Sunday + overlap (no holiday)', () => {
    const date = DateOnly.create(2026, 2, 22); // Sunday
    const hd1 = makeHandlingDate(date, 'lot-1');
    const hd2 = makeHandlingDate(date, 'lot-2');
    const result = getConflictTypeForCell(date, 'lot-1', [hd1, hd2], []);
    expect(result).toBe('sunday-overlap');
  });

  it('returns sunday-overlap-holiday when all three conflicts', () => {
    const date = DateOnly.create(2026, 2, 22); // Sunday
    const hd1 = makeHandlingDate(date, 'lot-1');
    const hd2 = makeHandlingDate(date, 'lot-2');
    const customHoliday = { date, name: 'Feriado no Domingo', isCustom: true };
    const result = getConflictTypeForCell(date, 'lot-1', [hd1, hd2], [customHoliday]);
    expect(result).toBe('sunday-overlap-holiday');
  });

  it('returns null when date is not a holiday and no other conflicts', () => {
    const date = DateOnly.create(2026, 2, 17); // Tuesday, not a holiday
    const hd = makeHandlingDate(date);
    const result = getConflictTypeForCell(date, 'lot-1', [hd], []);
    expect(result).toBeNull();
  });

  it('backward compat: returns sunday without holidays param', () => {
    const date = DateOnly.create(2026, 2, 22); // Sunday
    const hd = makeHandlingDate(date);
    // @ts-expect-error testing optional param omission
    const result = getConflictTypeForCell(date, 'lot-1', [hd]);
    expect(result).toBe('sunday');
  });
});
