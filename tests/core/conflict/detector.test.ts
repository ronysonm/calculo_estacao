import { describe, expect, it } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { HandlingDate } from '../../../src/domain/value-objects/HandlingDate';
import { getConflictTypeForCell } from '../../../src/core/conflict/detector';

function hd(lotId: string, date: DateOnly): HandlingDate {
  return HandlingDate.create(lotId, lotId.toUpperCase(), 0, 'Rodada 1', 0, date);
}

describe('getConflictTypeForCell', () => {
  it('returns null when cell has no handling date', () => {
    const result = getConflictTypeForCell(DateOnly.create(2026, 1, 5), 'lot-1', []);
    expect(result).toBeNull();
  });

  it('returns sunday for sunday-only conflict', () => {
    const date = DateOnly.create(2026, 1, 4);
    const result = getConflictTypeForCell(date, 'lot-1', [hd('lot-1', date)]);
    expect(result).toBe('sunday');
  });

  it('returns overlap for overlap-only conflict', () => {
    const date = DateOnly.create(2026, 1, 5);
    const result = getConflictTypeForCell(date, 'lot-1', [hd('lot-1', date), hd('lot-2', date)]);
    expect(result).toBe('overlap');
  });

  it('returns multiple for sunday plus overlap on same cell', () => {
    const date = DateOnly.create(2026, 1, 4);
    const result = getConflictTypeForCell(date, 'lot-1', [hd('lot-1', date), hd('lot-2', date)]);
    expect(result).toBe('multiple');
  });
});
