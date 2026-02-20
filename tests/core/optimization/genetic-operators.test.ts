import { describe, it, expect } from 'vitest';
import {
  createRandomChromosome,
  gaussianMutation,
  tournamentSelection,
  twoPointCrossover,
} from '../../../src/core/optimization/genetic-operators';
import { Chromosome } from '../../../src/core/optimization/types';

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
}

describe('createRandomChromosome', () => {
  it('creates deterministic chromosome when rng is injected', () => {
    const rng = sequenceRng([
      0.0, 0.9, // d0 offsets
      0.0, 0.5, 0.99, // gaps gene 1
      0.1, 0.6, 0.8, // gaps gene 2
    ]);

    const chromosome = createRandomChromosome(['lot1', 'lot2'], 10, rng);

    expect(chromosome.genes).toHaveLength(2);
    expect(chromosome.genes[0]!.d0Offset).toBe(-10);
    expect(chromosome.genes[1]!.d0Offset).toBe(10);
    expect(chromosome.genes[0]!.roundGaps).toEqual([23, 21, 22]);
    expect(chromosome.genes[1]!.roundGaps).toEqual([21, 22, 23]);
  });
});

describe('tournamentSelection', () => {
  it('selects the fittest chromosome inside deterministic tournament sample', () => {
    const rng = sequenceRng([0.4, 0.6, 0.3]);
    const population: Chromosome[] = [
      { genes: [], fitness: 0.2 },
      { genes: [], fitness: 0.9 },
      { genes: [], fitness: 0.5 },
    ];

    const selected = tournamentSelection(population, 3, rng);

    expect(selected.fitness).toBe(0.9);
  });
});

describe('twoPointCrossover', () => {
  it('exchanges deterministic middle segment', () => {
    const rng = sequenceRng([0.3, 0.8]);

    const parent1: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 0, roundGaps: [21, 21, 21] },
        { lotId: 'lot2', d0Offset: 1, roundGaps: [21, 21, 21] },
        { lotId: 'lot3', d0Offset: 2, roundGaps: [21, 21, 21] },
        { lotId: 'lot4', d0Offset: 3, roundGaps: [21, 21, 21] },
      ],
      fitness: 0,
    };

    const parent2: Chromosome = {
      genes: [
        { lotId: 'lot1', d0Offset: 10, roundGaps: [23, 23, 23] },
        { lotId: 'lot2', d0Offset: 11, roundGaps: [23, 23, 23] },
        { lotId: 'lot3', d0Offset: 12, roundGaps: [23, 23, 23] },
        { lotId: 'lot4', d0Offset: 13, roundGaps: [23, 23, 23] },
      ],
      fitness: 0,
    };

    const [child1, child2] = twoPointCrossover(parent1, parent2, rng);

    expect(child1.genes.map((g) => g.d0Offset)).toEqual([0, 11, 12, 3]);
    expect(child2.genes.map((g) => g.d0Offset)).toEqual([10, 1, 2, 13]);
  });
});

describe('gaussianMutation', () => {
  it('applies deterministic mutations with injected rng', () => {
    const rng = sequenceRng([
      0.4, 0.95, // d0 mutation check + delta
      0.2, 0.0, // gap 1 check + value
      0.7, 0.49, // gap 2 check + value
      0.3, 0.99, // gap 3 check + value
    ]);

    const chromosome: Chromosome = {
      genes: [{ lotId: 'lot1', d0Offset: 0, roundGaps: [22, 22, 22] }],
      fitness: 0,
    };

    gaussianMutation(chromosome, 1.0, 15, rng);

    expect(chromosome.genes[0]!.d0Offset).toBe(3);
    expect(chromosome.genes[0]!.roundGaps).toEqual([21, 22, 23]);
  });

  it('does not mutate when mutationRate is zero', () => {
    const chromosome: Chromosome = {
      genes: [{ lotId: 'lot1', d0Offset: 5, roundGaps: [21, 22, 23] }],
      fitness: 0,
    };

    gaussianMutation(chromosome, 0, 15, sequenceRng([0.1, 0.2, 0.3]));

    expect(chromosome.genes[0]!.d0Offset).toBe(5);
    expect(chromosome.genes[0]!.roundGaps).toEqual([21, 22, 23]);
  });
});

describe('operators integration', () => {
  it('keeps chromosome integrity across deterministic ga operations', () => {
    const rng = sequenceRng([
      0.0, 0.1, 0.2, 0.3, 0.4, 0.5,
      0.6, 0.7, 0.8, 0.9, 0.15, 0.25,
    ]);

    const population: Chromosome[] = [
      createRandomChromosome(['lot1', 'lot2', 'lot3'], 10, rng),
      createRandomChromosome(['lot1', 'lot2', 'lot3'], 10, rng),
      createRandomChromosome(['lot1', 'lot2', 'lot3'], 10, rng),
    ];

    population[0]!.fitness = 0.2;
    population[1]!.fitness = 0.8;
    population[2]!.fitness = 0.5;

    const parent1 = tournamentSelection(population, 3, rng);
    const parent2 = tournamentSelection(population, 3, rng);
    const [child1, child2] = twoPointCrossover(parent1, parent2, rng);

    gaussianMutation(child1, 0.5, 10, rng);
    gaussianMutation(child2, 0.5, 10, rng);

    for (const child of [child1, child2]) {
      expect(child.genes).toHaveLength(3);
      expect(child.genes[0]!.lotId).toBe('lot1');
      expect(child.genes[1]!.lotId).toBe('lot2');
      expect(child.genes[2]!.lotId).toBe('lot3');
    }
  });
});
