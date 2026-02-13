import { Lot } from '@/domain/value-objects/Lot';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';
import {
  Chromosome,
  GeneticParams,
  ScenarioWeights,
  ScenarioProfile,
  DEFAULT_GA_PARAMS,
} from './types';
import {
  tournamentSelection,
  twoPointCrossover,
  gaussianMutation,
  createRandomChromosome,
} from './genetic-operators';
import { evaluateChromosome, SCENARIO_PROFILES } from './fitness-calculator';
import { nehInitialization } from './neh-heuristic';
import { applyChromosome } from './diversity-selector';

/**
 * Scheduler baseado em Algoritmo Genetico
 * Executa 4 otimizacoes independentes, uma por perfil de cenario
 */
export class GeneticScheduler {
  constructor(
    private readonly lots: Lot[],
    private readonly params: GeneticParams = DEFAULT_GA_PARAMS
  ) {}

  /**
   * Otimiza cronograma gerando 4 cenarios com objetivos distintos
   */
  async optimize(): Promise<OptimizationScenario[]> {
    const profiles = SCENARIO_PROFILES;
    const timePerProfile = Math.floor(this.params.timeLimitMs / profiles.length);

    const scenarios: OptimizationScenario[] = [];

    for (const profile of profiles) {
      const scenario = await this.optimizeForProfile(profile, timePerProfile);
      scenarios.push(scenario);
    }

    return scenarios;
  }

  /**
   * Executa GA otimizando para um perfil especifico
   */
  private async optimizeForProfile(
    profile: ScenarioProfile,
    timeLimitMs: number
  ): Promise<OptimizationScenario> {
    const startTime = Date.now();
    const weights = profile.weights;

    // 1. Inicializar populacao
    let population = this.initializePopulation(weights);

    // 2. Avaliar populacao inicial
    this.evaluatePopulation(population, weights);

    // 3. Evoluir ate timeout
    let generation = 0;
    while (Date.now() - startTime < timeLimitMs) {
      population = this.evolveGeneration(population, weights);
      generation++;

      if (generation % 5 === 0) {
        await this.yieldToUI();
      }
    }

    // 4. Pegar o melhor cromossomo
    population.sort((a, b) => b.fitness - a.fitness);
    const best = population[0]!;

    // 5. Converter para cenario
    const adjustedLots = applyChromosome(best, this.lots);
    return OptimizationScenario.create(
      profile.name,
      adjustedLots,
      best.objectives!,
      best.fitness,
      profile.description
    );
  }

  /**
   * Inicializa populacao com NEH + aleatorios
   */
  private initializePopulation(weights: ScenarioWeights): Chromosome[] {
    const population: Chromosome[] = [];

    // 1 solucao NEH (boa heuristica)
    const nehSolution = nehInitialization(this.lots, weights);
    population.push(nehSolution);

    // Resto aleatorio
    const lotIds = this.lots.map((l) => l.id);
    for (let i = 1; i < this.params.populationSize; i++) {
      const chromosome = createRandomChromosome(
        lotIds,
        this.params.maxD0Adjustment
      );
      population.push(chromosome);
    }

    return population;
  }

  /**
   * Avalia fitness de toda a populacao
   */
  private evaluatePopulation(
    population: Chromosome[],
    weights: ScenarioWeights
  ): void {
    for (const chromosome of population) {
      const { fitness, objectives } = evaluateChromosome(
        chromosome,
        this.lots,
        weights
      );
      chromosome.fitness = fitness;
      chromosome.objectives = objectives;
    }
  }

  /**
   * Evolve uma geracao
   */
  private evolveGeneration(
    population: Chromosome[],
    weights: ScenarioWeights
  ): Chromosome[] {
    // Ordenar por fitness
    population.sort((a, b) => b.fitness - a.fitness);

    // Preservar elite
    const elite = population.slice(0, this.params.eliteSize);

    // Gerar nova populacao
    const newPopulation: Chromosome[] = [...elite];

    while (newPopulation.length < this.params.populationSize) {
      // Selecao
      const parent1 = tournamentSelection(
        population,
        this.params.tournamentSize
      );
      const parent2 = tournamentSelection(
        population,
        this.params.tournamentSize
      );

      // Crossover
      let child1: Chromosome;
      let child2: Chromosome;

      if (Math.random() < this.params.crossoverRate) {
        [child1, child2] = twoPointCrossover(parent1, parent2);
      } else {
        child1 = { genes: [...parent1.genes], fitness: 0 };
        child2 = { genes: [...parent2.genes], fitness: 0 };
      }

      // Mutacao
      gaussianMutation(child1, this.params.mutationRate, this.params.maxD0Adjustment);
      gaussianMutation(child2, this.params.mutationRate, this.params.maxD0Adjustment);

      newPopulation.push(child1);
      if (newPopulation.length < this.params.populationSize) {
        newPopulation.push(child2);
      }
    }

    // Avaliar nova populacao
    this.evaluatePopulation(newPopulation, weights);

    return newPopulation;
  }

  /**
   * Yield para nao bloquear UI
   */
  private async yieldToUI(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
}
