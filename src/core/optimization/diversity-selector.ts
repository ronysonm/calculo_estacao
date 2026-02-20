import { Lot } from '@/domain/value-objects/Lot';
import { Chromosome } from './types';
import {
  createEvaluationContext,
  EvaluationContext,
  mapChromosomeGenesByLotIndex,
} from './fitness-calculator';

/**
 * Calcula distancia entre dois cronogramas (soma de diferencas de D0 + gaps)
 */
export function scheduleDistance(lots1: Lot[], lots2: Lot[]): number {
  let totalDiff = 0;

  for (let i = 0; i < lots1.length; i++) {
    const lot1 = lots1[i];
    const lot2 = lots2[i];

    if (lot1 && lot2) {
      totalDiff += Math.abs(lot1.d0.daysSince(lot2.d0));

      for (let g = 0; g < lot1.roundGaps.length; g++) {
        totalDiff += Math.abs((lot1.roundGaps[g] ?? 22) - (lot2.roundGaps[g] ?? 22));
      }
    }
  }

  return totalDiff;
}

/**
 * Aplica cromossomo aos lotes base (D0 offset + round gaps)
 */
export function applyChromosome(
  chromosome: Chromosome,
  baseLots: Lot[],
  context?: EvaluationContext
): Lot[] {
  const evaluationContext = context ?? createEvaluationContext(baseLots, 0);
  const genesByIndex = mapChromosomeGenesByLotIndex(chromosome, evaluationContext);

  return baseLots.map((lot, lotIndex) => {
    const gene = genesByIndex[lotIndex];
    if (!gene) return lot;

    let adjusted = lot;

    if (gene.d0Offset !== 0) {
      adjusted = adjusted.withD0(lot.d0.addDays(gene.d0Offset));
    }

    for (let i = 0; i < 3; i++) {
      if (gene.roundGaps[i] !== lot.roundGaps[i]) {
        adjusted = adjusted.withRoundGap(i, gene.roundGaps[i]!);
      }
    }

    return adjusted;
  });
}

/**
 * Seleciona top 4 solucoes diversas
 */
export function selectDiverseTop4(
  population: Chromosome[],
  baseLots: Lot[],
  minDistance: number = 10,
  context?: EvaluationContext
): Chromosome[] {
  // Ordenar por fitness (melhor primeiro)
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
  const evaluationContext = context ?? createEvaluationContext(baseLots, 0);

  const prepared = sorted.map((chromosome) => ({
    chromosome,
    genesByIndex: mapChromosomeGenesByLotIndex(chromosome, evaluationContext),
  }));

  if (prepared.length === 0) return [];
  if (prepared.length === 1) return [prepared[0]!.chromosome];

  const selected = [prepared[0]!];

  // Buscar 2a, 3a e 4a solucoes diversas
  for (const candidate of prepared.slice(1)) {

    // Verificar distancia minima de todas as selecionadas
    let isDiverse = true;

    for (const selectedCandidate of selected) {
      const dist = chromosomeDistance(
        candidate.genesByIndex,
        selectedCandidate.genesByIndex,
        evaluationContext
      );
      if (dist < minDistance) {
        isDiverse = false;
        break;
      }
    }

    if (isDiverse) {
      selected.push(candidate);

      if (selected.length === 4) break;
    }
  }

  // Se nao encontramos 4 diversos, preencher com proximos melhores
  while (selected.length < 4 && selected.length < prepared.length) {
    const next = prepared[selected.length];
    if (next) selected.push(next);
  }

  return selected.map((entry) => entry.chromosome);
}

function chromosomeDistance(
  genesA: Array<{
    d0Offset: number;
    roundGaps: [number, number, number];
  } | undefined>,
  genesB: Array<{
    d0Offset: number;
    roundGaps: [number, number, number];
  } | undefined>,
  context: EvaluationContext
): number {
  let totalDiff = 0;

  for (let lotIndex = 0; lotIndex < context.lotIds.length; lotIndex++) {
    const geneA = genesA[lotIndex];
    const geneB = genesB[lotIndex];

    const d0A = geneA?.d0Offset ?? 0;
    const d0B = geneB?.d0Offset ?? 0;
    totalDiff += Math.abs(d0A - d0B);

    const baseGapIndex = lotIndex * 3;
    const aGap0 = geneA?.roundGaps[0] ?? context.baseRoundGaps[baseGapIndex] ?? 22;
    const aGap1 = geneA?.roundGaps[1] ?? context.baseRoundGaps[baseGapIndex + 1] ?? 22;
    const aGap2 = geneA?.roundGaps[2] ?? context.baseRoundGaps[baseGapIndex + 2] ?? 22;

    const bGap0 = geneB?.roundGaps[0] ?? context.baseRoundGaps[baseGapIndex] ?? 22;
    const bGap1 = geneB?.roundGaps[1] ?? context.baseRoundGaps[baseGapIndex + 1] ?? 22;
    const bGap2 = geneB?.roundGaps[2] ?? context.baseRoundGaps[baseGapIndex + 2] ?? 22;

    totalDiff += Math.abs(aGap0 - bGap0);
    totalDiff += Math.abs(aGap1 - bGap1);
    totalDiff += Math.abs(aGap2 - bGap2);
  }

  return totalDiff;
}
