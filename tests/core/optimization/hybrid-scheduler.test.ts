import { describe, expect, it } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';
import { optimizeWithHybridEngine } from '../../../src/core/optimization/hybrid-scheduler';
import { DEFAULT_GA_PARAMS, GeneticParams } from '../../../src/core/optimization/types';

function createLots(count: number): Lot[] {
  const protocol = Protocol.create('protocol-test', 'Protocolo Teste', [0, 7, 9], 'custom');

  return Array.from({ length: count }, (_, index) =>
    Lot.create(
      `lot-${index + 1}`,
      `Lote ${index + 1}`,
      DateOnly.create(2026, 1, 1 + index),
      protocol,
      [22, 22, 22]
    )
  );
}

function createParams(overrides: Partial<GeneticParams> = {}): GeneticParams {
  return {
    ...DEFAULT_GA_PARAMS,
    populationSize: 12,
    eliteSize: 3,
    attemptsPerProfile: 1,
    maxD0Adjustment: 1,
    timeLimitMs: 200,
    cpSatLotThreshold: 3,
    cpSatMaxEvaluationsPerProfile: 3000,
    cpSatTopCandidatesPerProfile: 2,
    ...overrides,
  };
}

describe('optimizeWithHybridEngine', () => {
  it('uses CP-SAT engine for small instances', async () => {
    const lots = createLots(2);
    const params = createParams();

    const result = await optimizeWithHybridEngine(lots, params);

    expect(result.engine).toBe('cp-sat');
    expect(result.scenarios).toHaveLength(4);
    expect(result.totalCombinations).toBeGreaterThan(0);
  });

  it('falls back to GA when instance exceeds CP-SAT threshold', async () => {
    const lots = createLots(5);
    const params = createParams({
      cpSatLotThreshold: 2,
      timeLimitMs: 40,
      minAttemptBudgetMs: 0,
      deadlineSafetyMs: 0,
    });

    const result = await optimizeWithHybridEngine(lots, params);

    expect(result.engine).toBe('ga');
    expect(result.scenarios).toHaveLength(4);
    expect(result.totalCombinations).toBeGreaterThan(0);
  });

  it('supports disabling CP-SAT explicitly', async () => {
    const lots = createLots(2);
    const params = createParams({
      enableCpSatForSmallInstances: false,
      timeLimitMs: 40,
      minAttemptBudgetMs: 0,
      deadlineSafetyMs: 0,
    });

    const result = await optimizeWithHybridEngine(lots, params);

    expect(result.engine).toBe('ga');
    expect(result.scenarios).toHaveLength(4);
  });
});
