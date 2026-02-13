import { Lot } from '@/domain/value-objects/Lot';
import { Chromosome } from './types';

/**
 * Calcula distancia entre dois cronogramas (soma de diferencas de D0)
 */
export function scheduleDistance(lots1: Lot[], lots2: Lot[]): number {
  let totalDiff = 0;

  for (let i = 0; i < lots1.length; i++) {
    const lot1 = lots1[i];
    const lot2 = lots2[i];

    if (lot1 && lot2) {
      const diff = Math.abs(lot1.d0.daysSince(lot2.d0));
      totalDiff += diff;
    }
  }

  return totalDiff;
}

/**
 * Aplica cromossomo aos lotes base
 */
export function applyChromosome(
  chromosome: Chromosome,
  baseLots: Lot[]
): Lot[] {
  return baseLots.map((lot) => {
    const gene = chromosome.genes.find((g) => g.lotId === lot.id);
    if (!gene || gene.d0Offset === 0) return lot;

    const newD0 = lot.d0.addDays(gene.d0Offset);
    return lot.withD0(newD0);
  });
}

/**
 * Seleciona top 4 solucoes diversas
 */
export function selectDiverseTop4(
  population: Chromosome[],
  baseLots: Lot[],
  minDistance: number = 10
): Chromosome[] {
  // Ordenar por fitness (melhor primeiro)
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);

  if (sorted.length === 0) return [];
  if (sorted.length === 1) return [sorted[0]!];

  const selected: Chromosome[] = [sorted[0]!];
  const selectedLots: Lot[][] = [applyChromosome(sorted[0]!, baseLots)];

  // Buscar 2a, 3a e 4a solucoes diversas
  for (const candidate of sorted.slice(1)) {
    const candidateLots = applyChromosome(candidate, baseLots);

    // Verificar distancia minima de todas as selecionadas
    let isDiverse = true;

    for (const selectedSchedule of selectedLots) {
      const dist = scheduleDistance(candidateLots, selectedSchedule);
      if (dist < minDistance) {
        isDiverse = false;
        break;
      }
    }

    if (isDiverse) {
      selected.push(candidate);
      selectedLots.push(candidateLots);

      if (selected.length === 4) break;
    }
  }

  // Se nao encontramos 4 diversos, preencher com proximos melhores
  while (selected.length < 4 && selected.length < sorted.length) {
    const next = sorted[selected.length];
    if (next) selected.push(next);
  }

  return selected;
}
