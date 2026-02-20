import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearOptimizationError,
  clearOptimizationScenarios,
  isOptimizingSignal,
  maxD0AdjustmentSignal,
  optimizationErrorSignal,
  optimizationScenariosSignal,
  optimizationStatsSignal,
  setMaxD0Adjustment,
  setOptimizationError,
  setOptimizationScenarios,
} from '../../../src/state/signals/optimization';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';
import { OptimizationScenario } from '../../../src/domain/value-objects/OptimizationScenario';

function createScenario(): OptimizationScenario {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  const lot = Lot.create('lot-1', 'Lot 1', DateOnly.create(2026, 1, 1), protocol, [22, 22, 22]);

  return OptimizationScenario.create(
    'Balanceado',
    [lot],
    {
      sundaysRounds12: 0,
      sundaysRounds34: 0,
      overlapsRounds12: 0,
      overlapsRounds34: 0,
      totalCycleDays: 100,
      intervalViolations: 0,
    },
    0.95,
    'Cenario de teste'
  );
}

describe('optimization signals', () => {
  beforeEach(() => {
    isOptimizingSignal.value = false;
    optimizationScenariosSignal.value = [];
    optimizationStatsSignal.value = null;
    optimizationErrorSignal.value = null;
    maxD0AdjustmentSignal.value = 15;
  });

  it('sets and clears optimization scenarios with stats', () => {
    const scenario = createScenario();

    setOptimizationScenarios([scenario], { totalCombinations: 321 });

    expect(optimizationScenariosSignal.value).toHaveLength(1);
    expect(optimizationScenariosSignal.value[0]!.name).toBe('Balanceado');
    expect(optimizationStatsSignal.value).toEqual({ totalCombinations: 321 });

    clearOptimizationScenarios();
    expect(optimizationScenariosSignal.value).toEqual([]);
    expect(optimizationStatsSignal.value).toBeNull();
  });

  it('sets and clears optimization error state', () => {
    setOptimizationError({
      code: 'OPTIMIZATION_TIMEOUT',
      message: 'Tempo excedido',
      details: { timeoutMs: 30000 },
    });

    expect(optimizationErrorSignal.value).toMatchObject({
      code: 'OPTIMIZATION_TIMEOUT',
      message: 'Tempo excedido',
    });

    clearOptimizationError();
    expect(optimizationErrorSignal.value).toBeNull();
  });

  it('clamps max D0 adjustment between 1 and 30', () => {
    setMaxD0Adjustment(0);
    expect(maxD0AdjustmentSignal.value).toBe(1);

    setMaxD0Adjustment(31);
    expect(maxD0AdjustmentSignal.value).toBe(30);

    setMaxD0Adjustment(18);
    expect(maxD0AdjustmentSignal.value).toBe(18);
  });
});
