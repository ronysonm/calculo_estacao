import { describe, it, expect } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { HandlingDate } from '../../../src/domain/value-objects/HandlingDate';
import { Conflict } from '../../../src/domain/value-objects/Conflict';

function makeHandlingDate(date: DateOnly, lotId = 'lot-1'): HandlingDate {
  return new HandlingDate(lotId, 'Lote 1', 0, 'R1', 0, date);
}

describe('Conflict.holiday()', () => {
  it('creates a holiday conflict with correct type', () => {
    const date = DateOnly.create(2026, 9, 7);
    const hd = makeHandlingDate(date);
    const conflict = Conflict.holiday(hd);
    expect(conflict.type).toBe('holiday');
    expect(conflict.date.equals(date)).toBe(true);
    expect(conflict.handlingDates).toHaveLength(1);
  });

  it('ConflictType includes holiday', () => {
    const date = DateOnly.create(2026, 1, 1);
    const c = Conflict.holiday(makeHandlingDate(date));
    const type: 'sunday' | 'overlap' | 'holiday' = c.type;
    expect(type).toBe('holiday');
  });
});

describe('existing Conflict factories still work', () => {
  it('sunday conflict unchanged', () => {
    const date = DateOnly.create(2026, 2, 22); // a Sunday
    const hd = makeHandlingDate(date);
    const c = Conflict.sunday(hd);
    expect(c.type).toBe('sunday');
  });
});
