import { describe, expect, it } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { OptimizationScenario } from '../../../src/domain/value-objects/OptimizationScenario';
import { Protocol } from '../../../src/domain/value-objects/Protocol';

function createLot(id: string, day: number, gaps: readonly number[] = [22, 22, 22]): Lot {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  return Lot.create(id, id.toUpperCase(), DateOnly.create(2026, 1, day), protocol, gaps);
}

describe('OptimizationScenario', () => {
  it('computes total cycle days from first d0 to last handling date', () => {
    const lot = createLot('lot-1', 1, [22, 22, 22]);
    const scenario = OptimizationScenario.create(
      'A',
      [lot],
      {
        sundaysRounds12: 0,
        sundaysRounds34: 0,
        overlapsRounds12: 0,
        overlapsRounds34: 0,
        totalCycleDays: 0,
        intervalViolations: 0,
      },
      0.9
    );

    expect(scenario.getTotalCycleDays()).toBe(102);
  });

  it('returns lot changes for d0 and round gap updates', () => {
    const original = createLot('lot-1', 1, [22, 22, 22]);
    const updated = original.withD0(DateOnly.create(2026, 1, 3)).withRoundGap(1, 25);

    const scenario = OptimizationScenario.create(
      'B',
      [updated],
      {
        sundaysRounds12: 0,
        sundaysRounds34: 0,
        overlapsRounds12: 0,
        overlapsRounds34: 0,
        totalCycleDays: 0,
        intervalViolations: 0,
      },
      0.875
    );

    const changes = scenario.getChanges([original]);

    expect(changes).toHaveLength(1);
    expect(changes[0]!.daysDiff).toBe(-2);
    expect(changes[0]!.gapChanges).toHaveLength(1);
    expect(changes[0]!.gapChanges[0]!.gapIndex).toBe(1);
  });

  it('formats fitness score with one decimal place percentage', () => {
    const scenario = OptimizationScenario.create(
      'C',
      [],
      {
        sundaysRounds12: 0,
        sundaysRounds34: 0,
        overlapsRounds12: 0,
        overlapsRounds34: 0,
        totalCycleDays: 0,
        intervalViolations: 0,
      },
      0.9123
    );

    expect(scenario.getFormattedScore()).toBe('91.2');
  });
});
