import { Lot } from '@/domain/value-objects/Lot';
import { Chromosome, Gene, ScenarioWeights } from './types';
import { createEvaluationContext, evaluateChromosome, EvaluationContext } from './fitness-calculator';

const VALID_GAPS = [21, 22, 23] as const;

/**
 * Heuristica NEH para inicializacao
 *
 * Ordena lotes por duracao total do protocolo e tenta
 * posiciona-los de forma a minimizar conflitos,
 * explorando combinacoes de D0 offset e intervalos entre rodadas.
 */
export function nehInitialization(
  lots: Lot[],
  weights?: ScenarioWeights,
  context?: EvaluationContext
): Chromosome {
  const evaluationContext = context ?? createEvaluationContext(lots);

  // 1. Ordenar lotes por duracao total do protocolo (decrescente)
  const sortedLots = [...lots].sort((a, b) => {
    const durationA = getTotalProtocolDuration(a);
    const durationB = getTotalProtocolDuration(b);
    return durationB - durationA;
  });

  // 2. Criar genes em ordem canonica dos lotes
  const genesById = new Map<string, Gene>();
  for (const lot of lots) {
    genesById.set(lot.id, {
      lotId: lot.id,
      d0Offset: 0,
      roundGaps: [...lot.roundGaps].slice(0, 3) as [number, number, number],
    });
  }

  const genes: Gene[] = lots
    .map((lot) => genesById.get(lot.id))
    .filter((gene): gene is Gene => gene !== undefined);

  const testChromosome: Chromosome = { genes, fitness: 0 };

  // 3. Tentar ajustes de D0 e combinacoes de gaps para cada gene
  for (const lot of sortedLots) {
    const gene = genesById.get(lot.id);
    if (!gene) {
      continue;
    }

    let bestOffset = 0;
    let bestGaps = [...gene.roundGaps] as [number, number, number];
    let bestFitness = Number.NEGATIVE_INFINITY;

    for (let offset = -3; offset <= 3; offset++) {
      for (const g0 of VALID_GAPS) {
        for (const g1 of VALID_GAPS) {
          for (const g2 of VALID_GAPS) {
            gene.d0Offset = offset;
            gene.roundGaps = [g0, g1, g2];

            const { fitness } = evaluateChromosome(testChromosome, lots, weights, evaluationContext, {
              changedLotIds: [lot.id],
            });

            if (fitness > bestFitness) {
              bestFitness = fitness;
              bestOffset = offset;
              bestGaps = [g0, g1, g2];
            }
          }
        }
      }
    }

    gene.d0Offset = bestOffset;
    gene.roundGaps = bestGaps;
  }

  return { genes, fitness: 0 };
}

/**
 * Calcula duracao total do protocolo de um lote (4 rodadas)
 */
function getTotalProtocolDuration(lot: Lot): number {
  const intervals = lot.getIntervals(4);
  if (intervals.length === 0) return 0;

  const lastInterval = intervals[intervals.length - 1]!;
  return lastInterval.dayOffset;
}
