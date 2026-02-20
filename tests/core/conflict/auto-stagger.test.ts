import { describe, expect, it } from 'vitest';
import {
  autoStagger,
  calculateOptimalSpacing,
  previewAutoStagger,
} from '../../../src/core/conflict/auto-stagger';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';

function createLot(
  id: string,
  d0: DateOnly,
  protocol: Protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9')
): Lot {
  return Lot.create(id, id.toUpperCase(), d0, protocol, [22, 22, 22]);
}

describe('autoStagger', () => {
  it('handles empty and single-lot inputs', () => {
    expect(autoStagger([], new Set())).toEqual([]);

    const single = createLot('lot-1', DateOnly.create(2026, 1, 10));
    expect(autoStagger([single], new Set())).toEqual([single]);
  });

  it('stagger lots by spacing days when no lots are locked', () => {
    const lots = [
      createLot('lot-a', DateOnly.create(2026, 1, 3)),
      createLot('lot-b', DateOnly.create(2026, 1, 1)),
      createLot('lot-c', DateOnly.create(2026, 1, 2)),
    ];

    const staggered = autoStagger(lots, new Set(), 2);
    const byId = new Map(staggered.map((lot) => [lot.id, lot]));

    expect(byId.get('lot-b')!.d0.equals(DateOnly.create(2026, 1, 1))).toBe(true);
    expect(byId.get('lot-c')!.d0.equals(DateOnly.create(2026, 1, 3))).toBe(true);
    expect(byId.get('lot-a')!.d0.equals(DateOnly.create(2026, 1, 5))).toBe(true);
  });

  it('preserves locked lots and spaces unlocked lots around them', () => {
    const lots = [
      createLot('locked', DateOnly.create(2026, 1, 1)),
      createLot('u1', DateOnly.create(2026, 1, 2)),
      createLot('u2', DateOnly.create(2026, 1, 4)),
    ];

    const staggered = autoStagger(lots, new Set(['locked']), 2);
    const byId = new Map(staggered.map((lot) => [lot.id, lot]));

    expect(byId.get('locked')!.d0.equals(DateOnly.create(2026, 1, 1))).toBe(true);
    expect(byId.get('u1')!.d0.equals(DateOnly.create(2026, 1, 3))).toBe(true);
    expect(byId.get('u2')!.d0.equals(DateOnly.create(2026, 1, 5))).toBe(true);
  });

  it('generates preview with changed flags by original order', () => {
    const original = [
      createLot('u1', DateOnly.create(2026, 1, 2)),
      createLot('locked', DateOnly.create(2026, 1, 1)),
    ];

    const preview = previewAutoStagger(original, new Set(['locked']), 2);

    expect(preview).toHaveLength(2);
    expect(preview[0]!.lot.id).toBe('u1');
    expect(preview[0]!.changed).toBe(true);
    expect(preview[1]!.lot.id).toBe('locked');
    expect(preview[1]!.changed).toBe(false);
  });
});

describe('calculateOptimalSpacing', () => {
  it('returns 1 for empty input', () => {
    expect(calculateOptimalSpacing([])).toBe(1);
  });

  it('uses half of max protocol span rounded up plus one', () => {
    const protocolShort = Protocol.create('p-short', 'D0-D9', [0, 9], 'custom');
    const protocolLong = Protocol.create('p-long', 'D0-D11', [0, 11], 'custom');
    const lots = [
      createLot('a', DateOnly.create(2026, 1, 1), protocolShort),
      createLot('b', DateOnly.create(2026, 1, 2), protocolLong),
    ];

    expect(calculateOptimalSpacing(lots)).toBe(7);
  });
});
