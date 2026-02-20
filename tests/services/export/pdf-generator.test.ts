import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { HandlingDate } from '../../../src/domain/value-objects/HandlingDate';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';

const { autoTableMock, docs } = vi.hoisted(() => ({
  autoTableMock: vi.fn(),
  docs: [] as FakePdfDoc[],
}));

class FakePdfDoc {
  public lastAutoTable: { finalY: number } | undefined;
  public internal = {
    pageSize: {
      getHeight: () => 60,
    },
  };

  setFontSize = vi.fn();
  setFont = vi.fn();
  text = vi.fn();
  save = vi.fn();
  setFillColor = vi.fn();
  rect = vi.fn();
  setDrawColor = vi.fn();
  setTextColor = vi.fn();
  addPage = vi.fn();
}

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => {
    const doc = new FakePdfDoc();
    docs.push(doc);
    return doc;
  }),
}));

vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}));

import { generatePDF } from '../../../src/services/export/pdf-generator';

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

describe('generatePDF', () => {
  beforeEach(() => {
    docs.length = 0;
    autoTableMock.mockReset();
    autoTableMock.mockImplementation((doc: FakePdfDoc, options: { startY?: number }) => {
      doc.lastAutoTable = { finalY: (options.startY ?? 0) + 18 };
    });
  });

  it('writes empty-state PDF when no lots exist', () => {
    generatePDF([], [], null);

    expect(docs).toHaveLength(1);
    const doc = docs[0]!;
    expect(autoTableMock).not.toHaveBeenCalled();
    expect(doc.text).toHaveBeenCalledWith('Nenhum lote para exportar', 148, 40, { align: 'center' });
    expect(doc.save).toHaveBeenCalledWith(expect.stringMatching(/^estacao-\d{4}-\d{2}-\d{2}\.pdf$/));
  });

  it('renders lot tables, applies pagination flow and saves file', () => {
    const { lots, handlingDates } = createLotsAndDates();

    generatePDF(lots, handlingDates, DateOnly.create(2026, 1, 4));

    expect(docs).toHaveLength(1);
    const doc = docs[0]!;
    expect(autoTableMock).toHaveBeenCalledTimes(2);
    expect(doc.addPage).toHaveBeenCalled();
    expect(doc.save).toHaveBeenCalledWith(expect.stringMatching(/^estacao-\d{4}-\d{2}-\d{2}\.pdf$/));
  });
});
