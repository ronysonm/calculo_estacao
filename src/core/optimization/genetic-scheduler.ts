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
import { applyChromosome, selectDiverseTop4 } from './diversity-selector';

/**
 * Scheduler baseado em Algoritmo Genetico
 * Executa multiplas otimizacoes por perfil e seleciona os 4 melhores cenarios diversos
 */
export class GeneticScheduler {
  constructor(
    private readonly lots: Lot[],
    private readonly params: GeneticParams = DEFAULT_GA_PARAMS
  ) {}

  /**
   * Otimiza cronograma gerando 4 cenarios com objetivos distintos
   * Executa multiplas tentativas por perfil para melhor exploracao
   */
  async optimize(): Promise<{ scenarios: OptimizationScenario[]; totalCombinations: number }> {
    const profiles = SCENARIO_PROFILES;
    const attemptsPerProfile = this.params.attemptsPerProfile;
    const totalAttempts = profiles.length * attemptsPerProfile;
    const timePerAttempt = Math.floor(this.params.timeLimitMs / totalAttempts);

    console.log(`🧬 Otimização iniciada: ${totalAttempts} tentativas`);
    console.log(`⏱️ Tempo por tentativa: ${timePerAttempt}ms`);

    let totalCombinations = 0;

    // Pool de candidatos (cromossomos + perfil)
    const candidates: Array<{
      chromosome: Chromosome;
      profile: ScenarioProfile;
    }> = [];

    // Executar múltiplas tentativas para cada perfil
    for (const profile of profiles) {
      for (let attempt = 0; attempt < attemptsPerProfile; attempt++) {
        const { bestChromosome, evaluatedCount } = await this.runGeneticAlgorithm(
          profile.weights,
          timePerAttempt
        );

        totalCombinations += evaluatedCount;

        candidates.push({
          chromosome: bestChromosome,
          profile: profile,
        });

        // Yield para não bloquear UI
        await this.yieldToUI();
      }
    }

    console.log(`✅ Pool de candidatos: ${candidates.length}`);
    console.log(`🔢 Total combinacoes: ${totalCombinations}`);

    // Selecionar top 4 mais diversos
    const selectedChromosomes = selectDiverseTop4(
      candidates.map((c) => c.chromosome),
      this.lots,
      10 // minDistance = 10 dias
    );

    console.log(`🎯 Selecionados: ${selectedChromosomes.length}`);

    // Converter para cenários
    const scenarios: OptimizationScenario[] = [];
    for (const chromosome of selectedChromosomes) {
      // Encontrar qual perfil gerou esse cromossomo
      const candidate = candidates.find((c) => c.chromosome === chromosome);
      const profile = candidate?.profile ?? profiles[0]!;

      const adjustedLots = applyChromosome(chromosome, this.lots);
      const scenario = OptimizationScenario.create(
        profile.name,
        adjustedLots,
        chromosome.objectives!,
        chromosome.fitness,
        profile.description
      );
      scenarios.push(scenario);
    }

    return { scenarios, totalCombinations };
  }

  /**
   * Executa uma rodada do AG e retorna o melhor cromossomo
   */
  private async runGeneticAlgorithm(
    weights: ScenarioWeights,
    timeLimitMs: number
  ): Promise<{ bestChromosome: Chromosome; evaluatedCount: number }> {
    const startTime = Date.now();
    let evaluatedCount = 0;

    // 1. Inicializar populacao
    let population = this.initializePopulation(weights);
    evaluatedCount += population.length;

    // 2. Avaliar populacao inicial
    this.evaluatePopulation(population, weights);

    // 3. Evoluir ate timeout
    let generation = 0;
    while (Date.now() - startTime < timeLimitMs) {
      population = this.evolveGeneration(population, weights);
      // Na evolucao, geramos params.populationSize novos individuos (elitismo mantem, mas reavaliamos ou novos sao criados)
      // Simplificacao: consideramos que avaliamos populationSize por geracao
      evaluatedCount += this.params.populationSize;
      
      generation++;

      if (generation % 5 === 0) {
        await this.yieldToUI();
      }
    }

    // 4. Retornar o melhor
    population.sort((a, b) => b.fitness - a.fitness);
    return { bestChromosome: population[0]!, evaluatedCount };
  }

  /**
   * Inicializa populacao com NEH + baseline + aleatorios
   */
  private initializePopulation(weights: ScenarioWeights): Chromosome[] {
    const population: Chromosome[] = [];

    // 1 solucao NEH (boa heuristica com exploracao de gaps)
    const nehSolution = nehInitialization(this.lots, weights);
    population.push(nehSolution);

    // 1 solucao baseline (sem alteracoes - garante nunca piorar)
    const baselineGenes = this.lots.map((lot) => ({
      lotId: lot.id,
      d0Offset: 0,
      roundGaps: [...lot.roundGaps].slice(0, 3) as [number, number, number],
    }));
    population.push({ genes: baselineGenes, fitness: 0 });

    // Resto aleatorio
    const lotIds = this.lots.map((l) => l.id);
    for (let i = 2; i < this.params.populationSize; i++) {
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
        child1 = {
          genes: parent1.genes.map((g) => ({
            ...g,
            roundGaps: [...g.roundGaps] as [number, number, number],
          })),
          fitness: 0,
        };
        child2 = {
          genes: parent2.genes.map((g) => ({
            ...g,
            roundGaps: [...g.roundGaps] as [number, number, number],
          })),
          fitness: 0,
        };
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
