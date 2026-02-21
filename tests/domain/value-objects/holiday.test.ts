import { describe, it, expect } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import {
  NATIONAL_HOLIDAYS,
  expandNationalHolidays,
  findHoliday,
} from '../../../src/domain/value-objects/Holiday';

describe('NATIONAL_HOLIDAYS', () => {
  it('should have exactly 8 national holidays', () => {
    expect(NATIONAL_HOLIDAYS.length).toBe(8);
  });

  it('should use months 1-12 (not 0-11)', () => {
    const months = NATIONAL_HOLIDAYS.map((h) => h.month);
    expect(Math.min(...months)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...months)).toBeLessThanOrEqual(12);
  });
});

describe('expandNationalHolidays', () => {
  it('expands 8 holidays for one year', () => {
    expect(expandNationalHolidays([2026])).toHaveLength(8);
  });

  it('expands 16 holidays for two years', () => {
    expect(expandNationalHolidays([2025, 2026])).toHaveLength(16);
  });

  it('creates correct DateOnly for Jan 1 2026', () => {
    const result = expandNationalHolidays([2026]);
    const jan1 = result.find((h) => h.name === 'Confraternização Universal');
    expect(jan1).toBeDefined();
    expect(jan1!.date.year).toBe(2026);
    expect(jan1!.date.month).toBe(1);
    expect(jan1!.date.day).toBe(1);
  });

  it('marks national holidays as isCustom=false', () => {
    expect(expandNationalHolidays([2026]).every((h) => !h.isCustom)).toBe(true);
  });

  it('returns empty array for empty years', () => {
    expect(expandNationalHolidays([])).toHaveLength(0);
  });
});

describe('findHoliday', () => {
  it('finds matching holiday by date', () => {
    const holidays = expandNationalHolidays([2026]);
    const date = DateOnly.create(2026, 9, 7);
    const result = findHoliday(date, holidays);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Independência do Brasil');
  });

  it('returns null for non-holiday date', () => {
    const holidays = expandNationalHolidays([2026]);
    const date = DateOnly.create(2026, 2, 15);
    expect(findHoliday(date, holidays)).toBeNull();
  });

  it('returns null for empty holiday list', () => {
    const date = DateOnly.create(2026, 1, 1);
    expect(findHoliday(date, [])).toBeNull();
  });

  it('finds custom holiday', () => {
    const date = DateOnly.create(2026, 3, 15);
    const custom = [{ date, name: 'Feriado Municipal', isCustom: true }];
    const result = findHoliday(date, custom);
    expect(result!.name).toBe('Feriado Municipal');
  });
});
