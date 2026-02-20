import { Lot } from '@/domain/value-objects/Lot';
import {
  OptimizationScenario,
  ScheduleObjectives,
} from '@/domain/value-objects/OptimizationScenario';
import {
  Chromosome,
  GeneticParams,
  ScenarioWeights,
  DEFAULT_GA_PARAMS,
} from './types';
import {
  twoPointCrossover,
  gaussianMutation,
  createRandomChromosome,
} from './genetic-operators';
import {
  canonicalizeChromosomeInPlace,
  chromosomeSignature,
  createEvaluationContext,
  DEFAULT_WEIGHTS,
  evaluateChromosome,
  EvaluationContext,
  SCENARIO_PROFILES,
} from './fitness-calculator';
import { nehInitialization } from './neh-heuristic';
import { applyChromosome, selectDiverseTop4 } from './diversity-selector';

interface IslandPopulationState {
  population: Chromosome[];
  generation: number;
}

const TARGET_SCENARIO_COUNT = 4;
const DIVERSITY_MIN_DISTANCE = 10;
const OBJECTIVE_KEYS: Array<keyof ScheduleObjectives> = [
  'intervalViolations',
  'overlapsRounds12',
  'sundaysRounds12',
  'overlapsRounds34',
  'sundaysRounds34',
  'totalCycleDays',
];

const BALANCED_REFERENCE_WEIGHTS: ScenarioWeights =
  SCENARIO_PROFILES.find((profile) => profile.name === 'Balanceado')?.weights ?? DEFAULT_WEIGHTS;

/**
 * Scheduler baseado em algoritmo genetico com selecao multiobjetivo (estilo NSGA-II)
 * e passo memetico em elites para refino local.
 */
export class GeneticScheduler {
  private readonly evaluationContext: EvaluationContext;

  constructor(
    private readonly lots: Lot[],
    private readonly params: GeneticParams = DEFAULT_GA_PARAMS
  ) {
    this.evaluationContext = createEvaluationContext(this.lots);
  }

  async optimize(): Promise<{ scenarios: OptimizationScenario[]; totalCombinations: number }> {
    const attempts = Math.max(1, Math.floor(this.params.attemptsPerProfile));
    const deadlineMs = Date.now() + this.params.timeLimitMs;
    const minAttemptBudgetMs = this.params.minAttemptBudgetMs ?? 200;
    const deadlineSafetyMs = this.params.deadlineSafetyMs ?? 20;
    const islandCount = this.resolveIslandCount();

    console.log(`🧬 Otimizacao multiobjetivo iniciada: ${attempts} tentativa(s)`);
    console.log(
      `🏝️ Modo ilhas: ${islandCount} | migracao a cada ${this.params.migrationIntervalGenerations} geracoes (top-${this.params.migrationTopK})`
    );

    let totalCombinations = 0;
    let candidates: Chromosome[] = [];

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (!this.hasRemainingBudget(deadlineMs, Math.max(minAttemptBudgetMs, deadlineSafetyMs))) {
        break;
      }

      const { paretoCandidates, evaluatedCount } = await this.runGeneticAlgorithm(deadlineMs);
      totalCombinations += evaluatedCount;
      candidates.push(...paretoCandidates);

      await this.maybeYield(attempt + 1);
    }

    candidates = this.deduplicateCandidates(candidates);

    const fallbackResult = this.ensureMinimumCandidates(candidates, TARGET_SCENARIO_COUNT);
    candidates = fallbackResult.candidates;
    totalCombinations += fallbackResult.evaluatedCount;

    console.log(`✅ Pool de candidatos: ${candidates.length}`);
    console.log(`🔢 Total combinacoes: ${totalCombinations}`);

    const paretoPool = this.selectFromParetoFront(candidates, Math.max(16, TARGET_SCENARIO_COUNT * 4));
    const selectedChromosomes = this.ensureScenarioCount(
      selectDiverseTop4(
        paretoPool,
        this.lots,
        DIVERSITY_MIN_DISTANCE,
        this.evaluationContext
      ),
      candidates
    );

    console.log(`🎯 Selecionados: ${selectedChromosomes.length}`);

    const scenarios = selectedChromosomes.map((chromosome, index) => {
      const adjustedLots = applyChromosome(chromosome, this.lots, this.evaluationContext);
      return OptimizationScenario.create(
        `Pareto ${index + 1}`,
        adjustedLots,
        chromosome.objectives ?? this.emptyObjectives(),
        chromosome.fitness,
        'Solucao nao-dominada selecionada por diversidade e qualidade local.'
      );
    });

    return { scenarios, totalCombinations };
  }

  private async runGeneticAlgorithm(
    deadlineMs: number
  ): Promise<{ paretoCandidates: Chromosome[]; evaluatedCount: number }> {
    const deadlineSafetyMs = this.params.deadlineSafetyMs ?? 20;

    const islandCount = this.resolveIslandCount();
    const islandSizes = this.buildIslandPopulationSizes(islandCount);
    const islands: IslandPopulationState[] = [];

    let evaluatedCount = 0;
    for (let islandIndex = 0; islandIndex < islandSizes.length; islandIndex++) {
      const islandSize = islandSizes[islandIndex] ?? 1;
      const population = this.initializePopulation(islandSize, islandIndex === 0);
      evaluatedCount += this.evaluatePopulation(population);
      this.assignParetoMetrics(population);
      islands.push({
        population,
        generation: 0,
      });
    }

    const migrationInterval = Math.max(1, this.params.migrationIntervalGenerations);
    let globalGeneration = 0;

    evolutionLoop:
    while (this.hasRemainingBudget(deadlineMs, deadlineSafetyMs)) {
      for (const island of islands) {
        if (!this.hasRemainingBudget(deadlineMs, deadlineSafetyMs)) {
          break evolutionLoop;
        }

        const nextGeneration = this.evolveGeneration(
          island.population,
          island.population.length,
          island.generation + 1
        );

        island.population = nextGeneration.population;
        island.generation += 1;
        evaluatedCount += nextGeneration.evaluatedCount;
      }

      globalGeneration += 1;

      if (islands.length > 1 && globalGeneration % migrationInterval === 0) {
        this.migrateIslands(islands);
      }

      await this.maybeYield(globalGeneration);
    }

    const flattenedPopulation = islands.flatMap((island) => island.population);
    const paretoCandidates = this.selectFromParetoFront(
      flattenedPopulation,
      Math.max(12, TARGET_SCENARIO_COUNT * 3)
    ).map((chromosome) => this.cloneChromosome(chromosome));

    return { paretoCandidates, evaluatedCount };
  }

  private resolveIslandCount(): number {
    const requestedIslands = Number.isFinite(this.params.islandCount)
      ? Math.floor(this.params.islandCount)
      : 1;
    return Math.max(1, Math.min(requestedIslands, this.params.populationSize));
  }

  private buildIslandPopulationSizes(islandCount: number): number[] {
    const totalPopulation = Math.max(1, this.params.populationSize);
    const sizes = new Array<number>(islandCount).fill(1);

    let remaining = totalPopulation - islandCount;
    let cursor = 0;

    while (remaining > 0) {
      sizes[cursor] = (sizes[cursor] ?? 1) + 1;
      cursor = (cursor + 1) % islandCount;
      remaining--;
    }

    return sizes;
  }

  private migrateIslands(islands: IslandPopulationState[]): void {
    const migrationTopK = Math.max(1, this.params.migrationTopK);

    const migrantsByIsland = islands.map((island) => {
      this.assignParetoMetrics(island.population);
      const ranked = [...island.population].sort((a, b) => this.comparePareto(a, b));
      const takeCount = Math.min(migrationTopK, ranked.length);
      return ranked.slice(0, takeCount).map((chromosome) => this.cloneChromosome(chromosome));
    });

    for (let islandIndex = 0; islandIndex < islands.length; islandIndex++) {
      const destination = islands[islandIndex];
      if (!destination) {
        continue;
      }

      const sourceIndex = (islandIndex - 1 + islands.length) % islands.length;
      const incoming = migrantsByIsland[sourceIndex] ?? [];

      if (incoming.length === 0) {
        continue;
      }

      this.assignParetoMetrics(destination.population);
      const ranked = [...destination.population].sort((a, b) => this.comparePareto(a, b));
      const survivorCount = Math.max(0, ranked.length - incoming.length);
      const survivors = ranked.slice(0, survivorCount);
      const immigrants = incoming.slice(0, ranked.length - survivors.length);

      destination.population = [...survivors, ...immigrants];
      this.assignParetoMetrics(destination.population);
    }
  }

  private initializePopulation(
    populationSize: number,
    includeNehSeed: boolean
  ): Chromosome[] {
    const rng = this.params.rng ?? Math.random;
    const population: Chromosome[] = [];

    if (populationSize <= 1) {
      population.push(this.createBaselineChromosome());
      return population;
    }

    let randomStartIndex = 1;

    if (includeNehSeed && populationSize > 1) {
      const nehSolution = nehInitialization(this.lots, BALANCED_REFERENCE_WEIGHTS, this.evaluationContext);
      canonicalizeChromosomeInPlace(nehSolution, this.evaluationContext);
      population.push(nehSolution);
      randomStartIndex = 2;
    }

    population.push(this.createBaselineChromosome());

    const lotIds = this.lots.map((lot) => lot.id);
    for (let i = randomStartIndex; i < populationSize; i++) {
      const chromosome = createRandomChromosome(lotIds, this.params.maxD0Adjustment, rng);
      population.push(chromosome);
    }

    return population;
  }

  private evaluatePopulation(population: Chromosome[]): number {
    for (const chromosome of population) {
      const { fitness, objectives } = evaluateChromosome(
        chromosome,
        this.lots,
        BALANCED_REFERENCE_WEIGHTS,
        this.evaluationContext
      );

      chromosome.fitness = fitness;
      chromosome.objectives = objectives;
    }

    return population.length;
  }

  private evolveGeneration(
    population: Chromosome[],
    targetPopulationSize: number,
    generationNumber: number
  ): { population: Chromosome[]; evaluatedCount: number } {
    const rng = this.params.rng ?? Math.random;

    this.assignParetoMetrics(population);

    const offspring: Chromosome[] = [];
    while (offspring.length < targetPopulationSize) {
      const parent1 = this.paretoTournamentSelection(population, rng);
      const parent2 = this.paretoTournamentSelection(population, rng);

      let child1: Chromosome;
      let child2: Chromosome;

      if (rng() < this.params.crossoverRate) {
        [child1, child2] = twoPointCrossover(parent1, parent2, rng);
      } else {
        child1 = this.cloneChromosome(parent1);
        child1.fitness = 0;
        delete child1.objectives;
        child2 = this.cloneChromosome(parent2);
        child2.fitness = 0;
        delete child2.objectives;
      }

      gaussianMutation(child1, this.params.mutationRate, this.params.maxD0Adjustment, rng);
      gaussianMutation(child2, this.params.mutationRate, this.params.maxD0Adjustment, rng);

      canonicalizeChromosomeInPlace(child1, this.evaluationContext);
      canonicalizeChromosomeInPlace(child2, this.evaluationContext);

      offspring.push(child1);
      if (offspring.length < targetPopulationSize) {
        offspring.push(child2);
      }
    }

    let evaluatedCount = this.evaluatePopulation(offspring);

    const combined = [...population, ...offspring];
    const nextPopulation = this.selectNextGeneration(combined, targetPopulationSize);

    evaluatedCount += this.applyMemeticStep(nextPopulation, generationNumber);
    this.assignParetoMetrics(nextPopulation);

    return {
      population: nextPopulation,
      evaluatedCount,
    };
  }

  private paretoTournamentSelection(
    population: Chromosome[],
    rng: () => number
  ): Chromosome {
    const tournamentSize = Math.max(2, this.params.tournamentSize);
    const firstIndex = Math.floor(rng() * population.length);
    let best = population[firstIndex] ?? population[0]!;

    for (let i = 1; i < tournamentSize; i++) {
      const index = Math.floor(rng() * population.length);
      const contender = population[index];
      if (!contender) {
        continue;
      }

      const comparison = this.comparePareto(contender, best);
      if (comparison < 0 || (comparison === 0 && rng() < 0.5)) {
        best = contender;
      }
    }

    return best;
  }

  private selectNextGeneration(
    combined: Chromosome[],
    targetPopulationSize: number
  ): Chromosome[] {
    const fronts = this.assignParetoMetrics(combined);
    const nextPopulation: Chromosome[] = [];

    for (const front of fronts) {
      if (nextPopulation.length + front.length <= targetPopulationSize) {
        nextPopulation.push(...front);
        continue;
      }

      const remainingSlots = targetPopulationSize - nextPopulation.length;
      const ranked = [...front].sort((a, b) => this.comparePareto(a, b));
      nextPopulation.push(...ranked.slice(0, remainingSlots));
      break;
    }

    return nextPopulation;
  }

  private selectFromParetoFront(
    population: Chromosome[],
    maxCandidates: number
  ): Chromosome[] {
    if (population.length === 0) {
      return [];
    }

    const fronts = this.assignParetoMetrics(population);
    const selected: Chromosome[] = [];

    for (const front of fronts) {
      if (selected.length >= maxCandidates) {
        break;
      }

      if (selected.length + front.length <= maxCandidates) {
        selected.push(...front);
        continue;
      }

      const remainingSlots = maxCandidates - selected.length;
      const ranked = [...front].sort((a, b) => this.comparePareto(a, b));
      selected.push(...ranked.slice(0, remainingSlots));
    }

    return selected;
  }

  private applyMemeticStep(population: Chromosome[], generationNumber: number): number {
    const interval = Math.max(0, Math.floor(this.params.memeticIntervalGenerations));
    if (interval === 0 || generationNumber % interval !== 0 || population.length === 0) {
      return 0;
    }

    const eliteCount = Math.min(
      population.length,
      Math.max(1, Math.floor(this.params.memeticEliteCount))
    );
    const lotSampleSize = Math.max(1, Math.floor(this.params.memeticLotSampleSize));
    const maxImprovements = Math.max(1, Math.floor(this.params.memeticMaxImprovements));
    const maxNeighborEvaluations = Math.max(0, Math.floor(this.params.memeticMaxNeighborEvaluations));

    if (maxNeighborEvaluations === 0) {
      return 0;
    }

    this.assignParetoMetrics(population);

    const rankedElites = population
      .map((chromosome, index) => ({ chromosome, index }))
      .sort((a, b) => this.comparePareto(a.chromosome, b.chromosome))
      .slice(0, eliteCount);

    const rng = this.params.rng ?? Math.random;
    let evaluatedCount = 0;

    for (const elite of rankedElites) {
      if (evaluatedCount >= maxNeighborEvaluations) {
        break;
      }

      let incumbent = this.cloneChromosome(elite.chromosome);
      let improvementCount = 0;

      while (improvementCount < maxImprovements && evaluatedCount < maxNeighborEvaluations) {
        const lotIndices = this.sampleLotIndices(incumbent.genes.length, lotSampleSize, rng);
        let bestNeighbor: Chromosome | undefined;

        for (const lotIndex of lotIndices) {
          if (evaluatedCount >= maxNeighborEvaluations) {
            break;
          }

          const neighbors = this.generateLocalNeighbors(incumbent, lotIndex);
          const lotId = incumbent.genes[lotIndex]?.lotId;

          for (const neighbor of neighbors) {
            if (evaluatedCount >= maxNeighborEvaluations) {
              break;
            }

            canonicalizeChromosomeInPlace(neighbor, this.evaluationContext);
            const evaluation = evaluateChromosome(
              neighbor,
              this.lots,
              BALANCED_REFERENCE_WEIGHTS,
              this.evaluationContext,
              lotId ? { changedLotIds: [lotId] } : undefined
            );

            neighbor.fitness = evaluation.fitness;
            neighbor.objectives = evaluation.objectives;
            evaluatedCount += 1;

            if (!this.isLocalImprovement(neighbor, incumbent)) {
              continue;
            }

            if (!bestNeighbor || this.isCandidateBetterForLocalSearch(neighbor, bestNeighbor)) {
              bestNeighbor = neighbor;
            }
          }
        }

        if (!bestNeighbor) {
          break;
        }

        incumbent = bestNeighbor;
        improvementCount += 1;
      }

      if (this.isLocalImprovement(incumbent, elite.chromosome)) {
        population[elite.index] = incumbent;
      }
    }

    if (evaluatedCount > 0) {
      this.assignParetoMetrics(population);
    }

    return evaluatedCount;
  }

  private generateLocalNeighbors(base: Chromosome, lotIndex: number): Chromosome[] {
    const gene = base.genes[lotIndex];
    if (!gene) {
      return [];
    }

    const neighbors: Chromosome[] = [];
    const maxAdjustment = Math.max(0, this.params.maxD0Adjustment);

    if (gene.d0Offset > -maxAdjustment) {
      const candidate = this.cloneChromosome(base);
      const candidateGene = candidate.genes[lotIndex];
      if (candidateGene) {
        candidateGene.d0Offset -= 1;
        neighbors.push(candidate);
      }
    }

    if (gene.d0Offset < maxAdjustment) {
      const candidate = this.cloneChromosome(base);
      const candidateGene = candidate.genes[lotIndex];
      if (candidateGene) {
        candidateGene.d0Offset += 1;
        neighbors.push(candidate);
      }
    }

    {
      const candidate = this.cloneChromosome(base);
      const candidateGene = candidate.genes[lotIndex];
      if (candidateGene) {
        const swap = [...candidateGene.roundGaps] as [number, number, number];
        [swap[0], swap[1]] = [swap[1], swap[0]];
        candidateGene.roundGaps = swap;
        neighbors.push(candidate);
      }
    }

    {
      const candidate = this.cloneChromosome(base);
      const candidateGene = candidate.genes[lotIndex];
      if (candidateGene) {
        const swap = [...candidateGene.roundGaps] as [number, number, number];
        [swap[1], swap[2]] = [swap[2], swap[1]];
        candidateGene.roundGaps = swap;
        neighbors.push(candidate);
      }
    }

    return neighbors;
  }

  private sampleLotIndices(
    lotCount: number,
    sampleSize: number,
    rng: () => number
  ): number[] {
    if (lotCount <= 0) {
      return [];
    }

    if (lotCount <= sampleSize) {
      return Array.from({ length: lotCount }, (_, index) => index);
    }

    const indices = Array.from({ length: lotCount }, (_, index) => index);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }

    return indices.slice(0, sampleSize);
  }

  private ensureScenarioCount(
    selected: Chromosome[],
    candidates: Chromosome[]
  ): Chromosome[] {
    if (selected.length >= TARGET_SCENARIO_COUNT) {
      return selected.slice(0, TARGET_SCENARIO_COUNT);
    }

    const signatures = new Set(selected.map((chromosome) => this.chromosomeSignature(chromosome)));
    const rankedCandidates = [...candidates].sort((a, b) => this.comparePareto(a, b));

    for (const candidate of rankedCandidates) {
      if (selected.length >= TARGET_SCENARIO_COUNT) {
        break;
      }

      const signature = this.chromosomeSignature(candidate);
      if (signatures.has(signature)) {
        continue;
      }

      selected.push(candidate);
      signatures.add(signature);
    }

    return selected;
  }

  private dominates(a: Chromosome, b: Chromosome): boolean {
    if (!a.objectives || !b.objectives) {
      return false;
    }

    let hasStrictlyBetterObjective = false;

    for (const key of OBJECTIVE_KEYS) {
      const valueA = a.objectives[key];
      const valueB = b.objectives[key];

      if (valueA > valueB) {
        return false;
      }

      if (valueA < valueB) {
        hasStrictlyBetterObjective = true;
      }
    }

    return hasStrictlyBetterObjective;
  }

  private comparePareto(a: Chromosome, b: Chromosome): number {
    const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) {
      return rankA - rankB;
    }

    const crowdingA = a.crowdingDistance ?? Number.NEGATIVE_INFINITY;
    const crowdingB = b.crowdingDistance ?? Number.NEGATIVE_INFINITY;
    if (crowdingA !== crowdingB) {
      return crowdingB - crowdingA;
    }

    return b.fitness - a.fitness;
  }

  private assignParetoMetrics(population: Chromosome[]): Chromosome[][] {
    if (population.length === 0) {
      return [];
    }

    const dominatesMap = new Map<Chromosome, Chromosome[]>();
    const dominationCount = new Map<Chromosome, number>();
    const firstFront: Chromosome[] = [];

    for (const p of population) {
      const dominatedByP: Chromosome[] = [];
      let pDominationCount = 0;

      for (const q of population) {
        if (p === q) {
          continue;
        }

        if (this.dominates(p, q)) {
          dominatedByP.push(q);
        } else if (this.dominates(q, p)) {
          pDominationCount += 1;
        }
      }

      dominatesMap.set(p, dominatedByP);
      dominationCount.set(p, pDominationCount);

      if (pDominationCount === 0) {
        p.rank = 0;
        firstFront.push(p);
      }
    }

    const fronts: Chromosome[][] = [];
    let currentFront = firstFront;
    let currentRank = 0;

    while (currentFront.length > 0) {
      fronts.push(currentFront);
      const nextFront: Chromosome[] = [];

      for (const chromosome of currentFront) {
        const dominated = dominatesMap.get(chromosome) ?? [];
        for (const dominatedChromosome of dominated) {
          const remaining = (dominationCount.get(dominatedChromosome) ?? 0) - 1;
          dominationCount.set(dominatedChromosome, remaining);

          if (remaining === 0) {
            dominatedChromosome.rank = currentRank + 1;
            nextFront.push(dominatedChromosome);
          }
        }
      }

      this.assignCrowdingDistance(currentFront);
      currentFront = nextFront;
      currentRank += 1;
    }

    return fronts;
  }

  private assignCrowdingDistance(front: Chromosome[]): void {
    if (front.length === 0) {
      return;
    }

    for (const chromosome of front) {
      chromosome.crowdingDistance = 0;
    }

    if (front.length <= 2) {
      for (const chromosome of front) {
        chromosome.crowdingDistance = Number.POSITIVE_INFINITY;
      }
      return;
    }

    for (const key of OBJECTIVE_KEYS) {
      const sorted = [...front].sort((a, b) => this.readObjective(a, key) - this.readObjective(b, key));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      if (!first || !last) {
        continue;
      }

      const minValue = this.readObjective(first, key);
      const maxValue = this.readObjective(last, key);

      first.crowdingDistance = Number.POSITIVE_INFINITY;
      last.crowdingDistance = Number.POSITIVE_INFINITY;

      const range = maxValue - minValue;
      if (range <= 0) {
        continue;
      }

      for (let i = 1; i < sorted.length - 1; i++) {
        const previous = sorted[i - 1];
        const current = sorted[i];
        const next = sorted[i + 1];

        if (!previous || !current || !next) {
          continue;
        }

        if (!Number.isFinite(current.crowdingDistance ?? 0)) {
          continue;
        }

        const normalizedDistance =
          (this.readObjective(next, key) - this.readObjective(previous, key)) / range;
        current.crowdingDistance = (current.crowdingDistance ?? 0) + normalizedDistance;
      }
    }
  }

  private readObjective(
    chromosome: Chromosome,
    key: keyof ScheduleObjectives
  ): number {
    return chromosome.objectives?.[key] ?? Number.POSITIVE_INFINITY;
  }

  private isLocalImprovement(candidate: Chromosome, incumbent: Chromosome): boolean {
    if (this.dominates(candidate, incumbent)) {
      return true;
    }

    if (this.dominates(incumbent, candidate)) {
      return false;
    }

    return candidate.fitness > incumbent.fitness;
  }

  private isCandidateBetterForLocalSearch(a: Chromosome, b: Chromosome): boolean {
    if (this.dominates(a, b)) {
      return true;
    }

    if (this.dominates(b, a)) {
      return false;
    }

    return a.fitness > b.fitness;
  }

  private hasRemainingBudget(deadlineMs: number, minBufferMs: number = 0): boolean {
    return Date.now() + minBufferMs < deadlineMs;
  }

  private createBaselineChromosome(): Chromosome {
    const baselineGenes = this.lots.map((lot) => ({
      lotId: lot.id,
      d0Offset: 0,
      roundGaps: [...lot.roundGaps].slice(0, 3) as [number, number, number],
    }));

    return { genes: baselineGenes, fitness: 0 };
  }

  private createFallbackChromosomes(): Chromosome[] {
    const maxAdjustment = Math.max(1, this.params.maxD0Adjustment);
    const offsetOne = Math.min(maxAdjustment, 1);
    const offsetTwo = Math.min(maxAdjustment, 2);

    const baseline = this.createBaselineChromosome();
    const allForward = this.cloneChromosome(baseline);
    const allBackward = this.cloneChromosome(baseline);
    const compressed = this.cloneChromosome(baseline);
    const stretched = this.cloneChromosome(baseline);
    const staggered = this.cloneChromosome(baseline);
    const reversed = this.cloneChromosome(baseline);
    const firstForward = this.cloneChromosome(baseline);
    const firstBackward = this.cloneChromosome(baseline);

    for (const gene of allForward.genes) {
      gene.d0Offset = offsetOne;
    }

    for (const gene of allBackward.genes) {
      gene.d0Offset = -offsetOne;
    }

    for (const gene of compressed.genes) {
      gene.roundGaps = [21, 21, 21];
    }

    for (const gene of stretched.genes) {
      gene.roundGaps = [23, 23, 23];
    }

    for (const gene of staggered.genes) {
      gene.roundGaps = [21, 22, 23];
    }

    for (const gene of reversed.genes) {
      gene.roundGaps = [23, 22, 21];
    }

    if (firstForward.genes[0]) {
      firstForward.genes[0].d0Offset = offsetTwo;
    }

    if (firstBackward.genes[0]) {
      firstBackward.genes[0].d0Offset = -offsetTwo;
    }

    return [
      baseline,
      allForward,
      allBackward,
      compressed,
      stretched,
      staggered,
      reversed,
      firstForward,
      firstBackward,
    ];
  }

  private ensureMinimumCandidates(
    currentCandidates: Chromosome[],
    minimumCount: number
  ): { candidates: Chromosome[]; evaluatedCount: number } {
    if (currentCandidates.length >= minimumCount) {
      return { candidates: currentCandidates, evaluatedCount: 0 };
    }

    const signatures = new Set(currentCandidates.map((candidate) => this.chromosomeSignature(candidate)));
    let evaluatedCount = 0;

    for (const chromosome of this.createFallbackChromosomes()) {
      if (currentCandidates.length >= minimumCount) {
        break;
      }

      const signature = this.chromosomeSignature(chromosome);
      if (signatures.has(signature)) {
        continue;
      }

      const evaluation = evaluateChromosome(
        chromosome,
        this.lots,
        BALANCED_REFERENCE_WEIGHTS,
        this.evaluationContext
      );

      chromosome.fitness = evaluation.fitness;
      chromosome.objectives = evaluation.objectives;

      currentCandidates.push(chromosome);
      signatures.add(signature);
      evaluatedCount += 1;
    }

    this.assignParetoMetrics(currentCandidates);

    return {
      candidates: currentCandidates,
      evaluatedCount,
    };
  }

  private deduplicateCandidates(candidates: Chromosome[]): Chromosome[] {
    this.assignParetoMetrics(candidates);

    const deduped = new Map<string, Chromosome>();
    for (const candidate of candidates) {
      const signature = this.chromosomeSignature(candidate);
      const existing = deduped.get(signature);

      if (!existing || this.comparePareto(candidate, existing) < 0) {
        deduped.set(signature, candidate);
      }
    }

    return [...deduped.values()];
  }

  private chromosomeSignature(chromosome: Chromosome): string {
    return chromosomeSignature(chromosome, this.evaluationContext);
  }

  private cloneChromosome(chromosome: Chromosome): Chromosome {
    const cloned: Chromosome = {
      genes: chromosome.genes.map((gene) => ({
        lotId: gene.lotId,
        d0Offset: gene.d0Offset,
        roundGaps: [...gene.roundGaps] as [number, number, number],
      })),
      fitness: chromosome.fitness,
    };

    if (chromosome.objectives) {
      cloned.objectives = { ...chromosome.objectives };
    }

    if (chromosome.rank !== undefined) {
      cloned.rank = chromosome.rank;
    }

    if (chromosome.crowdingDistance !== undefined) {
      cloned.crowdingDistance = chromosome.crowdingDistance;
    }

    return cloned;
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

  private async maybeYield(generation: number): Promise<void> {
    if (generation % 5 !== 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
