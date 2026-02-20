import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Protocol } from '../../../src/domain/value-objects/Protocol';
import { DEFAULT_LOT_NAMES, DEFAULT_PROTOCOL } from '../../../src/domain/constants';
import {
  addLot,
  changeLotD0,
  changeLotProtocol,
  changeLotRoundGap,
  initializeDefaultLots,
  lotsSignal,
  removeLot,
  renameLot,
  setLots,
} from '../../../src/state/signals/lots';
import { Lot } from '../../../src/domain/value-objects/Lot';

function createLot(id: string, name: string, day: number): Lot {
  return Lot.create(id, name, DateOnly.create(2026, 1, day), DEFAULT_PROTOCOL, [22, 22, 22]);
}

describe('lotsSignal state', () => {
  beforeEach(() => {
    lotsSignal.value = [];
    vi.useRealTimers();
  });

  afterEach(() => {
    lotsSignal.value = [];
    vi.useRealTimers();
  });

  it('initializes default lots with expected names and staggered dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));

    initializeDefaultLots();

    expect(lotsSignal.value).toHaveLength(DEFAULT_LOT_NAMES.length);
    expect(lotsSignal.value.map((lot) => lot.name)).toEqual([...DEFAULT_LOT_NAMES]);
    expect(lotsSignal.value[0]!.d0.equals(DateOnly.create(2026, 1, 31))).toBe(true);
    expect(lotsSignal.value[1]!.d0.daysSince(lotsSignal.value[0]!.d0)).toBe(1);
    expect(lotsSignal.value[4]!.d0.daysSince(lotsSignal.value[0]!.d0)).toBe(4);
  });

  it('adds and removes lots', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 9, 0, 0));

    addLot('Novo Lote', DateOnly.create(2026, 2, 1), DEFAULT_PROTOCOL);

    expect(lotsSignal.value).toHaveLength(1);
    expect(lotsSignal.value[0]!.id).toBe(`lot-${Date.now()}`);
    expect(lotsSignal.value[0]!.name).toBe('Novo Lote');

    removeLot(lotsSignal.value[0]!.id);
    expect(lotsSignal.value).toHaveLength(0);
  });

  it('renames and changes D0 for a specific lot', () => {
    const first = createLot('lot-1', 'Original', 1);
    const second = createLot('lot-2', 'Untouched', 2);
    setLots([first, second]);

    renameLot('lot-1', 'Renamed');
    changeLotD0('lot-1', DateOnly.create(2026, 2, 10));

    expect(lotsSignal.value[0]!.name).toBe('Renamed');
    expect(lotsSignal.value[0]!.d0.equals(DateOnly.create(2026, 2, 10))).toBe(true);
    expect(lotsSignal.value[1]!.name).toBe('Untouched');
    expect(lotsSignal.value[1]!.d0.equals(DateOnly.create(2026, 1, 2))).toBe(true);
  });

  it('changes protocol and round gap for one lot', () => {
    const customProtocol = Protocol.create('p2', 'D0-D8-D10', [0, 8, 10], 'D0-D8-D10');
    const lot = createLot('lot-1', 'Lot A', 1);
    setLots([lot]);

    changeLotProtocol('lot-1', customProtocol);
    changeLotRoundGap('lot-1', 1, 30);

    expect(lotsSignal.value[0]!.protocol.equals(customProtocol)).toBe(true);
    expect(lotsSignal.value[0]!.roundGaps).toEqual([22, 30, 22]);
  });

  it('replaces all lots with setLots', () => {
    setLots([createLot('lot-1', 'A', 1)]);
    expect(lotsSignal.value).toHaveLength(1);

    const replacement = [createLot('lot-2', 'B', 2), createLot('lot-3', 'C', 3)];
    setLots(replacement);

    expect(lotsSignal.value).toHaveLength(2);
    expect(lotsSignal.value[0]!.id).toBe('lot-2');
    expect(lotsSignal.value[1]!.id).toBe('lot-3');
  });
});
