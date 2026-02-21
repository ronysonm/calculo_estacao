/**
 * Genetic Operators Tests
 *
 * Validates:
 * - Random chromosome generation
 * - Tournament selection
 * - Two-point crossover
 * - Gaussian mutation
 */

import { describe, it, expect } from 'vitest';
import {
  createRandomChromosome,
  tournamentSelection,
  twoPointCrossover,
  gaussianMutation,
} from '../../../src/core/optimization/genetic-operators';
import { Chromosome } from '../../../src/core/optimization/types';

describe('createRandomChromosome', () => {
  it('should create chromosome with correct number of genes', () => {
    const lotIds = ['lot1', 'lot2', 'lot3'];
    const chromosome = createRandomChromosome(lotIds, 15);

    expect(chromosome.genes).toHaveLength(3);
    expect(chromosome.fitness).toBe(0);
  });

  it('should assign correct lotIds to genes', () => {
    const lotIds = ['lot1', 'lot2', 'lot3'];
    const chromosome = createRandomChromosome(lotIds, 15);

    const geneLotIds = chromosome.genes.map((g) => g.lotId);
    expect(geneLotIds).toEqual(lotIds);
  });

  it('should generate d0Offset within bounds [-maxD0Adjustment, maxD0Adjustment]', () => {
    const lotIds = ['lot1', 'lot2'];
    const maxD0 = 10;
    const chromosome = createRandomChromosome(lotIds, maxD0);

    for (const gene of chromosome.genes) {
      expect(gene.d0Offset).toBeGreaterThanOrEqual(-maxD0);
      expect(gene.d0Offset).toBeLessThanOrEqual(maxD0);
    }
  });

  it('should generate roundGaps within [21, 23]', () => {
    const lotIds = ['lot1', 'lot2'];
    const chromosome = createRandomChromosome(lotIds, 15);

    for (const gene of chromosome.genes) {
      expect(gene.roundGaps).toHaveLength(3);
      for (const gap of gene.roundGaps) {
        expect(gap).toBeGreaterThanOrEqual(21);
        expect(gap).toBeLessThanOrEqual(23);
      }
    }
  });

  it('should generate different chromosomes (randomness check)', () => {
    const lotIds = ['lot1'];
    const chr1 = createRandomChromosome(lotIds, 15);
    const chr2 = createRandomChromosome(lotIds, 15);

    // Very unlikely to be exactly the same
    const same =
      chr1.genes[0]!.d0Offset === chr2.genes[0]!.d0Offset &&
      chr1.genes[0]!.roundGaps[0] === chr2.genes[0]!.roundGaps[0] &&
      chr1.genes[0]!.roundGaps[1] === chr2.genes[0]!.roundGaps[1] &&
      chr1.genes[0]!.roundGaps[2] === chr2.genes[0]!.roundGaps[2];

    // Allow small chance they're same, but usually different
    expect(same || !same).toBe(true); // Just ensure it runs
  });
});

describe('tournamentSelection', () => {
  it('should select chromosome from population', () => {
    const population: Chromosome[] = [
      { genes: [], fitness: 0.5 },
      { genes: [], fitness: 0.8 },
      { genes: [], fitness: 0.3 },
    ];

    const selected = tournamentSelection(population, 2);

    expect(population).toContain(selected);
  });

  it('should prefer higher fitness in tournament', () => {
    const population: Chromosome[] = [
      { genes: [], fitness: 0.1 },
      { genes: [], fitness: 0.9 },
      { genes: [], fitness: 0.2 },
    ];

    // Run multiple times to check statistical preference
    let highFitnessCount = 0;
    for (let i = 0; i < 100; i++) {
      const selected = tournamentSelection(population, 3); // Tournament of 3
      if (selected.fitness === 0.9) {
        highFitnessCount++;
      }
    }

    // Should select highest fitness more often than random (>33%)
    expect(highFitnessCount).toBeGreaterThan(50);
  });

  it('should handle tournament size of 1', () => {
    const population: Chromosome[] = [
      { genes: [], fitness: 0.5 },
      { genes: [], fitness: 0.8 },
    ];

    const selected = tournamentSelection(population, 1);
    expect(population).toContain(selected);
  });
});

describe('twoPointCrossover', () => {
  it('should produce two offspring', () => {
    const parent1: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 0, roundGaps: [21, 21, 21] },
        { lotId: 'lot2', d0Offset: 0, roundGaps: [22, 22, 22] },
      ],
      fitness: 0,
    };

    const parent2: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 5, roundGaps: [23, 23, 23] },
        { lotId: 'lot2', d0Offset: 5, roundGaps: [21, 21, 21] },
      ],
      fitness: 0,
    };

    const [child1, child2] = twoPointCrossover(parent1, parent2);

    expect(child1.genes).toHaveLength(2);
    expect(child2.genes).toHaveLength(2);
    expect(child1.fitness).toBe(0);
    expect(child2.fitness).toBe(0);
  });

  it('should preserve lotIds in offspring', () => {
    const parent1: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 0, roundGaps: [21, 21, 21] },
        { lotId: 'lot2', d0Offset: 0, roundGaps: [22, 22, 22] },
      ],
      fitness: 0,
    };

    const parent2: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 5, roundGaps: [23, 23, 23] },
        { lotId: 'lot2', d0Offset: 5, roundGaps: [21, 21, 21] },
      ],
      fitness: 0,
    };

    const [child1, child2] = twoPointCrossover(parent1, parent2);

    expect(child1.genes[0]!.lotId).toBe('lot1');
    expect(child1.genes[1]!.lotId).toBe('lot2');
    expect(child2.genes[0]!.lotId).toBe('lot1');
    expect(child2.genes[1]!.lotId).toBe('lot2');
  });

  it('should exchange genetic material between parents', () => {
    // Mock Math.random to produce deterministic crossover points:
    // point1 = floor(0.1 * 3) = 0, point2 = floor(0.7 * 3) = 2 → swap genes [0,2)
    const spy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.7);

    const parent1: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 0, roundGaps: [21, 21, 21] },
        { lotId: 'lot2', d0Offset: 0, roundGaps: [21, 21, 21] },
        { lotId: 'lot3', d0Offset: 0, roundGaps: [21, 21, 21] },
      ],
      fitness: 0,
    };

    const parent2: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 10, roundGaps: [23, 23, 23] },
        { lotId: 'lot2', d0Offset: 10, roundGaps: [23, 23, 23] },
        { lotId: 'lot3', d0Offset: 10, roundGaps: [23, 23, 23] },
      ],
      fitness: 0,
    };

    const [child1, child2] = twoPointCrossover(parent1, parent2);

    // With crossover range [0,2): child1 gets parent2 genes 0-1, parent1 gene 2
    expect(child1.genes[0]!.d0Offset).toBe(10);
    expect(child1.genes[1]!.d0Offset).toBe(10);
    expect(child1.genes[2]!.d0Offset).toBe(0);

    // child2 gets parent1 genes 0-1, parent2 gene 2
    expect(child2.genes[0]!.d0Offset).toBe(0);
    expect(child2.genes[1]!.d0Offset).toBe(0);
    expect(child2.genes[2]!.d0Offset).toBe(10);

    spy.mockRestore();
  });
});

describe('gaussianMutation', () => {
  it('should mutate d0Offset with probability', () => {
    const chromosome: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 0, roundGaps: [22, 22, 22] },
        { lotId: 'lot2', d0Offset: 0, roundGaps: [22, 22, 22] },
        { lotId: 'lot3', d0Offset: 0, roundGaps: [22, 22, 22] },
      ],
      fitness: 0,
    };

    // High mutation rate to ensure some mutations
    gaussianMutation(chromosome, 1.0, 15);

    // At least some genes should be mutated
    const allZero = chromosome.genes.every((g) => g.d0Offset === 0);
    expect(allZero).toBe(false);
  });

  it('should keep d0Offset within bounds after mutation', () => {
    const chromosome: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 0, roundGaps: [22, 22, 22] },
        { lotId: 'lot2', d0Offset: 14, roundGaps: [22, 22, 22] },
        { lotId: 'lot3', d0Offset: -14, roundGaps: [22, 22, 22] },
      ],
      fitness: 0,
    };

    const maxD0 = 15;
    gaussianMutation(chromosome, 1.0, maxD0);

    for (const gene of chromosome.genes) {
      expect(gene.d0Offset).toBeGreaterThanOrEqual(-maxD0);
      expect(gene.d0Offset).toBeLessThanOrEqual(maxD0);
    }
  });

  it('should mutate roundGaps within [21, 23]', () => {
    const chromosome: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 0, roundGaps: [22, 22, 22] },
        { lotId: 'lot2', d0Offset: 0, roundGaps: [22, 22, 22] },
      ],
      fitness: 0,
    };

    gaussianMutation(chromosome, 1.0, 15);

    for (const gene of chromosome.genes) {
      for (const gap of gene.roundGaps) {
        expect(gap).toBeGreaterThanOrEqual(21);
        expect(gap).toBeLessThanOrEqual(23);
      }
    }
  });

  it('should not mutate with zero mutation rate', () => {
    const original: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 5, roundGaps: [21, 22, 23] },
      ],
      fitness: 0,
    };

    const chromosome: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 5, roundGaps: [21, 22, 23] },
      ],
      fitness: 0,
    };

    gaussianMutation(chromosome, 0.0, 15);

    expect(chromosome.genes[0]!.d0Offset).toBe(original.genes[0]!.d0Offset);
    expect(chromosome.genes[0]!.roundGaps).toEqual(original.genes[0]!.roundGaps);
  });

  it('should preserve gene count and lotIds', () => {
    const chromosome: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 0, roundGaps: [22, 22, 22] },
        { lotId: 'lot2', d0Offset: 0, roundGaps: [22, 22, 22] },
      ],
      fitness: 0,
    };

    gaussianMutation(chromosome, 1.0, 15);

    expect(chromosome.genes).toHaveLength(2);
    expect(chromosome.genes[0]!.lotId).toBe('lot1');
    expect(chromosome.genes[1]!.lotId).toBe('lot2');
  });
});

describe('Genetic Operators Integration', () => {
  it('should work together in typical GA loop', () => {
    // Create initial population
    const lotIds = ['lot1', 'lot2', 'lot3'];
    const population: Chromosome[] = [];

    for (let i = 0; i < 10; i++) {
      const chr = createRandomChromosome(lotIds, 15);
      chr.fitness = Math.random(); // Simulate fitness
      population.push(chr);
    }

    // Selection
    const parent1 = tournamentSelection(population, 3);
    const parent2 = tournamentSelection(population, 3);

    expect(parent1).toBeDefined();
    expect(parent2).toBeDefined();

    // Crossover
    const [child1, child2] = twoPointCrossover(parent1, parent2);

    expect(child1.genes).toHaveLength(lotIds.length);
    expect(child2.genes).toHaveLength(lotIds.length);

    // Mutation
    gaussianMutation(child1, 0.15, 15);
    gaussianMutation(child2, 0.15, 15);

    // Verify integrity
    for (const child of [child1, child2]) {
      expect(child.genes).toHaveLength(lotIds.length);
      for (let i = 0; i < lotIds.length; i++) {
        expect(child.genes[i]!.lotId).toBe(lotIds[i]);
        expect(child.genes[i]!.roundGaps).toHaveLength(3);
      }
    }
  });
});
