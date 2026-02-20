import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { OptimizationModal } from '../../../src/components/Optimization/OptimizationModal';
import { optimizationStatsSignal } from '../../../src/state/signals/optimization';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { OptimizationScenario } from '../../../src/domain/value-objects/OptimizationScenario';
import { Protocol } from '../../../src/domain/value-objects/Protocol';

function createLot(id: string, day: number): Lot {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  return Lot.create(id, id.toUpperCase(), DateOnly.create(2026, 1, day), protocol, [22, 22, 22]);
}

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('OptimizationModal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    optimizationStatsSignal.value = null;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    optimizationStatsSignal.value = null;
  });

  it('returns null when no scenarios are provided', () => {
    act(() => {
      render(
        h(OptimizationModal, {
          scenarios: [],
          originalLots: [],
          onApply: vi.fn(),
          onClose: vi.fn(),
        }),
        container
      );
    });

    expect(container.innerHTML).toBe('');
  });

  it('renders scenario metrics, stats and triggers callbacks', () => {
    const originalLot = createLot('lot-1', 5);
    const changedLot = originalLot.withD0(DateOnly.create(2026, 1, 7)).withRoundGap(0, 25);
    const scenario = OptimizationScenario.create(
      'Balanceado',
      [changedLot],
      {
        sundaysRounds12: 0,
        sundaysRounds34: 1,
        overlapsRounds12: 0,
        overlapsRounds34: 2,
        totalCycleDays: 105,
        intervalViolations: 0,
      },
      0.91,
      'Descricao do cenario'
    );

    optimizationStatsSignal.value = { totalCombinations: 1234 };

    const onApply = vi.fn();
    const onClose = vi.fn();

    act(() => {
      render(
        h(OptimizationModal, {
          scenarios: [scenario],
          originalLots: [originalLot],
          onApply,
          onClose,
        }),
        container
      );
    });

    expect(container.textContent).toContain('Cenarios Otimizados');
    expect(container.textContent).toContain('combinações analisadas');
    expect(container.textContent).toContain('Cenario 1: Balanceado');
    expect(container.textContent).toContain('Ciclo Total:');
    expect(container.textContent).toContain('Mudancas:');

    const applyButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Aplicar Cenario')
    ) as HTMLButtonElement;
    click(applyButton);
    expect(onApply).toHaveBeenCalledWith(scenario);

    const cancelButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Cancelar')
    ) as HTMLButtonElement;
    click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking overlay and ignores inner modal clicks', () => {
    const lot = createLot('lot-1', 5);
    const scenario = OptimizationScenario.create(
      'Teste',
      [lot],
      {
        sundaysRounds12: 0,
        sundaysRounds34: 0,
        overlapsRounds12: 0,
        overlapsRounds34: 0,
        totalCycleDays: 100,
        intervalViolations: 0,
      },
      1
    );

    const onClose = vi.fn();

    act(() => {
      render(
        h(OptimizationModal, {
          scenarios: [scenario],
          originalLots: [lot],
          onApply: vi.fn(),
          onClose,
        }),
        container
      );
    });

    const innerModal = container.querySelector('.optimization-modal') as HTMLDivElement;
    click(innerModal);
    expect(onClose).toHaveBeenCalledTimes(0);

    const overlay = container.querySelector('.modal-overlay') as HTMLDivElement;
    click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
