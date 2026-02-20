import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { lotsSignal, setLots } from '../src/state/signals/lots';
import { DateOnly } from '../src/domain/value-objects/DateOnly';
import { Lot } from '../src/domain/value-objects/Lot';
import { Protocol } from '../src/domain/value-objects/Protocol';

const { usePersistenceMock } = vi.hoisted(() => ({
  usePersistenceMock: vi.fn(),
}));

vi.mock('../src/components/Forms/LotForm', () => ({
  LotForm: () => null,
}));

vi.mock('../src/components/Table/CalculationTable', () => ({
  CalculationTable: () => null,
}));

vi.mock('../src/hooks/usePersistence', () => ({
  usePersistence: usePersistenceMock,
}));

import { App } from '../src/app';

function createLot(id: string, day: number): Lot {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  return Lot.create(id, id.toUpperCase(), DateOnly.create(2026, 1, day), protocol, [22, 22, 22]);
}

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('App', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    setLots([]);
    usePersistenceMock.mockReset();

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    setLots([]);
    vi.useRealTimers();
  });

  it('initializes default lots on first visit when storage is empty', () => {
    act(() => {
      render(h(App, {}), container);
    });

    expect(lotsSignal.value).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(lotsSignal.value.length).toBe(5);
    expect(usePersistenceMock).toHaveBeenCalled();
  });

  it('skips default initialization when saved data exists', () => {
    localStorage.setItem('estacao-iatf-data', '{}');

    act(() => {
      render(h(App, {}), container);
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(lotsSignal.value).toEqual([]);
  });

  it('opens reset confirmation modal and restores default lots on confirm', () => {
    setLots([createLot('lot-1', 5)]);

    act(() => {
      render(h(App, {}), container);
    });

    const resetButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Resetar Lotes')
    ) as HTMLButtonElement;
    click(resetButton);

    expect(container.textContent).toContain('Tem certeza que deseja resetar todos os lotes');

    const confirmButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Confirmar')
    ) as HTMLButtonElement;
    click(confirmButton);

    expect(lotsSignal.value.length).toBe(5);
  });

  it('shows conflict-free summary by default', () => {
    act(() => {
      render(h(App, {}), container);
    });

    expect(container.textContent).toContain('Sem conflitos');
  });
});
