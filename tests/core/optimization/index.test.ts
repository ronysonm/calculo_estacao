import { describe, expect, it } from 'vitest';
import * as optimization from '../../../src/core/optimization';

describe('core/optimization barrel exports', () => {
  it('re-exports public optimization APIs', () => {
    expect(optimization).toHaveProperty('GeneticScheduler');
    expect(optimization).toHaveProperty('CpSatScheduler');
    expect(optimization).toHaveProperty('optimizeWithHybridEngine');
    expect(optimization).toHaveProperty('calculateFitness');
    expect(optimization).toHaveProperty('nehInitialization');
    expect(optimization).toHaveProperty('selectDiverseTop4');
    expect(optimization).toHaveProperty('DEFAULT_GA_PARAMS');
  });
});
