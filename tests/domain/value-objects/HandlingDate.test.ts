import { describe, expect, it } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { HandlingDate } from '../../../src/domain/value-objects/HandlingDate';

describe('HandlingDate', () => {
  it('compares equality with all relevant fields', () => {
    const date = DateOnly.create(2026, 1, 10);
    const a = HandlingDate.create('lot-1', 'Lot 1', 0, 'Rodada 1', 7, date);
    const b = HandlingDate.create('lot-1', 'Lot 1', 0, 'Rodada 1', 7, date);
    const c = HandlingDate.create('lot-1', 'Lot 1', 0, 'Rodada 1', 9, date);

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('serializes and deserializes correctly', () => {
    const original = HandlingDate.create(
      'lot-2',
      'Lot 2',
      1,
      'Rodada 2',
      0,
      DateOnly.create(2026, 2, 5)
    );

    const json = original.toJSON();
    const restored = HandlingDate.fromJSON(json);

    expect(restored.equals(original)).toBe(true);
  });
});
