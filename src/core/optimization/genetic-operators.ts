import { Chromosome } from './types';

/**
 * Selecao por torneio
 */
export function tournamentSelection(
  population: Chromosome[],
  tournamentSize: number
): Chromosome {
  const tournament: Chromosome[] = [];

  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    tournament.push(population[idx]!);
  }

  return tournament.reduce((best, current) =>
    current.fitness > best.fitness ? current : best
  );
}

/**
 * Crossover de 2 pontos
 */
export function twoPointCrossover(
  parent1: Chromosome,
  parent2: Chromosome
): [Chromosome, Chromosome] {
  const len = parent1.genes.length;

  const point1 = Math.floor(Math.random() * len);
  const point2 = Math.floor(Math.random() * len);
  const [start, end] = [Math.min(point1, point2), Math.max(point1, point2)];

  const child1Genes = [
    ...parent1.genes.slice(0, start),
    ...parent2.genes.slice(start, end),
    ...parent1.genes.slice(end),
  ];

  const child2Genes = [
    ...parent2.genes.slice(0, start),
    ...parent1.genes.slice(start, end),
    ...parent2.genes.slice(end),
  ];

  return [
    { genes: child1Genes, fitness: 0 },
    { genes: child2Genes, fitness: 0 },
  ];
}

/**
 * Mutacao gaussiana
 */
export function gaussianMutation(
  chromosome: Chromosome,
  mutationRate: number,
  maxAdjustment: number
): void {
  for (const gene of chromosome.genes) {
    if (Math.random() < mutationRate) {
      const delta = Math.floor(Math.random() * 7) - 3;
      const newOffset = gene.d0Offset + delta;

      gene.d0Offset = Math.max(
        -maxAdjustment,
        Math.min(maxAdjustment, newOffset)
      );
    }
  }
}

/**
 * Criar cromossomo aleatorio
 */
export function createRandomChromosome(
  lotIds: string[],
  maxAdjustment: number
): Chromosome {
  const genes = lotIds.map((lotId) => ({
    lotId,
    d0Offset: Math.floor(Math.random() * (2 * maxAdjustment + 1)) - maxAdjustment,
  }));

  return { genes, fitness: 0 };
}
