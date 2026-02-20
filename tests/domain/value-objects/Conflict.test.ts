import { describe, expect, it } from 'vitest';
import { Conflict } from '../../../src/domain/value-objects/Conflict';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { HandlingDate } from '../../../src/domain/value-objects/HandlingDate';

function hd(lotId: string, day: number): HandlingDate {
  return HandlingDate.create(
    lotId,
    lotId.toUpperCase(),
    0,
    'Rodada 1',
    0,
    DateOnly.create(2026, 1, day)
  );
}

describe('Conflict', () => {
  it('creates sunday and overlap conflicts', () => {
    const sunday = Conflict.sunday(hd('lot-1', 4));
    const overlap = Conflict.overlap(DateOnly.create(2026, 1, 5), [hd('lot-1', 5), hd('lot-2', 5)]);

    expect(sunday.type).toBe('sunday');
    expect(overlap.type).toBe('overlap');
    expect(overlap.handlingDates).toHaveLength(2);
  });

  it('validates invalid conflict construction', () => {
    expect(() => new Conflict('sunday', DateOnly.create(2026, 1, 1), [])).toThrow(
      'Conflict must have at least one handling date'
    );

    expect(() => Conflict.overlap(DateOnly.create(2026, 1, 5), [hd('lot-1', 5)])).toThrow(
      'Overlap conflict must have at least 2 handling dates'
    );
  });

  it('compares equality by type, date and handling dates', () => {
    const a = Conflict.overlap(DateOnly.create(2026, 1, 5), [hd('lot-1', 5), hd('lot-2', 5)]);
    const b = Conflict.overlap(DateOnly.create(2026, 1, 5), [hd('lot-1', 5), hd('lot-2', 5)]);
    const c = Conflict.sunday(hd('lot-1', 5));

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
