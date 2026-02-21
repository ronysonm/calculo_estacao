import { describe, it, expect } from 'vitest';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { MIN_ROUND_GAP, MAX_ROUND_GAP } from '../../../src/domain/constants';

const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
const d0 = DateOnly.create(2026, 3, 1);

describe('Lot - animalCount', () => {
  it('should default to 100 animals', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol);
    expect(lot.animalCount).toBe(100);
  });

  it('should accept custom animal count', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 200);
    expect(lot.animalCount).toBe(200);
  });

  it('should throw if animalCount < 1', () => {
    expect(() => Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 0)).toThrow();
  });

  it('withAnimalCount should return new lot with updated count', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const updated = lot.withAnimalCount(150);
    expect(updated.animalCount).toBe(150);
    expect(lot.animalCount).toBe(100); // original unchanged
    expect(updated.id).toBe(lot.id);
    expect(updated.name).toBe(lot.name);
  });

  it('withD0 should preserve animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 250);
    const updated = lot.withD0(DateOnly.create(2026, 4, 1));
    expect(updated.animalCount).toBe(250);
  });

  it('withName should preserve animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 250);
    const updated = lot.withName('New Name');
    expect(updated.animalCount).toBe(250);
  });

  it('withProtocol should preserve animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 250);
    const p2 = Protocol.create('p2', 'D0-D8-D10', [0, 8, 10], 'D0-D8-D10');
    const updated = lot.withProtocol(p2);
    expect(updated.animalCount).toBe(250);
  });

  it('withRoundGap should preserve animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 250);
    const updated = lot.withRoundGap(0, 24);
    expect(updated.animalCount).toBe(250);
  });
});

describe('Lot - roundGap validation', () => {
  it('should accept gaps at MIN_ROUND_GAP boundary', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [MIN_ROUND_GAP, MIN_ROUND_GAP, MIN_ROUND_GAP]);
    expect(lot.roundGaps).toEqual([MIN_ROUND_GAP, MIN_ROUND_GAP, MIN_ROUND_GAP]);
  });

  it('should accept gaps at MAX_ROUND_GAP boundary', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [MAX_ROUND_GAP, MAX_ROUND_GAP, MAX_ROUND_GAP]);
    expect(lot.roundGaps).toEqual([MAX_ROUND_GAP, MAX_ROUND_GAP, MAX_ROUND_GAP]);
  });

  it('should throw for gap below MIN_ROUND_GAP', () => {
    expect(() => Lot.create('l1', 'Test', d0, protocol, [MIN_ROUND_GAP - 1, 22, 22])).toThrow(
      `Round gap must be between ${MIN_ROUND_GAP} and ${MAX_ROUND_GAP} days`
    );
  });

  it('should throw for gap above MAX_ROUND_GAP', () => {
    expect(() => Lot.create('l1', 'Test', d0, protocol, [22, MAX_ROUND_GAP + 1, 22])).toThrow(
      `Round gap must be between ${MIN_ROUND_GAP} and ${MAX_ROUND_GAP} days`
    );
  });

  it('should throw for gap of 1 (old minimum)', () => {
    expect(() => Lot.create('l1', 'Test', d0, protocol, [1, 22, 22])).toThrow();
  });
});

describe('Lot - fromJSON gap clamping', () => {
  it('should clamp gaps below MIN_ROUND_GAP from legacy data', () => {
    const json = {
      id: 'l1',
      name: 'Test',
      d0: { year: 2026, month: 3, day: 1 },
      protocol: { id: 'p1', name: 'D0-D7-D9', intervals: [0, 7, 9] as readonly number[], type: 'D0-D7-D9' as const },
      roundGaps: [10, 22, 22] as readonly number[],
    };
    const lot = Lot.fromJSON(json);
    expect(lot.roundGaps[0]).toBe(MIN_ROUND_GAP);
  });

  it('should clamp gaps above MAX_ROUND_GAP from legacy data', () => {
    const json = {
      id: 'l1',
      name: 'Test',
      d0: { year: 2026, month: 3, day: 1 },
      protocol: { id: 'p1', name: 'D0-D7-D9', intervals: [0, 7, 9] as readonly number[], type: 'D0-D7-D9' as const },
      roundGaps: [22, 30, 22] as readonly number[],
    };
    const lot = Lot.fromJSON(json);
    expect(lot.roundGaps[1]).toBe(MAX_ROUND_GAP);
  });

  it('should clamp roundInterval from legacy data', () => {
    const json = {
      id: 'l1',
      name: 'Test',
      d0: { year: 2026, month: 3, day: 1 },
      protocol: { id: 'p1', name: 'D0-D7-D9', intervals: [0, 7, 9] as readonly number[], type: 'D0-D7-D9' as const },
      roundInterval: 5,
    };
    const lot = Lot.fromJSON(json);
    expect(lot.roundGaps).toEqual([MIN_ROUND_GAP, MIN_ROUND_GAP, MIN_ROUND_GAP]);
  });
});

describe('Lot - getAnimalsPerRound', () => {
  it('should calculate correctly with default rates [50, 20, 20, 10]', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const result = lot.getAnimalsPerRound([50, 20, 20, 10]);

    // R1: 100
    // R2: 100 - floor(100 * 50/100) = 100 - 50 = 50
    // R3: 50 - floor(50 * 20/100) = 50 - 10 = 40
    // R4: 40 - floor(40 * 20/100) = 40 - 8 = 32
    expect(result).toEqual([100, 50, 40, 32]);
  });

  it('should handle 200 animals with same rates', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 200);
    const result = lot.getAnimalsPerRound([50, 20, 20, 10]);

    // R1: 200
    // R2: 200 - 100 = 100
    // R3: 100 - 20 = 80
    // R4: 80 - 16 = 64
    expect(result).toEqual([200, 100, 80, 64]);
  });

  it('should handle 0% success rate (no animals succeed)', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const result = lot.getAnimalsPerRound([0, 0, 0, 0]);

    expect(result).toEqual([100, 100, 100, 100]);
  });

  it('should handle 100% success rate (all succeed)', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const result = lot.getAnimalsPerRound([100, 100, 100, 100]);

    expect(result).toEqual([100, 0, 0, 0]);
  });

  it('should use floor for fractional results', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 33);
    const result = lot.getAnimalsPerRound([50, 50, 50, 50]);

    // R1: 33
    // R2: 33 - floor(33 * 50/100) = 33 - 16 = 17
    // R3: 17 - floor(17 * 50/100) = 17 - 8 = 9
    // R4: 9 - floor(9 * 50/100) = 9 - 4 = 5
    expect(result).toEqual([33, 17, 9, 5]);
  });

  it('should handle different number of rounds', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const result = lot.getAnimalsPerRound([50, 20], 2);

    expect(result).toEqual([100, 50]);
  });
});

describe('Lot - serialization with animalCount', () => {
  it('toJSON should include animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 150);
    const json = lot.toJSON();
    expect(json.animalCount).toBe(150);
  });

  it('fromJSON should restore animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 150);
    const json = lot.toJSON();
    const restored = Lot.fromJSON(json as any);
    expect(restored.animalCount).toBe(150);
  });

  it('fromJSON should default to 100 when animalCount is missing (migration)', () => {
    const json = {
      id: 'l1',
      name: 'Test',
      d0: { year: 2026, month: 3, day: 1 },
      protocol: { id: 'p1', name: 'D0-D7-D9', intervals: [0, 7, 9], type: 'D0-D7-D9' as const },
      roundGaps: [22, 22, 22],
      // animalCount is NOT present (old data)
    };
    const lot = Lot.fromJSON(json);
    expect(lot.animalCount).toBe(100);
  });

  it('equals should compare animalCount', () => {
    const lot1 = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const lot2 = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 200);
    expect(lot1.equals(lot2)).toBe(false);
  });
});
