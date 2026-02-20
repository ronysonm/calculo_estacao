import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { ExportDialog } from '../../../src/components/Export/ExportDialog';
import { lotsSignal } from '../../../src/state/signals/lots';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';
import { generatePDF } from '../../../src/services/export/pdf-generator';
import { generateExcel } from '../../../src/services/export/excel-generator';

vi.mock('../../../src/services/export/pdf-generator', () => ({
  generatePDF: vi.fn(),
}));

vi.mock('../../../src/services/export/excel-generator', () => ({
  generateExcel: vi.fn(),
}));

function createLot(id: string = 'lot-1'): Lot {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  return Lot.create(id, id.toUpperCase(), DateOnly.create(2026, 1, 5), protocol, [22, 22, 22]);
}

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function flushPromises(): Promise<void> {
  return Promise.resolve();
}

describe('ExportDialog', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    lotsSignal.value = [];
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    lotsSignal.value = [];
    vi.useRealTimers();
  });

  it('keeps export actions disabled when there are no lots', () => {
    act(() => {
      render(h(ExportDialog, {}), container);
    });

    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });

  it('exports PDF and Excel when lots exist', async () => {
    lotsSignal.value = [createLot('lot-1')];

    act(() => {
      render(h(ExportDialog, {}), container);
    });

    const pdfButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Exportar PDF')
    ) as HTMLButtonElement;
    const excelButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Exportar Excel')
    ) as HTMLButtonElement;

    click(pdfButton);
    await act(async () => {
      vi.advanceTimersByTime(100);
      await flushPromises();
    });

    expect(generatePDF).toHaveBeenCalledTimes(1);

    click(excelButton);
    await act(async () => {
      vi.advanceTimersByTime(100);
      await flushPromises();
    });

    expect(generateExcel).toHaveBeenCalledTimes(1);
  });

  it('shows alert when Excel export fails', async () => {
    lotsSignal.value = [createLot('lot-1')];
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.mocked(generateExcel).mockRejectedValueOnce(new Error('excel failure'));

    act(() => {
      render(h(ExportDialog, {}), container);
    });

    const excelButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Exportar Excel')
    ) as HTMLButtonElement;

    click(excelButton);
    await act(async () => {
      vi.advanceTimersByTime(100);
      await flushPromises();
    });

    expect(alertSpy).toHaveBeenCalledWith('Erro ao gerar Excel. Verifique o console para detalhes.');
  });
});
