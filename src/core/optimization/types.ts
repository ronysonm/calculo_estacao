import { ScheduleObjectives } from '@/domain/value-objects/OptimizationScenario';

/**
 * Gene - Representa o ajuste de D0 e intervalos de um unico lote
 */
export interface Gene {
  lotId: string;
  d0Offset: number;
  roundGaps: [number, number, number]; // intervalo entre rodadas (21, 22 ou 23 dias)
}

/**
 * Cromossomo - Solucao candidata completa
 */
export interface Chromosome {
  genes: Gene[];
  fitness: number;
  objectives?: ScheduleObjectives;
  rank?: number;
  crowdingDistance?: number;
}

/**
 * Pesos para escalarizacao de objetivos
 */
export interface ScenarioWeights {
  intervalViolations: number;
  overlapsRounds12: number;
  sundaysRounds12: number;
  overlapsRounds34: number;
  sundaysRounds34: number;
  totalCycleDays: number;
  d0OffsetPenalty: number;
  gapChangePenalty: number;
}

/**
 * Perfil de cenario (nome + pesos)
 */
export interface ScenarioProfile {
  name: string;
  description: string;
  weights: ScenarioWeights;
}

/**
 * Parametros do algoritmo genetico
 */
export interface GeneticParams {
  populationSize: number;
  eliteSize: number;
  mutationRate: number;
  crossoverRate: number;
  tournamentSize: number;
  timeLimitMs: number;
  maxD0Adjustment: number;
  attemptsPerProfile: number;
  islandCount: number;
  migrationIntervalGenerations: number;
  migrationTopK: number;
  memeticIntervalGenerations: number;
  memeticEliteCount: number;
  memeticLotSampleSize: number;
  memeticMaxImprovements: number;
  memeticMaxNeighborEvaluations: number;
  enableCpSatForSmallInstances?: boolean;
  cpSatLotThreshold: number;
  cpSatMaxEvaluationsPerProfile: number;
  cpSatTopCandidatesPerProfile: number;
  minAttemptBudgetMs?: number;
  deadlineSafetyMs?: number;
  rng?: () => number;
}

/**
 * Parametros padrao otimizados
 */
export const DEFAULT_GA_PARAMS: GeneticParams = {
  populationSize: 50,
  eliteSize: 5,
  mutationRate: 0.15,
  crossoverRate: 0.8,
  tournamentSize: 3,
  timeLimitMs: 30000,
  maxD0Adjustment: 15,
  attemptsPerProfile: 3,
  islandCount: 4,
  migrationIntervalGenerations: 10,
  migrationTopK: 2,
  memeticIntervalGenerations: 2,
  memeticEliteCount: 3,
  memeticLotSampleSize: 4,
  memeticMaxImprovements: 1,
  memeticMaxNeighborEvaluations: 64,
  enableCpSatForSmallInstances: true,
  cpSatLotThreshold: 3,
  cpSatMaxEvaluationsPerProfile: 120000,
  cpSatTopCandidatesPerProfile: 3,
  minAttemptBudgetMs: 200,
  deadlineSafetyMs: 20,
};
