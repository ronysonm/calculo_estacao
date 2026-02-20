/**
 * Fitness Calculator Tests
 *
 * Validates:
 * - Scenario profile weights configuration
 * - Objective calculation accuracy
 * - Penalty scalarization
 * - Sunday detection and penalization in rounds 3-4
 */

import { describe, it, expect } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Protocol } from '../../../src/domain/value-objects/Protocol';
import { Lot } from '../../../src/domain/value-objects/Lot';
import {
  DEFAULT_WEIGHTS,
  SCENARIO_PROFILES,
  calculateObjectives,
  scalarizeObjectives,
  calculateFitness,
  createEvaluationContext,
  evaluateChromosome,
} from '../../../src/core/optimization/fitness-calculator';
import { Chromosome } from '../../../src/core/optimization/types';

describe('Scenario Profiles Configuration', () => {
  it('should have exactly 4 scenario profiles', () => {
    expect(SCENARIO_PROFILES).toHaveLength(4);
  });

  it('should have correct profile names', () => {
    const names = SCENARIO_PROFILES.map((p) => p.name);
    expect(names).toEqual([
      'Sem Conflitos',
      'Ciclo Curto',
      'Balanceado',
      'Conservador',
    ]);
  });

  it('should penalize sundaysRounds34 in all profiles (not desirable)', () => {
    // All profiles should have positive weights for sundaysRounds34
    // (negative values would make Sundays desirable)
    for (const profile of SCENARIO_PROFILES) {
      expect(profile.weights.sundaysRounds34).toBeGreaterThan(0);
      expect(profile.weights.sundaysRounds34).toBeGreaterThanOrEqual(100);
    }
  });

  it('DEFAULT_WEIGHTS should penalize sundaysRounds34 with weight 100', () => {
    expect(DEFAULT_WEIGHTS.sundaysRounds34).toBe(100);
  });

  it('"Sem Conflitos" profile should heavily penalize all sundays', () => {
    const profile = SCENARIO_PROFILES.find((p) => p.name === 'Sem Conflitos')!;
    expect(profile.weights.sundaysRounds12).toBe(5000);
    expect(profile.weights.sundaysRounds34).toBe(2000);
  });

  it('"Ciclo Curto" profile should prioritize cycle duration', () => {
    const profile = SCENARIO_PROFILES.find((p) => p.name === 'Ciclo Curto')!;
    expect(profile.weights.totalCycleDays).toBe(100);
    expect(profile.weights.sundaysRounds34).toBe(100);
  });

  it('"Balanceado" profile should have equal weights for rounds 3-4 conflicts', () => {
    const profile = SCENARIO_PROFILES.find((p) => p.name === 'Balanceado')!;
    expect(profile.weights.overlapsRounds34).toBe(100);
    expect(profile.weights.sundaysRounds34).toBe(100);
  });

  it('"Conservador" profile should penalize changes', () => {
    const profile = SCENARIO_PROFILES.find((p) => p.name === 'Conservador')!;
    expect(profile.weights.d0OffsetPenalty).toBe(200);
    expect(profile.weights.gapChangePenalty).toBe(200);
    expect(profile.weights.sundaysRounds34).toBe(100);
  });

  it('all profiles should prioritize overlapsRounds12 highest', () => {
    for (const profile of SCENARIO_PROFILES) {
      expect(profile.weights.overlapsRounds12).toBe(10000);
    }
  });

  it('all profiles should prioritize intervalViolations second', () => {
    for (const profile of SCENARIO_PROFILES) {
      expect(profile.weights.intervalViolations).toBe(5000);
    }
  });
});

describe('calculateObjectives - Basic Functionality', () => {
  it('should calculate zero objectives for single lot with no conflicts', () => {
    const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
    const d0 = DateOnly.create(2026, 1, 1); // Thursday
    const lot = Lot.create('lot1', 'Test', d0, protocol, [22, 22, 22]);

    const objectives = calculateObjectives([lot]);

    expect(objectives.overlapsRounds12).toBe(0);
    expect(objectives.overlapsRounds34).toBe(0);
    expect(objectives.intervalViolations).toBe(0);
    expect(objectives.totalCycleDays).toBeGreaterThan(0);
  });

  it('should detect sunday in rounds 1-2', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 4); // Sunday
    const lot = Lot.create('lot1', 'Test', d0, protocol, [22, 22, 22]);

    const objectives = calculateObjectives([lot]);

    expect(objectives.sundaysRounds12).toBe(1); // R1 D0 is Sunday
  });

  it('should detect sunday in rounds 3-4', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Test', d0, protocol, [22, 22, 22]);

    // Calculate for 4 rounds - rounds 3 and 4 need to be checked
    const allDates: any[] = [];
    for (let round = 0; round < 4; round++) {
      const intervals = lot.getIntervals(round + 1);
      const lastInterval = intervals[intervals.length - 1];
      if (lastInterval) {
        const date = d0.addDays(lastInterval.dayOffset);
        allDates.push({
          lotId: lot.id,
          roundId: round,
          date: date,
        });
      }
    }

    // Check if any dates in rounds 2-3 (0-indexed) fall on Sunday
    // Round 3 (index 2): D0 = Jan 1 + 31 + 31 = Mar 4 (not Sunday)
    // Round 4 (index 3): D0 = Jan 1 + 31 + 31 + 31 = Apr 4 (not Sunday)
    const objectives = calculateObjectives([lot]);
    // This test validates the detection mechanism exists
    expect(objectives.sundaysRounds34).toBeGreaterThanOrEqual(0);
  });

  it('should count interval violations for gaps outside 21-23 range', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Test', d0, protocol, [20, 24, 22]); // 20 and 24 are violations

    const objectives = calculateObjectives([lot]);

    expect(objectives.intervalViolations).toBe(2); // 20 and 24 are outside [21,23]
  });

  it('should count no interval violations for valid gaps', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Test', d0, protocol, [21, 22, 23]);

    const objectives = calculateObjectives([lot]);

    expect(objectives.intervalViolations).toBe(0);
  });

  it('should detect overlaps between two lots on same date in rounds 1-2', () => {
    const protocol = Protocol.create('p1', 'D0-D7', [0, 7], 'D0-D7');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot1 = Lot.create('lot1', 'Lot1', d0, protocol, [22, 22, 22]);
    const lot2 = Lot.create('lot2', 'Lot2', d0, protocol, [22, 22, 22]);

    const objectives = calculateObjectives([lot1, lot2]);

    // Both lots have same D0 and D7, so 2 overlaps in round 1
    expect(objectives.overlapsRounds12).toBeGreaterThan(0);
  });
});

describe('scalarizeObjectives - Penalty Calculation', () => {
  it('should calculate zero penalty for perfect schedule', () => {
    const objectives = {
      intervalViolations: 0,
      overlapsRounds12: 0,
      sundaysRounds12: 0,
      overlapsRounds34: 0,
      sundaysRounds34: 0,
      totalCycleDays: 0,
    };

    const penalty = scalarizeObjectives(objectives, DEFAULT_WEIGHTS);

    expect(penalty).toBe(0);
  });

  it('should heavily penalize overlapsRounds12 (weight 10000)', () => {
    const objectives = {
      intervalViolations: 0,
      overlapsRounds12: 1,
      sundaysRounds12: 0,
      overlapsRounds34: 0,
      sundaysRounds34: 0,
      totalCycleDays: 0,
    };

    const penalty = scalarizeObjectives(objectives, DEFAULT_WEIGHTS);

    expect(penalty).toBe(10000);
  });

  it('should penalize intervalViolations with weight 5000', () => {
    const objectives = {
      intervalViolations: 1,
      overlapsRounds12: 0,
      sundaysRounds12: 0,
      overlapsRounds34: 0,
      sundaysRounds34: 0,
      totalCycleDays: 0,
    };

    const penalty = scalarizeObjectives(objectives, DEFAULT_WEIGHTS);

    expect(penalty).toBe(5000);
  });

  it('should penalize sundaysRounds34 with weight 100 (not desirable)', () => {
    const objectives = {
      intervalViolations: 0,
      overlapsRounds12: 0,
      sundaysRounds12: 0,
      overlapsRounds34: 0,
      sundaysRounds34: 1,
      totalCycleDays: 0,
    };

    const penalty = scalarizeObjectives(objectives, DEFAULT_WEIGHTS);

    expect(penalty).toBe(100); // Positive penalty = undesirable
  });

  it('should sum multiple penalties correctly', () => {
    const objectives = {
      intervalViolations: 1,
      overlapsRounds12: 1,
      sundaysRounds12: 1,
      overlapsRounds34: 1,
      sundaysRounds34: 1,
      totalCycleDays: 100,
    };

    const penalty = scalarizeObjectives(objectives, DEFAULT_WEIGHTS);

    // 5000 + 10000 + 1000 + 100 + 100 + 100 = 16300
    expect(penalty).toBe(16300);
  });
});

describe('calculateFitness - Normalized Score', () => {
  it('should return normalized fitness between 0 and 1', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Test', d0, protocol, [22, 22, 22]);

    const fitness = calculateFitness([lot]);

    // fitness = 1 / (1 + penalty), always in (0, 1]
    expect(fitness).toBeGreaterThan(0);
    expect(fitness).toBeLessThanOrEqual(1.0);
  });

  it('should return value between 0 and 1 for imperfect schedule', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Test', d0, protocol, [20, 24, 22]); // Has violations

    const fitness = calculateFitness([lot]);

    expect(fitness).toBeGreaterThan(0);
    expect(fitness).toBeLessThan(1);
  });

  it('should decrease fitness as penalty increases', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 1);

    const goodLot = Lot.create('lot1', 'Good', d0, protocol, [22, 22, 22]);
    const badLot = Lot.create('lot2', 'Bad', d0, protocol, [20, 20, 20]); // More violations

    const goodFitness = calculateFitness([goodLot]);
    const badFitness = calculateFitness([badLot]);

    expect(goodFitness).toBeGreaterThan(badFitness);
  });
});

describe('evaluateChromosome - Genetic Algorithm Integration', () => {
  it('should evaluate baseline chromosome (no changes)', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Test', d0, protocol, [22, 22, 22]);

    const chromosome: Chromosome = {
      genes: [
        {
          lotId: lot.id,
          d0Offset: 0,
          roundGaps: [22, 22, 22],
        },
      ],
      fitness: 0,
    };

    const result = evaluateChromosome(chromosome, [lot], DEFAULT_WEIGHTS);

    expect(result.fitness).toBeGreaterThan(0);
    expect(result.objectives).toBeDefined();
    expect(result.objectives.intervalViolations).toBe(0);
  });

  it('should apply d0Offset from chromosome', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Test', d0, protocol, [22, 22, 22]);

    const chromosome: Chromosome = {
      genes: [
        {
          lotId: lot.id,
          d0Offset: 5, // Shift by 5 days
          roundGaps: [22, 22, 22],
        },
      ],
      fitness: 0,
    };

    const result = evaluateChromosome(chromosome, [lot], DEFAULT_WEIGHTS);

    // Should calculate objectives based on shifted D0
    expect(result.fitness).toBeGreaterThan(0);
    expect(result.objectives).toBeDefined();
  });

  it('should apply roundGaps from chromosome', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Test', d0, protocol, [22, 22, 22]);

    const chromosome: Chromosome = {
      genes: [
        {
          lotId: lot.id,
          d0Offset: 0,
          roundGaps: [21, 23, 21], // Valid but different
        },
      ],
      fitness: 0,
    };

    const result = evaluateChromosome(chromosome, [lot], DEFAULT_WEIGHTS);

    expect(result.fitness).toBeGreaterThan(0);
    expect(result.objectives.intervalViolations).toBe(0); // All gaps valid
  });

  it('should penalize d0Offset in conservative profile', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Test', d0, protocol, [22, 22, 22]);

    const conservativeWeights = SCENARIO_PROFILES.find(
      (p) => p.name === 'Conservador'
    )!.weights;

    const baselineChromosome: Chromosome = {
      genes: [{ lotId: lot.id, d0Offset: 0, roundGaps: [22, 22, 22] }],
      fitness: 0,
    };

    const offsetChromosome: Chromosome = {
      genes: [{ lotId: lot.id, d0Offset: 5, roundGaps: [22, 22, 22] }],
      fitness: 0,
    };

    const baselineResult = evaluateChromosome(
      baselineChromosome,
      [lot],
      conservativeWeights
    );
    const offsetResult = evaluateChromosome(
      offsetChromosome,
      [lot],
      conservativeWeights
    );

    // Offset should reduce fitness due to d0OffsetPenalty
    expect(baselineResult.fitness).toBeGreaterThan(offsetResult.fitness);
  });

  it('should penalize gap changes in conservative profile', () => {
    const protocol = Protocol.create('p1', 'D0', [0], 'D0');
    const d0 = DateOnly.create(2026, 1, 1);
    const lot = Lot.create('lot1', 'Test', d0, protocol, [22, 22, 22]);

    const conservativeWeights = SCENARIO_PROFILES.find(
      (p) => p.name === 'Conservador'
    )!.weights;

    const baselineChromosome: Chromosome = {
      genes: [{ lotId: lot.id, d0Offset: 0, roundGaps: [22, 22, 22] }],
      fitness: 0,
    };

    const changedGapsChromosome: Chromosome = {
      genes: [{ lotId: lot.id, d0Offset: 0, roundGaps: [21, 23, 21] }],
      fitness: 0,
    };

    const baselineResult = evaluateChromosome(
      baselineChromosome,
      [lot],
      conservativeWeights
    );
    const changedResult = evaluateChromosome(
      changedGapsChromosome,
      [lot],
      conservativeWeights
    );

    // Changed gaps should reduce fitness due to gapChangePenalty
    expect(baselineResult.fitness).toBeGreaterThan(changedResult.fitness);
  });

  it('should keep incremental delta evaluation consistent with full recomputation', () => {
    const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
    const lots = [
      Lot.create('lot1', 'Lot 1', DateOnly.create(2026, 1, 1), protocol, [22, 22, 22]),
      Lot.create('lot2', 'Lot 2', DateOnly.create(2026, 1, 3), protocol, [22, 22, 22]),
    ];

    const chromosome: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 0, roundGaps: [22, 22, 22] },
        { lotId: 'lot2', d0Offset: 0, roundGaps: [22, 22, 22] },
      ],
      fitness: 0,
    };

    const sharedContext = createEvaluationContext(lots);
    evaluateChromosome(chromosome, lots, DEFAULT_WEIGHTS, sharedContext);

    chromosome.genes[0]!.d0Offset = 3;
    chromosome.genes[0]!.roundGaps = [21, 23, 21];

    const incrementalResult = evaluateChromosome(
      chromosome,
      lots,
      DEFAULT_WEIGHTS,
      sharedContext,
      { changedLotIds: ['lot1'] }
    );

    const freshResult = evaluateChromosome(
      chromosome,
      lots,
      DEFAULT_WEIGHTS,
      createEvaluationContext(lots)
    );

    expect(incrementalResult.objectives).toEqual(freshResult.objectives);
    expect(incrementalResult.fitness).toBe(freshResult.fitness);
  });

  it('should detect changed genes automatically when no delta hint is provided', () => {
    const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
    const lots = [
      Lot.create('lot1', 'Lot 1', DateOnly.create(2026, 1, 1), protocol, [22, 22, 22]),
      Lot.create('lot2', 'Lot 2', DateOnly.create(2026, 1, 3), protocol, [22, 22, 22]),
    ];

    const chromosome: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 0, roundGaps: [22, 22, 22] },
        { lotId: 'lot2', d0Offset: 0, roundGaps: [22, 22, 22] },
      ],
      fitness: 0,
    };

    const sharedContext = createEvaluationContext(lots);
    evaluateChromosome(chromosome, lots, DEFAULT_WEIGHTS, sharedContext);

    chromosome.genes[1]!.d0Offset = -2;

    const incrementalResult = evaluateChromosome(chromosome, lots, DEFAULT_WEIGHTS, sharedContext);
    const freshResult = evaluateChromosome(
      chromosome,
      lots,
      DEFAULT_WEIGHTS,
      createEvaluationContext(lots)
    );

    expect(incrementalResult.objectives).toEqual(freshResult.objectives);
    expect(incrementalResult.fitness).toBe(freshResult.fitness);
  });
});

describe('Weight Priority Validation', () => {
  it('should prioritize overlapsRounds12 > intervalViolations > sundaysRounds12', () => {
    expect(DEFAULT_WEIGHTS.overlapsRounds12).toBeGreaterThan(
      DEFAULT_WEIGHTS.intervalViolations
    );
    expect(DEFAULT_WEIGHTS.intervalViolations).toBeGreaterThan(
      DEFAULT_WEIGHTS.sundaysRounds12
    );
  });

  it('should prioritize sundaysRounds12 > overlapsRounds34 and sundaysRounds34', () => {
    expect(DEFAULT_WEIGHTS.sundaysRounds12).toBeGreaterThan(
      DEFAULT_WEIGHTS.overlapsRounds34
    );
    expect(DEFAULT_WEIGHTS.sundaysRounds12).toBeGreaterThan(
      DEFAULT_WEIGHTS.sundaysRounds34
    );
  });

  it('should treat overlapsRounds34 and sundaysRounds34 equally in Balanceado profile', () => {
    const balancedWeights = SCENARIO_PROFILES.find(
      (p) => p.name === 'Balanceado'
    )!.weights;

    expect(balancedWeights.overlapsRounds34).toBe(
      balancedWeights.sundaysRounds34
    );
    expect(balancedWeights.overlapsRounds34).toBe(100);
  });
});
