import { describe, expect, it } from 'vitest';
import { GeneticScheduler } from '../../../src/core/optimization/genetic-scheduler';
import { DEFAULT_GA_PARAMS, GeneticParams } from '../../../src/core/optimization/types';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0.5;
    index += 1;
    return value;
  };
}

function createLots(): Lot[] {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  return [
    Lot.create('lot-1', 'Lote 1', DateOnly.create(2026, 1, 1), protocol, [22, 22, 22]),
    Lot.create('lot-2', 'Lote 2', DateOnly.create(2026, 1, 3), protocol, [22, 22, 22]),
  ];
}

function buildParams(overrides: Partial<GeneticParams> = {}): GeneticParams {
  return {
    ...DEFAULT_GA_PARAMS,
    populationSize: 8,
    eliteSize: 2,
    attemptsPerProfile: 2,
    timeLimitMs: 150,
    minAttemptBudgetMs: 20,
    deadlineSafetyMs: 10,
    rng: sequenceRng([0.1, 0.6, 0.3, 0.8, 0.2, 0.9, 0.4, 0.7]),
    ...overrides,
  };
}

describe('GeneticScheduler', () => {
  it('returns before configured deadline budget window', async () => {
    const scheduler = new GeneticScheduler(createLots(), buildParams({ timeLimitMs: 120 }));

    const start = Date.now();
    const result = await scheduler.optimize();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThanOrEqual(700);
    expect(result.scenarios).toHaveLength(4);
  });

  it('exits gracefully when remaining budget is too low for a new attempt', async () => {
    const scheduler = new GeneticScheduler(
      createLots(),
      buildParams({
        timeLimitMs: 10,
        minAttemptBudgetMs: 100,
        deadlineSafetyMs: 5,
      })
    );

    const result = await scheduler.optimize();

    expect(result.scenarios).toHaveLength(4);
  });

  it('returns baseline fallback scenario on early stop', async () => {
    const lots = createLots();
    const scheduler = new GeneticScheduler(
      lots,
      buildParams({
        timeLimitMs: 10,
        minAttemptBudgetMs: 100,
        deadlineSafetyMs: 5,
      })
    );

    const result = await scheduler.optimize();

    const hasBaseline = result.scenarios.some((scenario) =>
      scenario.lots.every((lot, index) => lot.equals(lots[index]!))
    );
    expect(hasBaseline).toBe(true);
  });

  it('reports totalCombinations as the exact number of evaluations', async () => {
    const scheduler = new GeneticScheduler(
      createLots(),
      buildParams({
        timeLimitMs: 10,
        minAttemptBudgetMs: 100,
        deadlineSafetyMs: 5,
      })
    );

    const result = await scheduler.optimize();

    expect(result.totalCombinations).toBe(4);
  });

  it('labels scenarios as Pareto solutions', async () => {
    const scheduler = new GeneticScheduler(createLots(), buildParams({ timeLimitMs: 120 }));

    const result = await scheduler.optimize();

    expect(result.scenarios).toHaveLength(4);
    for (const [index, scenario] of result.scenarios.entries()) {
      expect(scenario.name).toBe(`Pareto ${index + 1}`);
    }
  });

  it('supports memetic step disabled by configuration', async () => {
    const scheduler = new GeneticScheduler(
      createLots(),
      buildParams({
        memeticIntervalGenerations: 0,
        timeLimitMs: 120,
      })
    );

    const result = await scheduler.optimize();

    expect(result.scenarios).toHaveLength(4);
    expect(result.totalCombinations).toBeGreaterThan(0);
  });
});
