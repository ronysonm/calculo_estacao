import { Lot } from '@/domain/value-objects/Lot';
import { calculateAllHandlingDates } from '@/core/date-engine/calculator';
import { detectConflicts } from '@/core/conflict/detector';
import { isSunday } from '@/core/date-engine/utils';
import { ScheduleObjectives } from '@/domain/value-objects/OptimizationScenario';
import { Chromosome, Gene, ScenarioWeights, ScenarioProfile } from './types';

const ROUNDS = 4;
const GENE_GAPS = 3;
const DEFAULT_GAP = 22;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_EVALUATION_CACHE_SIZE = 5000;

interface BasePenaltyTerms {
  totalOffsetAbs: number;
  totalGapChanges: number;
}

interface CachedEvaluation {
  objectives: ScheduleObjectives;
  basePenaltyTerms: BasePenaltyTerms;
}

interface LotContribution {
  adjustedD0: number;
  finalDate: number;
  sundaysRounds12: number;
  sundaysRounds34: number;
  intervalViolations: number;
  offsetAbs: number;
  gapChanges: number;
  dayRounds: Map<number, number>;
}

interface DayBucketState {
  earliestRoundByLot: Map<number, number>;
}

type OverlapBucketClass = 0 | 1 | 2;

interface IncrementalEvaluationState {
  contributions: LotContribution[];
  dayBuckets: Map<number, DayBucketState>;
  objectives: ScheduleObjectives;
  basePenaltyTerms: BasePenaltyTerms;
  d0Offsets: Int32Array;
  roundGaps: Int16Array;
  minD0: number;
  maxDate: number;
  hasLots: boolean;
}

export interface EvaluateChromosomeOptions {
  changedLotIds?: readonly string[];
}

class LruCache<K, V> {
  private readonly values = new Map<K, V>();

  constructor(private readonly capacity: number) {}

  get(key: K): V | undefined {
    const value = this.values.get(key);
    if (value === undefined) {
      return undefined;
    }

    this.values.delete(key);
    this.values.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.capacity <= 0) {
      return;
    }

    if (this.values.has(key)) {
      this.values.delete(key);
    }

    this.values.set(key, value);

    if (this.values.size <= this.capacity) {
      return;
    }

    const firstKey = this.values.keys().next().value;
    if (firstKey !== undefined) {
      this.values.delete(firstKey);
    }
  }
}

export interface EvaluationContext {
  lotIds: readonly string[];
  lotIndexById: ReadonlyMap<string, number>;
  baseLotById: ReadonlyMap<string, Lot>;
  baseD0EpochDay: Int32Array;
  baseRoundGaps: Int16Array;
  protocolDaysByLot: readonly Int16Array[];
  protocolLastDayByLot: Int16Array;
  objectiveCache: LruCache<string, CachedEvaluation>;
  incrementalStateByChromosome: WeakMap<Chromosome, IncrementalEvaluationState>;
}

function epochDay(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function isSundayEpochDay(day: number): boolean {
  const weekDay = ((day + 4) % 7 + 7) % 7;
  return weekDay === 0;
}

function getGapAt(gene: Gene | undefined, gapIndex: number, baseRoundGaps: Int16Array, baseIndex: number): number {
  if (gene) {
    return gene.roundGaps[gapIndex] ?? DEFAULT_GAP;
  }
  return baseRoundGaps[baseIndex + gapIndex] ?? DEFAULT_GAP;
}

export function createEvaluationContext(
  baseLots: Lot[],
  cacheSize: number = DEFAULT_EVALUATION_CACHE_SIZE
): EvaluationContext {
  const lotIds: string[] = [];
  const lotIndexById = new Map<string, number>();
  const baseLotById = new Map<string, Lot>();
  const baseD0EpochDay = new Int32Array(baseLots.length);
  const baseRoundGaps = new Int16Array(baseLots.length * GENE_GAPS);
  const protocolDaysByLot: Int16Array[] = [];
  const protocolLastDayByLot = new Int16Array(baseLots.length);

  for (let i = 0; i < baseLots.length; i++) {
    const lot = baseLots[i]!;
    lotIds.push(lot.id);
    lotIndexById.set(lot.id, i);
    baseLotById.set(lot.id, lot);
    baseD0EpochDay[i] = epochDay(lot.d0.year, lot.d0.month, lot.d0.day);

    for (let g = 0; g < GENE_GAPS; g++) {
      const baseGap = lot.roundGaps[g] ?? DEFAULT_GAP;
      baseRoundGaps[i * GENE_GAPS + g] = baseGap;
    }

    const protocolDays = Int16Array.from(lot.protocol.intervals.map((value) => Math.trunc(value)));
    protocolDaysByLot.push(protocolDays);
    protocolLastDayByLot[i] = Math.trunc(
      lot.protocol.intervals[lot.protocol.intervals.length - 1] ?? 0
    );
  }

  return {
    lotIds,
    lotIndexById,
    baseLotById,
    baseD0EpochDay,
    baseRoundGaps,
    protocolDaysByLot,
    protocolLastDayByLot,
    objectiveCache: new LruCache<string, CachedEvaluation>(cacheSize),
    incrementalStateByChromosome: new WeakMap<Chromosome, IncrementalEvaluationState>(),
  };
}

export function mapChromosomeGenesByLotIndex(
  chromosome: Chromosome,
  context: EvaluationContext
): Array<Gene | undefined> {
  const expectedLength = context.lotIds.length;

  if (chromosome.genes.length === expectedLength) {
    let ordered = true;
    for (let i = 0; i < expectedLength; i++) {
      const gene = chromosome.genes[i];
      if (!gene || gene.lotId !== context.lotIds[i]) {
        ordered = false;
        break;
      }
    }

    if (ordered) {
      return chromosome.genes;
    }
  }

  const genesByIndex: Array<Gene | undefined> = new Array(expectedLength);
  for (const gene of chromosome.genes) {
    const lotIndex = context.lotIndexById.get(gene.lotId);
    if (lotIndex !== undefined) {
      genesByIndex[lotIndex] = gene;
    }
  }

  return genesByIndex;
}

export function canonicalizeChromosomeInPlace(
  chromosome: Chromosome,
  context: EvaluationContext
): void {
  if (chromosome.genes.length <= 1) {
    return;
  }

  let alreadyCanonical = chromosome.genes.length === context.lotIds.length;
  if (alreadyCanonical) {
    for (let i = 0; i < chromosome.genes.length; i++) {
      if (chromosome.genes[i]?.lotId !== context.lotIds[i]) {
        alreadyCanonical = false;
        break;
      }
    }
  }

  if (alreadyCanonical) {
    return;
  }

  chromosome.genes.sort((a, b) => {
    const indexA = context.lotIndexById.get(a.lotId) ?? Number.MAX_SAFE_INTEGER;
    const indexB = context.lotIndexById.get(b.lotId) ?? Number.MAX_SAFE_INTEGER;
    return indexA - indexB;
  });
}

export function chromosomeSignature(
  chromosome: Chromosome,
  context: EvaluationContext,
  preparedGenes?: Array<Gene | undefined>
): string {
  const genesByIndex = preparedGenes ?? mapChromosomeGenesByLotIndex(chromosome, context);
  const signatureParts = new Array<string>(context.lotIds.length);

  for (let i = 0; i < context.lotIds.length; i++) {
    const gene = genesByIndex[i];
    if (gene) {
      signatureParts[i] = `${gene.d0Offset}:${gene.roundGaps[0]},${gene.roundGaps[1]},${gene.roundGaps[2]}`;
      continue;
    }

    const gapBaseIndex = i * GENE_GAPS;
    signatureParts[i] = `0:${context.baseRoundGaps[gapBaseIndex]},${context.baseRoundGaps[gapBaseIndex + 1]},${context.baseRoundGaps[gapBaseIndex + 2]}`;
  }

  return signatureParts.join('|');
}

function classifyDayBucket(bucket: DayBucketState | undefined): OverlapBucketClass {
  if (!bucket || bucket.earliestRoundByLot.size < 2) {
    return 0;
  }

  let firstLotIndex = Number.POSITIVE_INFINITY;
  let firstRound = 0;

  for (const [lotIndex, round] of bucket.earliestRoundByLot) {
    if (lotIndex < firstLotIndex) {
      firstLotIndex = lotIndex;
      firstRound = round;
    }
  }

  return firstRound <= 1 ? 1 : 2;
}

function applyOverlapBucketClassDelta(
  objectives: ScheduleObjectives,
  previousClass: OverlapBucketClass,
  nextClass: OverlapBucketClass
): void {
  if (previousClass === nextClass) {
    return;
  }

  if (previousClass === 1) {
    objectives.overlapsRounds12--;
  } else if (previousClass === 2) {
    objectives.overlapsRounds34--;
  }

  if (nextClass === 1) {
    objectives.overlapsRounds12++;
  } else if (nextClass === 2) {
    objectives.overlapsRounds34++;
  }
}

function addLotContributionToBuckets(
  lotIndex: number,
  contribution: LotContribution,
  state: IncrementalEvaluationState
): void {
  for (const [day, round] of contribution.dayRounds) {
    const currentBucket = state.dayBuckets.get(day);
    const previousClass = classifyDayBucket(currentBucket);

    if (!currentBucket) {
      const newBucket: DayBucketState = {
        earliestRoundByLot: new Map<number, number>([[lotIndex, round]]),
      };
      state.dayBuckets.set(day, newBucket);
      const nextClass = classifyDayBucket(newBucket);
      applyOverlapBucketClassDelta(state.objectives, previousClass, nextClass);
      continue;
    }

    const existingRound = currentBucket.earliestRoundByLot.get(lotIndex);
    if (existingRound === undefined || round < existingRound) {
      currentBucket.earliestRoundByLot.set(lotIndex, round);
    }

    const nextClass = classifyDayBucket(currentBucket);
    applyOverlapBucketClassDelta(state.objectives, previousClass, nextClass);
  }
}

function removeLotContributionFromBuckets(
  lotIndex: number,
  contribution: LotContribution,
  state: IncrementalEvaluationState
): void {
  for (const day of contribution.dayRounds.keys()) {
    const bucket = state.dayBuckets.get(day);
    if (!bucket) {
      continue;
    }

    const previousClass = classifyDayBucket(bucket);
    bucket.earliestRoundByLot.delete(lotIndex);

    let nextBucket: DayBucketState | undefined = bucket;
    if (bucket.earliestRoundByLot.size === 0) {
      state.dayBuckets.delete(day);
      nextBucket = undefined;
    }

    const nextClass = classifyDayBucket(nextBucket);
    applyOverlapBucketClassDelta(state.objectives, previousClass, nextClass);
  }
}

function buildLotContribution(
  lotIndex: number,
  d0Offset: number,
  gap0: number,
  gap1: number,
  gap2: number,
  context: EvaluationContext
): LotContribution {
  const adjustedD0 = (context.baseD0EpochDay[lotIndex] ?? 0) + d0Offset;
  const gapBaseIndex = lotIndex * GENE_GAPS;
  const protocolDays = context.protocolDaysByLot[lotIndex]!;
  const lastProtocolDay = context.protocolLastDayByLot[lotIndex] ?? 0;

  let sundaysRounds12 = 0;
  let sundaysRounds34 = 0;
  const dayRounds = new Map<number, number>();

  let roundStartOffset = 0;
  for (let round = 0; round < ROUNDS; round++) {
    if (round > 0) {
      const gap = round === 1 ? gap0 : round === 2 ? gap1 : gap2;
      roundStartOffset += lastProtocolDay + gap;
    }

    for (let i = 0; i < protocolDays.length; i++) {
      const dateEpochDay = adjustedD0 + roundStartOffset + protocolDays[i]!;

      if (isSundayEpochDay(dateEpochDay)) {
        if (round <= 1) {
          sundaysRounds12++;
        } else {
          sundaysRounds34++;
        }
      }

      const previousRound = dayRounds.get(dateEpochDay);
      if (previousRound === undefined || round < previousRound) {
        dayRounds.set(dateEpochDay, round);
      }
    }
  }

  let intervalViolations = 0;
  if (gap0 < 21 || gap0 > 23) {
    intervalViolations++;
  }
  if (gap1 < 21 || gap1 > 23) {
    intervalViolations++;
  }
  if (gap2 < 21 || gap2 > 23) {
    intervalViolations++;
  }

  let gapChanges = 0;
  if (gap0 !== context.baseRoundGaps[gapBaseIndex]) {
    gapChanges++;
  }
  if (gap1 !== context.baseRoundGaps[gapBaseIndex + 1]) {
    gapChanges++;
  }
  if (gap2 !== context.baseRoundGaps[gapBaseIndex + 2]) {
    gapChanges++;
  }

  let finalDate = adjustedD0;
  if (protocolDays.length > 0) {
    const lastProtocolInterval = protocolDays[protocolDays.length - 1]!;
    finalDate =
      adjustedD0 +
      (lastProtocolDay + gap0) +
      (lastProtocolDay + gap1) +
      (lastProtocolDay + gap2) +
      lastProtocolInterval;
  }

  return {
    adjustedD0,
    finalDate,
    sundaysRounds12,
    sundaysRounds34,
    intervalViolations,
    offsetAbs: Math.abs(d0Offset),
    gapChanges,
    dayRounds,
  };
}

function updateStateCycleBounds(state: IncrementalEvaluationState): void {
  if (state.contributions.length === 0) {
    state.hasLots = false;
    state.minD0 = 0;
    state.maxDate = 0;
    state.objectives.totalCycleDays = 0;
    return;
  }

  state.hasLots = true;
  let minD0 = state.contributions[0]!.adjustedD0;
  let maxDate = state.contributions[0]!.finalDate;

  for (let lotIndex = 1; lotIndex < state.contributions.length; lotIndex++) {
    const contribution = state.contributions[lotIndex]!;
    if (contribution.adjustedD0 < minD0) {
      minD0 = contribution.adjustedD0;
    }
    if (contribution.finalDate > maxDate) {
      maxDate = contribution.finalDate;
    }
  }

  state.minD0 = minD0;
  state.maxDate = maxDate;
  state.objectives.totalCycleDays = maxDate - minD0;
}

function extractGeneValues(
  gene: Gene | undefined,
  lotIndex: number,
  context: EvaluationContext
): { d0Offset: number; gap0: number; gap1: number; gap2: number } {
  const gapBaseIndex = lotIndex * GENE_GAPS;
  return {
    d0Offset: gene?.d0Offset ?? 0,
    gap0: getGapAt(gene, 0, context.baseRoundGaps, gapBaseIndex),
    gap1: getGapAt(gene, 1, context.baseRoundGaps, gapBaseIndex),
    gap2: getGapAt(gene, 2, context.baseRoundGaps, gapBaseIndex),
  };
}

function buildIncrementalEvaluationState(
  genesByIndex: Array<Gene | undefined>,
  context: EvaluationContext
): IncrementalEvaluationState {
  const objectives: ScheduleObjectives = {
    sundaysRounds12: 0,
    sundaysRounds34: 0,
    overlapsRounds12: 0,
    overlapsRounds34: 0,
    totalCycleDays: 0,
    intervalViolations: 0,
  };

  const basePenaltyTerms: BasePenaltyTerms = {
    totalOffsetAbs: 0,
    totalGapChanges: 0,
  };

  const contributions: LotContribution[] = new Array(context.lotIds.length);
  const dayBuckets = new Map<number, DayBucketState>();
  const d0Offsets = new Int32Array(context.lotIds.length);
  const roundGaps = new Int16Array(context.lotIds.length * GENE_GAPS);

  const state: IncrementalEvaluationState = {
    contributions,
    dayBuckets,
    objectives,
    basePenaltyTerms,
    d0Offsets,
    roundGaps,
    minD0: 0,
    maxDate: 0,
    hasLots: false,
  };

  for (let lotIndex = 0; lotIndex < context.lotIds.length; lotIndex++) {
    const values = extractGeneValues(genesByIndex[lotIndex], lotIndex, context);
    const gapBaseIndex = lotIndex * GENE_GAPS;
    d0Offsets[lotIndex] = values.d0Offset;
    roundGaps[gapBaseIndex] = values.gap0;
    roundGaps[gapBaseIndex + 1] = values.gap1;
    roundGaps[gapBaseIndex + 2] = values.gap2;

    const contribution = buildLotContribution(
      lotIndex,
      values.d0Offset,
      values.gap0,
      values.gap1,
      values.gap2,
      context
    );

    contributions[lotIndex] = contribution;
    objectives.sundaysRounds12 += contribution.sundaysRounds12;
    objectives.sundaysRounds34 += contribution.sundaysRounds34;
    objectives.intervalViolations += contribution.intervalViolations;
    basePenaltyTerms.totalOffsetAbs += contribution.offsetAbs;
    basePenaltyTerms.totalGapChanges += contribution.gapChanges;
    addLotContributionToBuckets(lotIndex, contribution, state);
  }

  updateStateCycleBounds(state);
  return state;
}

function resolveChangedLotIndices(
  state: IncrementalEvaluationState,
  genesByIndex: Array<Gene | undefined>,
  context: EvaluationContext,
  changedLotIds: readonly string[] | undefined
): number[] {
  if (changedLotIds) {
    const changed = new Set<number>();
    for (const lotId of changedLotIds) {
      const lotIndex = context.lotIndexById.get(lotId);
      if (lotIndex !== undefined) {
        changed.add(lotIndex);
      }
    }
    return [...changed.values()];
  }

  const changed: number[] = [];
  for (let lotIndex = 0; lotIndex < context.lotIds.length; lotIndex++) {
    const values = extractGeneValues(genesByIndex[lotIndex], lotIndex, context);
    const gapBaseIndex = lotIndex * GENE_GAPS;

    if (
      values.d0Offset !== state.d0Offsets[lotIndex] ||
      values.gap0 !== state.roundGaps[gapBaseIndex] ||
      values.gap1 !== state.roundGaps[gapBaseIndex + 1] ||
      values.gap2 !== state.roundGaps[gapBaseIndex + 2]
    ) {
      changed.push(lotIndex);
    }
  }

  return changed;
}

function applyDeltaEvaluation(
  state: IncrementalEvaluationState,
  changedLotIndices: readonly number[],
  genesByIndex: Array<Gene | undefined>,
  context: EvaluationContext
): void {
  for (const lotIndex of changedLotIndices) {
    const previous = state.contributions[lotIndex];
    if (!previous) {
      continue;
    }

    state.objectives.sundaysRounds12 -= previous.sundaysRounds12;
    state.objectives.sundaysRounds34 -= previous.sundaysRounds34;
    state.objectives.intervalViolations -= previous.intervalViolations;
    state.basePenaltyTerms.totalOffsetAbs -= previous.offsetAbs;
    state.basePenaltyTerms.totalGapChanges -= previous.gapChanges;
    removeLotContributionFromBuckets(lotIndex, previous, state);

    const values = extractGeneValues(genesByIndex[lotIndex], lotIndex, context);
    const gapBaseIndex = lotIndex * GENE_GAPS;
    state.d0Offsets[lotIndex] = values.d0Offset;
    state.roundGaps[gapBaseIndex] = values.gap0;
    state.roundGaps[gapBaseIndex + 1] = values.gap1;
    state.roundGaps[gapBaseIndex + 2] = values.gap2;

    const next = buildLotContribution(
      lotIndex,
      values.d0Offset,
      values.gap0,
      values.gap1,
      values.gap2,
      context
    );

    state.contributions[lotIndex] = next;
    state.objectives.sundaysRounds12 += next.sundaysRounds12;
    state.objectives.sundaysRounds34 += next.sundaysRounds34;
    state.objectives.intervalViolations += next.intervalViolations;
    state.basePenaltyTerms.totalOffsetAbs += next.offsetAbs;
    state.basePenaltyTerms.totalGapChanges += next.gapChanges;
    addLotContributionToBuckets(lotIndex, next, state);
  }

  updateStateCycleBounds(state);
}

function snapshotCachedEvaluation(state: IncrementalEvaluationState): CachedEvaluation {
  return {
    objectives: {
      sundaysRounds12: state.objectives.sundaysRounds12,
      sundaysRounds34: state.objectives.sundaysRounds34,
      overlapsRounds12: state.objectives.overlapsRounds12,
      overlapsRounds34: state.objectives.overlapsRounds34,
      totalCycleDays: state.objectives.totalCycleDays,
      intervalViolations: state.objectives.intervalViolations,
    },
    basePenaltyTerms: {
      totalOffsetAbs: state.basePenaltyTerms.totalOffsetAbs,
      totalGapChanges: state.basePenaltyTerms.totalGapChanges,
    },
  };
}

/**
 * Pesos padrao (balanceado)
 */
export const DEFAULT_WEIGHTS: ScenarioWeights = {
  intervalViolations: 5000,
  overlapsRounds12: 10000,
  sundaysRounds12: 1000,
  overlapsRounds34: 100,
  sundaysRounds34: 100,
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
      sundaysRounds34: 100,
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
      sundaysRounds34: 100,
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
      sundaysRounds34: 100,
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
  weights: ScenarioWeights = DEFAULT_WEIGHTS,
  context?: EvaluationContext,
  options?: EvaluateChromosomeOptions
): { fitness: number; objectives: ScheduleObjectives } {
  const evaluationContext = context ?? createEvaluationContext(baseLots);
  const genesByIndex = mapChromosomeGenesByLotIndex(chromosome, evaluationContext);

  const incrementalState = evaluationContext.incrementalStateByChromosome.get(chromosome);
  if (incrementalState) {
    const changedLotIndices = resolveChangedLotIndices(
      incrementalState,
      genesByIndex,
      evaluationContext,
      options?.changedLotIds
    );

    if (changedLotIndices.length > 0) {
      applyDeltaEvaluation(incrementalState, changedLotIndices, genesByIndex, evaluationContext);
      const updatedSignature = chromosomeSignature(chromosome, evaluationContext, genesByIndex);
      evaluationContext.objectiveCache.set(updatedSignature, snapshotCachedEvaluation(incrementalState));
    }

    let penalty = scalarizeObjectives(incrementalState.objectives, weights);

    if (weights.d0OffsetPenalty > 0) {
      penalty += incrementalState.basePenaltyTerms.totalOffsetAbs * weights.d0OffsetPenalty;
    }

    if (weights.gapChangePenalty > 0) {
      penalty += incrementalState.basePenaltyTerms.totalGapChanges * weights.gapChangePenalty;
    }

    const fitness = 1 / (1 + penalty);
    return { fitness, objectives: incrementalState.objectives };
  }

  const signature = chromosomeSignature(chromosome, evaluationContext, genesByIndex);
  const cached = evaluationContext.objectiveCache.get(signature);

  if (cached) {
    let penalty = scalarizeObjectives(cached.objectives, weights);

    if (weights.d0OffsetPenalty > 0) {
      penalty += cached.basePenaltyTerms.totalOffsetAbs * weights.d0OffsetPenalty;
    }

    if (weights.gapChangePenalty > 0) {
      penalty += cached.basePenaltyTerms.totalGapChanges * weights.gapChangePenalty;
    }

    const fitness = 1 / (1 + penalty);
    return { fitness, objectives: cached.objectives };
  }

  const createdState = buildIncrementalEvaluationState(genesByIndex, evaluationContext);
  evaluationContext.incrementalStateByChromosome.set(chromosome, createdState);
  evaluationContext.objectiveCache.set(signature, snapshotCachedEvaluation(createdState));

  const objectives = createdState.objectives;
  let penalty = scalarizeObjectives(objectives, weights);

  if (weights.d0OffsetPenalty > 0) {
    penalty += createdState.basePenaltyTerms.totalOffsetAbs * weights.d0OffsetPenalty;
  }

  if (weights.gapChangePenalty > 0) {
    penalty += createdState.basePenaltyTerms.totalGapChanges * weights.gapChangePenalty;
  }

  const fitness = 1 / (1 + penalty);

  return { fitness, objectives };
}
