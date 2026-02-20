import { describe, expect, it } from 'vitest';
import { ConflictResolver, resolveConflicts } from '../../../src/core/conflict/resolver';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';

const singleDayProtocol = Protocol.create('p0', 'D0', [0], 'custom');

function createLot(id: string, day: number): Lot {
  return Lot.create(
    id,
    id.toUpperCase(),
    DateOnly.create(2026, 1, day),
    singleDayProtocol,
    [22, 22, 22]
  );
}

describe('resolveConflicts', () => {
  it('returns early when there are no conflicts', () => {
    const lots = [createLot('lot-1', 5), createLot('lot-2', 6)];

    const result = resolveConflicts(lots);

    expect(result.success).toBe(true);
    expect(result.conflictCount).toBe(0);
    expect(result.iterations).toBe(0);
    expect(result.message).toContain('Nenhum conflito encontrado');
  });

  it('finds a conflict-free schedule when lots are movable', () => {
    const lots = [createLot('lot-1', 5), createLot('lot-2', 5)];

    const result = resolveConflicts(lots);

    expect(result.success).toBe(true);
    expect(result.conflictCount).toBe(0);
    expect(result.iterations).toBeGreaterThan(0);

    const changedLots = result.lots.filter((lot, index) => !lot.d0.equals(lots[index]!.d0));
    expect(changedLots.length).toBeGreaterThan(0);
  });

  it('returns best effort failure when all conflicting lots are locked', () => {
    const lots = [createLot('lot-1', 5), createLot('lot-2', 5)];
    const lockedLotIds = new Set(['lot-1', 'lot-2']);

    const result = resolveConflicts(lots, lockedLotIds);

    expect(result.success).toBe(false);
    expect(result.conflictCount).toBeGreaterThan(0);
    expect(result.message).toContain('Não foi possível melhorar');
    expect(result.lots[0]!.d0.equals(lots[0]!.d0)).toBe(true);
    expect(result.lots[1]!.d0.equals(lots[1]!.d0)).toBe(true);
  });

  it('returns partial improvement when not all conflicts can be solved', () => {
    const lots = [createLot('lot-1', 5), createLot('lot-2', 5)];
    const resolver = new ConflictResolver(lots, new Set());

    (resolver as any).countConflicts = (() => {
      const values = [5, 3, 5];
      return () => values.shift() ?? 5;
    })();

    (resolver as any).findMostConstrainedLot = (() => {
      let called = false;
      return () => {
        if (!called) {
          called = true;
          return lots[0]!;
        }
        return null;
      };
    })();

    const result = resolver.resolve();

    expect(result.success).toBe(false);
    expect(result.conflictCount).toBe(3);
    expect(result.message).toContain('Melhor solução');
    expect(result.iterations).toBeGreaterThan(0);
  });
});
