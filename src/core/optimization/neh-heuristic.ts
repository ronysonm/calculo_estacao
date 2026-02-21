import { Lot } from '@/domain/value-objects/Lot';
import { Holiday } from '@/domain/value-objects/Holiday';
import { MIN_ROUND_GAP, MAX_ROUND_GAP } from '@/domain/constants';
import { Chromosome, Gene, ScenarioWeights } from './types';
import { evaluateChromosome } from './fitness-calculator';

const VALID_GAPS = Array.from(
  { length: MAX_ROUND_GAP - MIN_ROUND_GAP + 1 },
  (_, i) => MIN_ROUND_GAP + i
);

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
  holidays: readonly Holiday[] = []
): Chromosome {
  // 1. Ordenar lotes por duracao total do protocolo (decrescente)
  const sortedLots = [...lots].sort((a, b) => {
    const durationA = getTotalProtocolDuration(a);
    const durationB = getTotalProtocolDuration(b);
    return durationB - durationA;
  });

  // 2. Criar cromossomo com offsets zero e gaps originais
  const genes: Gene[] = sortedLots.map((lot) => ({
    lotId: lot.id,
    d0Offset: 0,
    roundGaps: [...lot.roundGaps].slice(0, 3) as [number, number, number],
  }));

  // 3. Tentar ajustes de D0 e combinacoes de gaps para cada gene
  for (const gene of genes) {
    let bestOffset = 0;
    let bestGaps = [...gene.roundGaps] as [number, number, number];
    let bestFitness = 0;

    for (let offset = -3; offset <= 3; offset++) {
      for (const g0 of VALID_GAPS) {
        for (const g1 of VALID_GAPS) {
          for (const g2 of VALID_GAPS) {
            gene.d0Offset = offset;
            gene.roundGaps = [g0, g1, g2];

            const testChromosome = { genes: [...genes], fitness: 0 };
            const { fitness } = evaluateChromosome(testChromosome, lots, weights, holidays);

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
