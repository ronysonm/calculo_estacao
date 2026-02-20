import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';
import { setLots } from '../../../src/state/signals/lots';
import {
  conflictSummarySignal,
  conflictsSignal,
  cycleStartSignal,
  handlingDatesSignal,
} from '../../../src/state/signals/conflicts';
import { useConflictSummary } from '../../../src/hooks/useConflicts';

function createLot(id: string, name: string, d0: DateOnly): Lot {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  return Lot.create(id, name, d0, protocol, [22, 22, 22]);
}

describe('conflict derived signals', () => {
  beforeEach(() => {
    setLots([]);
  });

  afterEach(() => {
    setLots([]);
  });

  it('returns empty state when there are no lots', () => {
    expect(handlingDatesSignal.value).toEqual([]);
    expect(conflictsSignal.value).toEqual([]);
    expect(conflictSummarySignal.value).toEqual({ total: 0, sundays: 0, overlaps: 0 });
    expect(cycleStartSignal.value).toBeNull();
  });

  it('computes handling dates, conflicts and cycle start from lots', () => {
    const d0 = DateOnly.create(2026, 1, 5);
    const lots = [createLot('lot-1', 'Lot 1', d0), createLot('lot-2', 'Lot 2', d0)];

    setLots(lots);

    const summary = conflictSummarySignal.value;

    expect(handlingDatesSignal.value).toHaveLength(24);
    expect(conflictsSignal.value.length).toBeGreaterThan(0);
    expect(summary.overlaps).toBeGreaterThan(0);
    expect(summary.total).toBe(summary.sundays + summary.overlaps);
    expect(cycleStartSignal.value?.equals(d0)).toBe(true);
  });

  it('useConflictSummary returns the same data as conflictSummarySignal', () => {
    const d0 = DateOnly.create(2026, 1, 7);
    setLots([createLot('lot-1', 'Lot 1', d0), createLot('lot-2', 'Lot 2', d0)]);

    expect(useConflictSummary()).toEqual(conflictSummarySignal.value);
  });
});
