import { Lot } from '@/domain/value-objects/Lot';
import { calculateAllHandlingDates } from '@/core/date-engine/calculator';
import { detectConflicts } from '@/core/conflict/detector';
import { isSunday } from '@/core/date-engine/utils';
import { ScheduleObjectives } from '@/domain/value-objects/OptimizationScenario';
import { Chromosome, ScenarioWeights, ScenarioProfile } from './types';

/**
 * Pesos padrao (balanceado)
 */
export const DEFAULT_WEIGHTS: ScenarioWeights = {
  intervalViolations: 5000,
  overlapsRounds12: 10000,
  sundaysRounds12: 1000,
  overlapsRounds34: 100,
  sundaysRounds34: -50,
  totalCycleDays: 1,
  d0OffsetPenalty: 0,
  gapChangePenalty: 0,
};

/**
 * 4 perfis de cenario com objetivos distintos
 */
export const SCENARIO_PROFILES: ScenarioProfile[] = [
  {
    name: 'Sem Conflitos',
    description: 'Elimina sobreposicoes e domingos em todas as rodadas',
    weights: {
      intervalViolations: 5000,
      overlapsRounds12: 10000,
      sundaysRounds12: 5000,
      overlapsRounds34: 5000,
      sundaysRounds34: 2000,
      totalCycleDays: 0.1,
      d0OffsetPenalty: 0,
      gapChangePenalty: 0,
    },
  },
  {
    name: 'Ciclo Curto',
    description: 'Minimiza a duracao total do ciclo',
    weights: {
      intervalViolations: 5000,
      overlapsRounds12: 10000,
      sundaysRounds12: 500,
      overlapsRounds34: 50,
      sundaysRounds34: -50,
      totalCycleDays: 100,
      d0OffsetPenalty: 0,
      gapChangePenalty: 0,
    },
  },
  {
    name: 'Balanceado',
    description: 'Equilibrio entre conflitos e duracao do ciclo',
    weights: {
      intervalViolations: 5000,
      overlapsRounds12: 10000,
      sundaysRounds12: 1000,
      overlapsRounds34: 100,
      sundaysRounds34: -50,
      totalCycleDays: 1,
      d0OffsetPenalty: 0,
      gapChangePenalty: 50,
    },
  },
  {
    name: 'Conservador',
    description: 'Melhora o calendario com minimas alteracoes nas datas',
    weights: {
      intervalViolations: 5000,
      overlapsRounds12: 10000,
      sundaysRounds12: 1000,
      overlapsRounds34: 100,
      sundaysRounds34: -50,
      totalCycleDays: 1,
      d0OffsetPenalty: 200,
      gapChangePenalty: 200,
    },
  },
];

/**
 * Calcula objetivos de um cronograma
 */
export function calculateObjectives(lots: Lot[]): ScheduleObjectives {
  const allDates = calculateAllHandlingDates(lots, 4);
  const conflicts = detectConflicts(allDates);

  // Contar domingos por rodada
  let sundaysRounds12 = 0;
  let sundaysRounds34 = 0;

  for (const hd of allDates) {
    if (isSunday(hd.date)) {
      if (hd.roundId <= 1) {
        sundaysRounds12++;
      } else {
        sundaysRounds34++;
      }
    }
  }

  // Contar sobreposicoes por rodada
  let overlapsRounds12 = 0;
  let overlapsRounds34 = 0;

  for (const conflict of conflicts) {
    if (conflict.type === 'overlap') {
      const round = conflict.handlingDates[0]?.roundId ?? 0;
      if (round <= 1) {
        overlapsRounds12++;
      } else {
        overlapsRounds34++;
      }
    }
  }

  // Calcular duracao total do ciclo
  let minD0 = lots[0]?.d0;
  let maxDate = lots[0]?.d0;

  for (const lot of lots) {
    if (!minD0 || lot.d0.compareTo(minD0) < 0) {
      minD0 = lot.d0;
    }

    const intervals = lot.getIntervals(4);
    const lastInterval = intervals[intervals.length - 1];
    if (lastInterval) {
      const lastDate = lot.d0.addDays(lastInterval.dayOffset);
      if (!maxDate || lastDate.compareTo(maxDate) > 0) {
        maxDate = lastDate;
      }
    }
  }

  const totalCycleDays = minD0 && maxDate ? maxDate.daysSince(minD0) : 0;

  // Contar violacoes de intervalo (21-23 dias)
  let intervalViolations = 0;
  for (const lot of lots) {
    for (const gap of lot.roundGaps) {
      if (gap < 21 || gap > 23) {
        intervalViolations++;
      }
    }
  }

  return {
    sundaysRounds12,
    sundaysRounds34,
    overlapsRounds12,
    overlapsRounds34,
    totalCycleDays,
    intervalViolations,
  };
}

/**
 * Escalariza objetivos em penalidade unica (quanto menor, melhor)
 */
export function scalarizeObjectives(
  obj: ScheduleObjectives,
  weights: ScenarioWeights = DEFAULT_WEIGHTS
): number {
  const penalty =
    obj.intervalViolations * weights.intervalViolations +
    obj.overlapsRounds12 * weights.overlapsRounds12 +
    obj.sundaysRounds12 * weights.sundaysRounds12 +
    obj.overlapsRounds34 * weights.overlapsRounds34 +
    obj.sundaysRounds34 * weights.sundaysRounds34 +
    obj.totalCycleDays * weights.totalCycleDays;

  return penalty;
}

/**
 * Calcula fitness normalizado (0 a 1, quanto maior melhor)
 */
export function calculateFitness(lots: Lot[]): number {
  const objectives = calculateObjectives(lots);
  const penalty = scalarizeObjectives(objectives);
  return 1 / (1 + penalty);
}

/**
 * Calcula fitness e objetivos de um cromossomo
 */
export function evaluateChromosome(
  chromosome: Chromosome,
  baseLots: Lot[],
  weights: ScenarioWeights = DEFAULT_WEIGHTS
): { fitness: number; objectives: ScheduleObjectives } {
  // Aplicar offsets de D0 e roundGaps do cromossomo aos lotes
  const adjustedLots = baseLots.map((lot) => {
    const gene = chromosome.genes.find((g) => g.lotId === lot.id);
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

  const objectives = calculateObjectives(adjustedLots);
  let penalty = scalarizeObjectives(objectives, weights);

  // Penalidade por deslocamento de D0 (para cenario conservador)
  if (weights.d0OffsetPenalty > 0) {
    let totalOffset = 0;
    for (const gene of chromosome.genes) {
      totalOffset += Math.abs(gene.d0Offset);
    }
    penalty += totalOffset * weights.d0OffsetPenalty;
  }

  // Penalidade por mudanca de gaps (para cenario conservador)
  if (weights.gapChangePenalty > 0) {
    let totalGapChanges = 0;
    for (const gene of chromosome.genes) {
      const baseLot = baseLots.find((l) => l.id === gene.lotId);
      if (baseLot) {
        for (let i = 0; i < 3; i++) {
          if (gene.roundGaps[i] !== baseLot.roundGaps[i]) {
            totalGapChanges++;
          }
        }
      }
    }
    penalty += totalGapChanges * weights.gapChangePenalty;
  }

  const fitness = 1 / (1 + penalty);

  return { fitness, objectives };
}
