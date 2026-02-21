import { Chromosome, Gene } from './types';
import { MIN_ROUND_GAP, MAX_ROUND_GAP } from '@/domain/constants';

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
 * Clona um gene (deep copy incluindo roundGaps)
 */
function cloneGene(g: Gene): Gene {
  return { lotId: g.lotId, d0Offset: g.d0Offset, roundGaps: [...g.roundGaps] };
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
    ...parent1.genes.slice(0, start).map(cloneGene),
    ...parent2.genes.slice(start, end).map(cloneGene),
    ...parent1.genes.slice(end).map(cloneGene),
  ];

  const child2Genes = [
    ...parent2.genes.slice(0, start).map(cloneGene),
    ...parent1.genes.slice(start, end).map(cloneGene),
    ...parent2.genes.slice(end).map(cloneGene),
  ];

  return [
    { genes: child1Genes, fitness: 0 },
    { genes: child2Genes, fitness: 0 },
  ];
}

/**
 * Mutacao gaussiana (D0 offset + round gaps)
 */
export function gaussianMutation(
  chromosome: Chromosome,
  mutationRate: number,
  maxAdjustment: number
): void {
  for (const gene of chromosome.genes) {
    // Mutar d0Offset
    if (Math.random() < mutationRate) {
      const delta = Math.floor(Math.random() * 7) - 3;
      const newOffset = gene.d0Offset + delta;

      gene.d0Offset = Math.max(
        -maxAdjustment,
        Math.min(maxAdjustment, newOffset)
      );
    }

    // Mutar cada gap independentemente (MIN_ROUND_GAP a MAX_ROUND_GAP)
    const gapRange = MAX_ROUND_GAP - MIN_ROUND_GAP + 1;
    for (let i = 0; i < 3; i++) {
      if (Math.random() < mutationRate) {
        gene.roundGaps[i] = MIN_ROUND_GAP + Math.floor(Math.random() * gapRange);
      }
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
  const gapRange = MAX_ROUND_GAP - MIN_ROUND_GAP + 1;
  const genes = lotIds.map((lotId) => ({
    lotId,
    d0Offset: Math.floor(Math.random() * (2 * maxAdjustment + 1)) - maxAdjustment,
    roundGaps: [
      MIN_ROUND_GAP + Math.floor(Math.random() * gapRange),
      MIN_ROUND_GAP + Math.floor(Math.random() * gapRange),
      MIN_ROUND_GAP + Math.floor(Math.random() * gapRange),
    ] as [number, number, number],
  }));

  return { genes, fitness: 0 };
}
