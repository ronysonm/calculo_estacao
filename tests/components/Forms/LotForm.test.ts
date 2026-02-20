import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { LotForm } from '../../../src/components/Forms/LotForm';
import { lotsSignal, setLots } from '../../../src/state/signals/lots';
import {
  clearOptimizationError,
  clearOptimizationScenarios,
  isOptimizingSignal,
  maxD0AdjustmentSignal,
  optimizationErrorSignal,
  optimizationScenariosSignal,
  optimizationStatsSignal,
} from '../../../src/state/signals/optimization';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { OptimizationScenario } from '../../../src/domain/value-objects/OptimizationScenario';
import { Protocol } from '../../../src/domain/value-objects/Protocol';
import { optimizerService } from '../../../src/services/optimization/optimizer-service';
import { OptimizationServiceError } from '../../../src/services/optimization/optimizer-contract';

function createLot(id: string, day: number): Lot {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  return Lot.create(id, id.toUpperCase(), DateOnly.create(2026, 1, day), protocol, [22, 22, 22]);
}

function createScenario(lots: Lot[]): OptimizationScenario {
  return OptimizationScenario.create(
    'Balanceado',
    lots,
    {
      sundaysRounds12: 0,
      sundaysRounds34: 0,
      overlapsRounds12: 0,
      overlapsRounds34: 0,
      totalCycleDays: 100,
      intervalViolations: 0,
    },
    0.95,
    'Cenario teste'
  );
}

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function typeInput(input: HTMLInputElement, value: string): void {
  act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function flushPromises(): Promise<void> {
  return Promise.resolve();
}

describe('LotForm', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    setLots([]);
    isOptimizingSignal.value = false;
    maxD0AdjustmentSignal.value = 15;
    clearOptimizationScenarios();
    clearOptimizationError();
    optimizationStatsSignal.value = null;

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    setLots([]);
    isOptimizingSignal.value = false;
    maxD0AdjustmentSignal.value = 15;
    clearOptimizationScenarios();
    clearOptimizationError();
    optimizationStatsSignal.value = null;
    vi.useRealTimers();
  });

  it('shows validation modal when lot name is empty', () => {
    act(() => {
      render(h(LotForm, {}), container);
    });

    const addButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Adicionar Lote')
    ) as HTMLButtonElement;
    click(addButton);

    expect(container.textContent).toContain('Por favor, insira um nome para o lote.');
    expect(lotsSignal.value).toHaveLength(0);
  });

  it('adds a lot and resets lot name field', () => {
    act(() => {
      render(h(LotForm, {}), container);
    });

    const nameInput = container.querySelector('#lotName') as HTMLInputElement;
    const addButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Adicionar Lote')
    ) as HTMLButtonElement;

    typeInput(nameInput, 'Lote Novo');
    click(addButton);

    expect(lotsSignal.value).toHaveLength(1);
    expect(lotsSignal.value[0]!.name).toBe('Lote Novo');
    expect(nameInput.value).toBe('');
  });

  it('calls optimizer service and stores scenarios on success', async () => {
    const lots = [createLot('lot-1', 5), createLot('lot-2', 6)];
    setLots(lots);

    const optimizeSpy = vi
      .spyOn(optimizerService, 'optimizeSchedule')
      .mockResolvedValueOnce({ scenarios: [createScenario(lots)], totalCombinations: 42 });

    act(() => {
      render(h(LotForm, {}), container);
    });

    const optimizeButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Otimizar Calendario')
    ) as HTMLButtonElement;

    click(optimizeButton);
    await act(async () => {
      await flushPromises();
    });

    expect(optimizeSpy).toHaveBeenCalledWith(lots, 15, 30000);
    expect(optimizationScenariosSignal.value).toHaveLength(1);
    expect(optimizationErrorSignal.value).toBeNull();
  });

  it('shows user-facing optimization error on failure', async () => {
    const lots = [createLot('lot-1', 5), createLot('lot-2', 6)];
    setLots(lots);

    vi.spyOn(optimizerService, 'optimizeSchedule').mockRejectedValueOnce(
      new OptimizationServiceError('OPTIMIZATION_TIMEOUT', 'timeout')
    );

    act(() => {
      render(h(LotForm, {}), container);
    });

    const optimizeButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Otimizar Calendario')
    ) as HTMLButtonElement;
    click(optimizeButton);

    await act(async () => {
      await flushPromises();
    });

    expect(optimizationErrorSignal.value?.code).toBe('OPTIMIZATION_TIMEOUT');
    expect(container.textContent).toContain('A otimizacao excedeu o tempo limite');
  });

  it('updates max D0 adjustment from range input', () => {
    setLots([createLot('lot-1', 5)]);

    act(() => {
      render(h(LotForm, {}), container);
    });

    const range = container.querySelector('#maxAdjustment') as HTMLInputElement;
    typeInput(range, '20');

    expect(maxD0AdjustmentSignal.value).toBe(20);
  });
});
