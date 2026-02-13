import { Lot } from '@/domain/value-objects/Lot';
import { Chromosome, ScenarioWeights } from './types';
import { evaluateChromosome } from './fitness-calculator';

/**
 * Heuristica NEH para inicializacao
 *
 * Ordena lotes por duracao total do protocolo e tenta
 * posiciona-los de forma a minimizar conflitos.
 */
export function nehInitialization(
  lots: Lot[],
  weights?: ScenarioWeights
): Chromosome {
  // 1. Ordenar lotes por duracao total do protocolo (decrescente)
  const sortedLots = [...lots].sort((a, b) => {
    const durationA = getTotalProtocolDuration(a);
    const durationB = getTotalProtocolDuration(b);
    return durationB - durationA;
  });

  // 2. Criar cromossomo com offsets zero (sem ajuste)
  const genes = sortedLots.map((lot) => ({
    lotId: lot.id,
    d0Offset: 0,
  }));

  // 3. Tentar pequenos ajustes para melhorar
  for (const gene of genes) {
    let bestOffset = 0;
    let bestFitness = 0;

    for (let offset = -3; offset <= 3; offset++) {
      gene.d0Offset = offset;
      const testChromosome = { genes: [...genes], fitness: 0 };
      const { fitness } = evaluateChromosome(testChromosome, lots, weights);

      if (fitness > bestFitness) {
        bestFitness = fitness;
        bestOffset = offset;
      }
    }

    gene.d0Offset = bestOffset;
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
