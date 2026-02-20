import { Lot } from '@/domain/value-objects/Lot';
import {
  OptimizationScenario,
  ScheduleObjectives,
} from '@/domain/value-objects/OptimizationScenario';
import { applyChromosome, selectDiverseTop4 } from './diversity-selector';
import {
  chromosomeSignature,
  createEvaluationContext,
  DEFAULT_WEIGHTS,
  evaluateChromosome,
  EvaluationContext,
  SCENARIO_PROFILES,
} from './fitness-calculator';
import {
  Chromosome,
  DEFAULT_GA_PARAMS,
  GeneticParams,
  ScenarioProfile,
  ScenarioWeights,
} from './types';

const TARGET_SCENARIO_COUNT = 4;
const DIVERSITY_MIN_DISTANCE = 10;
const DEFAULT_MIN_REMAINING_BUDGET_MS = 2;
const DEFAULT_GAP = 22;

const BALANCED_REFERENCE_WEIGHTS: ScenarioWeights =
  SCENARIO_PROFILES.find((profile) => profile.name === 'Balanceado')?.weights ?? DEFAULT_WEIGHTS;

interface AssignmentOption {
  d0Offset: number;
  roundGaps: [number, number, number];
}

interface ProfileSearchResult {
  candidates: Chromosome[];
  evaluatedCount: number;
}

/**
 * Estrategia CP-SAT para instancias pequenas.
 *
 * Implementa uma busca combinatoria guiada por tempo e por limite de avaliacoes,
 * com selecao final por diversidade para manter o mesmo contrato de 4 cenarios.
 */
export class CpSatScheduler {
  private readonly evaluationContext: EvaluationContext;
  private readonly assignmentDomainByLotIndex: AssignmentOption[][];

  constructor(
    private readonly lots: Lot[],
    private readonly params: GeneticParams = DEFAULT_GA_PARAMS
  ) {
    this.evaluationContext = createEvaluationContext(this.lots);
    this.assignmentDomainByLotIndex = this.buildAssignmentDomains();
  }

  async optimize(): Promise<{ scenarios: OptimizationScenario[]; totalCombinations: number }> {
    const deadlineMs = Date.now() + this.params.timeLimitMs;
    let totalCombinations = 0;
    const profileCandidates: Chromosome[] = [];

    for (let profileIndex = 0; profileIndex < SCENARIO_PROFILES.length; profileIndex++) {
      if (!this.hasRemainingBudget(deadlineMs, DEFAULT_MIN_REMAINING_BUDGET_MS)) {
        break;
      }

      const profile = SCENARIO_PROFILES[profileIndex];
      if (!profile) {
        continue;
      }

      const searchResult = this.solveProfile(profile, deadlineMs);
      totalCombinations += searchResult.evaluatedCount;
      profileCandidates.push(...searchResult.candidates);

      await this.maybeYield(profileIndex + 1);
    }

    const reranked = this.rerankCandidates(profileCandidates);
    const fallbackResult = this.ensureMinimumCandidates(reranked, TARGET_SCENARIO_COUNT);
    totalCombinations += fallbackResult.evaluatedCount;

    const selected = this.ensureScenarioCount(
      selectDiverseTop4(
        fallbackResult.candidates,
        this.lots,
        DIVERSITY_MIN_DISTANCE,
        this.evaluationContext
      ),
      fallbackResult.candidates
    );

    const scenarios = selected.map((chromosome, index) => {
      const adjustedLots = applyChromosome(chromosome, this.lots, this.evaluationContext);

      return OptimizationScenario.create(
        `CP-SAT ${index + 1}`,
        adjustedLots,
        chromosome.objectives ?? this.emptyObjectives(),
        chromosome.fitness,
        'Solucao gerada por busca CP-SAT para instancias pequenas e selecionada por diversidade.'
      );
    });

    return {
      scenarios,
      totalCombinations,
    };
  }

  private solveProfile(profile: ScenarioProfile, deadlineMs: number): ProfileSearchResult {
    const maxEvaluations = Math.max(1, Math.floor(this.params.cpSatMaxEvaluationsPerProfile));
    const maxCandidates = Math.max(1, Math.floor(this.params.cpSatTopCandidatesPerProfile));

    const chromosome = this.createBaselineChromosome();
    const candidateBySignature = new Map<string, Chromosome>();
    let evaluatedCount = 0;

    const evaluateCurrent = (): void => {
      const evaluation = evaluateChromosome(
        chromosome,
        this.lots,
        profile.weights,
        this.evaluationContext
      );

      evaluatedCount += 1;

      const signature = chromosomeSignature(chromosome, this.evaluationContext);
      const existing = candidateBySignature.get(signature);
      if (!existing || evaluation.fitness > existing.fitness) {
        candidateBySignature.set(
          signature,
          this.cloneChromosome(chromosome, evaluation.fitness, evaluation.objectives)
        );
      }

      const softMaxPool = Math.max(maxCandidates * 8, maxCandidates + 1);
      if (candidateBySignature.size > softMaxPool) {
        this.trimCandidatePool(candidateBySignature, softMaxPool);
      }
    };

    const search = (lotIndex: number): void => {
      if (
        evaluatedCount >= maxEvaluations ||
        !this.hasRemainingBudget(deadlineMs, DEFAULT_MIN_REMAINING_BUDGET_MS)
      ) {
        return;
      }

      if (lotIndex >= chromosome.genes.length) {
        evaluateCurrent();
        return;
      }

      const gene = chromosome.genes[lotIndex];
      const assignments = this.assignmentDomainByLotIndex[lotIndex];

      if (!gene || !assignments || assignments.length === 0) {
        search(lotIndex + 1);
        return;
      }

      for (const assignment of assignments) {
        if (
          evaluatedCount >= maxEvaluations ||
          !this.hasRemainingBudget(deadlineMs, DEFAULT_MIN_REMAINING_BUDGET_MS)
        ) {
          break;
        }

        gene.d0Offset = assignment.d0Offset;
        gene.roundGaps = assignment.roundGaps;

        search(lotIndex + 1);
      }
    };

    search(0);

    if (candidateBySignature.size === 0) {
      evaluateCurrent();
    }

    this.trimCandidatePool(candidateBySignature, maxCandidates);

    const candidates = [...candidateBySignature.values()].sort((a, b) => b.fitness - a.fitness);

    return {
      candidates,
      evaluatedCount,
    };
  }

  private buildAssignmentDomains(): AssignmentOption[][] {
    const domains: AssignmentOption[][] = [];
    const maxAdjustment = Math.max(0, Math.floor(this.params.maxD0Adjustment));
    const offsetDomain = this.buildOffsetDomain(maxAdjustment);

    for (const lot of this.lots) {
      const baseGaps = this.normalizeRoundGaps(lot.roundGaps);
      const gapTuples = this.buildGapTupleDomain(baseGaps);

      const options: AssignmentOption[] = [];

      for (const d0Offset of offsetDomain) {
        for (const gapTuple of gapTuples) {
          options.push({
            d0Offset,
            roundGaps: gapTuple,
          });
        }
      }

      options.sort((a, b) => {
        const scoreA = Math.abs(a.d0Offset) * 4 + this.gapDistance(a.roundGaps, baseGaps);
        const scoreB = Math.abs(b.d0Offset) * 4 + this.gapDistance(b.roundGaps, baseGaps);
        return scoreA - scoreB;
      });

      domains.push(options);
    }

    return domains;
  }

  private buildOffsetDomain(maxAdjustment: number): number[] {
    const offsets = new Set<number>([0]);

    for (let delta = 1; delta <= maxAdjustment; delta++) {
      offsets.add(delta);
      offsets.add(-delta);
    }

    return [...offsets.values()].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  }

  private buildGapTupleDomain(baseGaps: [number, number, number]): [number, number, number][] {
    const gap0Values = this.uniqueNumbers([baseGaps[0], 21, 22, 23]);
    const gap1Values = this.uniqueNumbers([baseGaps[1], 21, 22, 23]);
    const gap2Values = this.uniqueNumbers([baseGaps[2], 21, 22, 23]);

    const tuples: [number, number, number][] = [];
    for (const gap0 of gap0Values) {
      for (const gap1 of gap1Values) {
        for (const gap2 of gap2Values) {
          tuples.push([gap0, gap1, gap2]);
        }
      }
    }

    tuples.sort((a, b) => this.gapDistance(a, baseGaps) - this.gapDistance(b, baseGaps));

    return tuples;
  }

  private uniqueNumbers(values: readonly number[]): number[] {
    const unique = new Set<number>();
    for (const value of values) {
      if (Number.isFinite(value) && value > 0) {
        unique.add(Math.floor(value));
      }
    }
    return [...unique.values()];
  }

  private gapDistance(
    candidate: [number, number, number],
    base: [number, number, number]
  ): number {
    return (
      Math.abs(candidate[0] - base[0]) +
      Math.abs(candidate[1] - base[1]) +
      Math.abs(candidate[2] - base[2])
    );
  }

  private rerankCandidates(candidates: Chromosome[]): Chromosome[] {
    const deduped = new Map<string, Chromosome>();

    for (const candidate of candidates) {
      const evaluation = evaluateChromosome(
        candidate,
        this.lots,
        BALANCED_REFERENCE_WEIGHTS,
        this.evaluationContext
      );

      candidate.fitness = evaluation.fitness;
      candidate.objectives = { ...evaluation.objectives };

      const signature = chromosomeSignature(candidate, this.evaluationContext);
      const existing = deduped.get(signature);
      if (!existing || candidate.fitness > existing.fitness) {
        deduped.set(signature, candidate);
      }
    }

    return [...deduped.values()].sort((a, b) => b.fitness - a.fitness);
  }

  private ensureMinimumCandidates(
    currentCandidates: Chromosome[],
    minimumCount: number
  ): { candidates: Chromosome[]; evaluatedCount: number } {
    if (currentCandidates.length >= minimumCount) {
      return {
        candidates: currentCandidates,
        evaluatedCount: 0,
      };
    }

    const signatures = new Set(
      currentCandidates.map((candidate) => chromosomeSignature(candidate, this.evaluationContext))
    );

    let evaluatedCount = 0;
    for (const fallback of this.createFallbackChromosomes()) {
      if (currentCandidates.length >= minimumCount) {
        break;
      }

      const signature = chromosomeSignature(fallback, this.evaluationContext);
      if (signatures.has(signature)) {
        continue;
      }

      const evaluation = evaluateChromosome(
        fallback,
        this.lots,
        BALANCED_REFERENCE_WEIGHTS,
        this.evaluationContext
      );

      fallback.fitness = evaluation.fitness;
      fallback.objectives = { ...evaluation.objectives };
      currentCandidates.push(fallback);
      signatures.add(signature);
      evaluatedCount += 1;
    }

    currentCandidates.sort((a, b) => b.fitness - a.fitness);

    return {
      candidates: currentCandidates,
      evaluatedCount,
    };
  }

  private ensureScenarioCount(selected: Chromosome[], rankedCandidates: Chromosome[]): Chromosome[] {
    if (selected.length >= TARGET_SCENARIO_COUNT) {
      return selected.slice(0, TARGET_SCENARIO_COUNT);
    }

    const signatures = new Set(
      selected.map((candidate) => chromosomeSignature(candidate, this.evaluationContext))
    );

    for (const candidate of rankedCandidates) {
      if (selected.length >= TARGET_SCENARIO_COUNT) {
        break;
      }

      const signature = chromosomeSignature(candidate, this.evaluationContext);
      if (signatures.has(signature)) {
        continue;
      }

      selected.push(candidate);
      signatures.add(signature);
    }

    return selected;
  }

  private createBaselineChromosome(): Chromosome {
    const genes = this.lots.map((lot) => ({
      lotId: lot.id,
      d0Offset: 0,
      roundGaps: this.normalizeRoundGaps(lot.roundGaps),
    }));

    return {
      genes,
      fitness: 0,
    };
  }

  private createFallbackChromosomes(): Chromosome[] {
    const baseline = this.createBaselineChromosome();
    const maxAdjustment = Math.max(1, Math.floor(this.params.maxD0Adjustment));

    const allForward = this.cloneChromosome(baseline, baseline.fitness, baseline.objectives);
    const allBackward = this.cloneChromosome(baseline, baseline.fitness, baseline.objectives);
    const compressed = this.cloneChromosome(baseline, baseline.fitness, baseline.objectives);
    const stretched = this.cloneChromosome(baseline, baseline.fitness, baseline.objectives);

    for (const gene of allForward.genes) {
      gene.d0Offset = Math.min(1, maxAdjustment);
    }

    for (const gene of allBackward.genes) {
      gene.d0Offset = -Math.min(1, maxAdjustment);
    }

    for (const gene of compressed.genes) {
      gene.roundGaps = [21, 21, 21];
    }

    for (const gene of stretched.genes) {
      gene.roundGaps = [23, 23, 23];
    }

    return [baseline, allForward, allBackward, compressed, stretched];
  }

  private cloneChromosome(
    chromosome: Chromosome,
    fitness: number,
    objectives: ScheduleObjectives | undefined
  ): Chromosome {
    const cloned: Chromosome = {
      genes: chromosome.genes.map((gene) => ({
        lotId: gene.lotId,
        d0Offset: gene.d0Offset,
        roundGaps: [...gene.roundGaps] as [number, number, number],
      })),
      fitness,
    };

    if (objectives) {
      cloned.objectives = { ...objectives };
    }

    return cloned;
  }

  private trimCandidatePool(pool: Map<string, Chromosome>, keepCount: number): void {
    const ranked = [...pool.entries()].sort((a, b) => b[1].fitness - a[1].fitness);
    pool.clear();

    for (let i = 0; i < keepCount; i++) {
      const item = ranked[i];
      if (!item) {
        break;
      }
      pool.set(item[0], item[1]);
    }
  }

  private normalizeRoundGaps(roundGaps: readonly number[]): [number, number, number] {
    const gap0 = Math.floor(roundGaps[0] ?? DEFAULT_GAP);
    const gap1 = Math.floor(roundGaps[1] ?? DEFAULT_GAP);
    const gap2 = Math.floor(roundGaps[2] ?? DEFAULT_GAP);

    return [gap0, gap1, gap2];
  }

  private hasRemainingBudget(deadlineMs: number, minBufferMs: number): boolean {
    return Date.now() + minBufferMs < deadlineMs;
  }

  private emptyObjectives(): ScheduleObjectives {
    return {
      sundaysRounds12: 0,
      sundaysRounds34: 0,
      overlapsRounds12: 0,
      overlapsRounds34: 0,
      totalCycleDays: 0,
      intervalViolations: 0,
    };
  }

  private async maybeYield(step: number): Promise<void> {
    if (step % 2 !== 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
