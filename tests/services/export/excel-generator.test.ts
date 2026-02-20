import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateExcel } from '../../../src/services/export/excel-generator';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { HandlingDate } from '../../../src/domain/value-objects/HandlingDate';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';

function createLotsAndDates(): { lots: Lot[]; handlingDates: HandlingDate[] } {
  const protocol = Protocol.create('p-custom', 'D0-D1-D2', [0, 1, 2], 'custom');
  const lotA = Lot.create('lot-a', 'Lot A', DateOnly.create(2026, 1, 4), protocol, [22, 22, 22]);
  const lotB = Lot.create('lot-b', 'Lot B', DateOnly.create(2026, 1, 4), protocol, [22, 22, 22]);

  const handlingDates: HandlingDate[] = [
    HandlingDate.create('lot-a', 'Lot A', 0, 'Rodada 1', 0, DateOnly.create(2026, 1, 4)),
    HandlingDate.create('lot-a', 'Lot A', 0, 'Rodada 1', 1, DateOnly.create(2026, 1, 5)),
    HandlingDate.create('lot-a', 'Lot A', 0, 'Rodada 1', 2, DateOnly.create(2026, 1, 11)),
    HandlingDate.create('lot-b', 'Lot B', 0, 'Rodada 1', 0, DateOnly.create(2026, 1, 6)),
    HandlingDate.create('lot-b', 'Lot B', 0, 'Rodada 1', 1, DateOnly.create(2026, 1, 5)),
    HandlingDate.create('lot-b', 'Lot B', 0, 'Rodada 1', 2, DateOnly.create(2026, 1, 11)),
  ];

  return { lots: [lotA, lotB], handlingDates };
}

describe('generateExcel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('alerts when there are no lots', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    await generateExcel([], []);

    expect(alertSpy).toHaveBeenCalledWith('Nenhum lote para exportar');
  });

  it('generates and downloads excel file for valid lots', async () => {
    const { lots, handlingDates } = createLotsAndDates();
    const createObjectURL = vi.fn(() => 'blob:excel-test-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    await generateExcel(lots, handlingDates);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:excel-test-url');
  });
});
