# SPEC - Plano Tático de Implementação
# Sistema de Otimização de Calendário com Algoritmo Genético

**Versão**: 1.0
**Data**: 2026-02-13
**Baseado em**: PRD.md v1.0

---

## 📋 Sumário Executivo

Este documento detalha **EXATAMENTE** quais arquivos criar, quais modificar e o que fazer em cada um deles para implementar a funcionalidade de otimização automática usando Algoritmo Genético Híbrido.

### Stack e Tecnologias
- React 19 + TypeScript + Preact Signals
- Algoritmo Genético customizado (implementação manual)
- Web Workers para não bloquear UI
- date-fns para manipulação de datas

---

## 🆕 ARQUIVOS A CRIAR

### 1. Core Domain: Value Objects

#### 1.1. `src/domain/value-objects/OptimizationScenario.ts`

**O que é**: Value object imutável que representa um cenário otimizado completo.

**Código completo**:

```typescript
import { Lot } from './Lot';
import { DateOnly } from './DateOnly';

/**
 * Representa os objetivos mensuráveis de um cronograma
 */
export interface ScheduleObjectives {
  sundaysRounds12: number;      // Domingos em rodadas 1-2
  sundaysRounds34: number;      // Domingos em rodadas 3-4
  overlapsRounds12: number;     // Sobreposições em rodadas 1-2
  overlapsRounds34: number;     // Sobreposições em rodadas 3-4
  totalCycleDays: number;       // Duração total do ciclo
  intervalViolations: number;   // Violações do intervalo 21-23 dias
}

/**
 * Representa uma mudança em um lote
 */
export interface LotChange {
  lotId: string;
  lotName: string;
  oldD0: string;      // ISO format
  newD0: string;      // ISO format
  daysDiff: number;   // Diferença em dias (positivo = adiantou, negativo = atrasou)
}

/**
 * OptimizationScenario - Cenário otimizado imutável
 */
export class OptimizationScenario {
  constructor(
    public readonly name: string,
    public readonly lots: Lot[],
    public readonly objectives: ScheduleObjectives,
    public readonly fitness: number
  ) {}

  /**
   * Cria cenário a partir de lotes e objetivos calculados
   */
  static create(
    name: string,
    lots: Lot[],
    objectives: ScheduleObjectives,
    fitness: number
  ): OptimizationScenario {
    return new OptimizationScenario(name, lots, objectives, fitness);
  }

  /**
   * Calcula a duração total do ciclo (do primeiro D0 ao último manejo)
   */
  getTotalCycleDays(): number {
    if (this.lots.length === 0) return 0;

    // Encontrar menor D0
    let minD0 = this.lots[0]!.d0;
    let maxDate = this.lots[0]!.d0;

    for (const lot of this.lots) {
      if (lot.d0.compareTo(minD0) < 0) {
        minD0 = lot.d0;
      }

      // Calcular última data de manejo deste lote
      const intervals = lot.getIntervals(4);
      const lastInterval = intervals[intervals.length - 1];
      if (lastInterval) {
        const lastDate = lot.d0.addDays(lastInterval.dayOffset);
        if (lastDate.compareTo(maxDate) > 0) {
          maxDate = lastDate;
        }
      }
    }

    return minD0.daysSince(maxDate);
  }

  /**
   * Obtém as mudanças em relação aos lotes originais
   */
  getChanges(originalLots: Lot[]): LotChange[] {
    const changes: LotChange[] = [];

    for (let i = 0; i < this.lots.length; i++) {
      const newLot = this.lots[i]!;
      const oldLot = originalLots.find((l) => l.id === newLot.id);

      if (oldLot && !oldLot.d0.equals(newLot.d0)) {
        const daysDiff = oldLot.d0.daysSince(newLot.d0);

        changes.push({
          lotId: newLot.id,
          lotName: newLot.name,
          oldD0: oldLot.d0.toISOString(),
          newD0: newLot.d0.toISOString(),
          daysDiff,
        });
      }
    }

    return changes;
  }

  /**
   * Retorna score formatado para exibição
   */
  getFormattedScore(): string {
    return (this.fitness * 100).toFixed(1);
  }
}
```

---

### 2. Core Optimization Engine

#### 2.1. `src/core/optimization/types.ts`

**O que é**: Definições de tipos centrais do algoritmo genético.

**Código completo**:

```typescript
/**
 * Gene - Representa o ajuste de D0 de um único lote
 */
export interface Gene {
  lotId: string;
  d0Offset: number;  // Offset em dias (-maxAdjustment a +maxAdjustment)
}

/**
 * Cromossomo - Solução candidata completa
 */
export interface Chromosome {
  genes: Gene[];
  fitness: number;
  objectives?: ScheduleObjectives;
}

/**
 * Parâmetros do algoritmo genético
 */
export interface GeneticParams {
  populationSize: number;
  eliteSize: number;
  mutationRate: number;
  crossoverRate: number;
  tournamentSize: number;
  timeLimitMs: number;
  maxD0Adjustment: number;
}

/**
 * Parâmetros padrão otimizados
 */
export const DEFAULT_GA_PARAMS: GeneticParams = {
  populationSize: 50,
  eliteSize: 5,
  mutationRate: 0.15,
  crossoverRate: 0.8,
  tournamentSize: 3,
  timeLimitMs: 5000,
  maxD0Adjustment: 15,
};
```

#### 2.2. `src/core/optimization/fitness-calculator.ts`

**O que é**: Calcula fitness multi-objetivo de um cromossomo.

**Código completo**:

```typescript
import { Lot } from '@/domain/value-objects/Lot';
import { calculateAllHandlingDates } from '@/core/date-engine/calculator';
import { detectConflicts } from '@/core/conflict/detector';
import { isSunday } from '@/core/date-engine/utils';
import { ScheduleObjectives } from '@/domain/value-objects/OptimizationScenario';

/**
 * Calcula objetivos de um cronograma
 */
export function calculateObjectives(lots: Lot[]): ScheduleObjectives {
  const allDates = calculateAllHandlingDates(lots, 4);
  const conflicts = detectConflicts(allDates);

  // Agrupar datas por rodada
  const datesByRound = new Map<number, typeof allDates>();
  for (const hd of allDates) {
    const roundDates = datesByRound.get(hd.round) || [];
    roundDates.push(hd);
    datesByRound.set(hd.round, roundDates);
  }

  // Contar domingos por rodada
  let sundaysRounds12 = 0;
  let sundaysRounds34 = 0;

  for (const hd of allDates) {
    if (isSunday(hd.date)) {
      if (hd.round <= 1) {
        sundaysRounds12++;
      } else {
        sundaysRounds34++;
      }
    }
  }

  // Contar sobreposições por rodada
  let overlapsRounds12 = 0;
  let overlapsRounds34 = 0;

  for (const conflict of conflicts) {
    if (conflict.type === 'overlap') {
      const round = conflict.handlingDates[0]?.round ?? 0;
      if (round <= 1) {
        overlapsRounds12++;
      } else {
        overlapsRounds34++;
      }
    }
  }

  // Calcular duração total do ciclo
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

  const totalCycleDays = minD0 && maxDate ? minD0.daysSince(maxDate) : 0;

  // Contar violações de intervalo (21-23 dias)
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
 * Escalariza objetivos em penalidade única (quanto menor, melhor)
 */
export function scalarizeObjectives(obj: ScheduleObjectives): number {
  // Hierarquia de prioridades via pesos
  const penalty =
    obj.intervalViolations * 5000 +     // Restrição dura
    obj.overlapsRounds12 * 10000 +      // Proibição dura
    obj.sundaysRounds12 * 1000 +        // Prioridade alta
    obj.overlapsRounds34 * 100 +        // Prioridade média
    obj.totalCycleDays * 1 -            // Minimizar ciclo
    obj.sundaysRounds34 * 50;           // Preferir domingos em R3-4

  return penalty;
}

/**
 * Calcula fitness normalizado (0 a 1, quanto maior melhor)
 */
export function calculateFitness(lots: Lot[]): number {
  const objectives = calculateObjectives(lots);
  const penalty = scalarizeObjectives(objectives);

  // Normalizar: fitness = 1 / (1 + penalty)
  const fitness = 1 / (1 + penalty);

  return fitness;
}

/**
 * Calcula fitness e objetivos de um cromossomo
 */
export function evaluateChromosome(
  chromosome: Chromosome,
  baseLots: Lot[]
): { fitness: number; objectives: ScheduleObjectives } {
  // Aplicar offsets do cromossomo aos lotes
  const adjustedLots = baseLots.map((lot) => {
    const gene = chromosome.genes.find((g) => g.lotId === lot.id);
    if (!gene || gene.d0Offset === 0) return lot;

    const newD0 = lot.d0.addDays(gene.d0Offset);
    return lot.withD0(newD0);
  });

  const objectives = calculateObjectives(adjustedLots);
  const fitness = 1 / (1 + scalarizeObjectives(objectives));

  return { fitness, objectives };
}
```

#### 2.3. `src/core/optimization/genetic-operators.ts`

**O que é**: Operadores genéticos (seleção, crossover, mutação).

**Código completo**:

```typescript
import { Chromosome, GeneticParams } from './types';

/**
 * Seleção por torneio
 */
export function tournamentSelection(
  population: Chromosome[],
  tournamentSize: number
): Chromosome {
  const tournament: Chromosome[] = [];

  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    tournament.push(population[idx]!);
  }

  // Retornar melhor do torneio
  return tournament.reduce((best, current) =>
    current.fitness > best.fitness ? current : best
  );
}

/**
 * Crossover de 2 pontos
 */
export function twoPointCrossover(
  parent1: Chromosome,
  parent2: Chromosome
): [Chromosome, Chromosome] {
  const len = parent1.genes.length;

  const point1 = Math.floor(Math.random() * len);
  const point2 = Math.floor(Math.random() * len);
  const [start, end] = [Math.min(point1, point2), Math.max(point1, point2)];

  const child1Genes = [
    ...parent1.genes.slice(0, start),
    ...parent2.genes.slice(start, end),
    ...parent1.genes.slice(end),
  ];

  const child2Genes = [
    ...parent2.genes.slice(0, start),
    ...parent1.genes.slice(start, end),
    ...parent2.genes.slice(end),
  ];

  return [
    { genes: child1Genes, fitness: 0 },
    { genes: child2Genes, fitness: 0 },
  ];
}

/**
 * Mutação gaussiana
 */
export function gaussianMutation(
  chromosome: Chromosome,
  mutationRate: number,
  maxAdjustment: number
): void {
  for (const gene of chromosome.genes) {
    if (Math.random() < mutationRate) {
      // Ajustar offset ±1 a ±3 dias
      const delta = Math.floor(Math.random() * 7) - 3;
      const newOffset = gene.d0Offset + delta;

      // Clamp dentro do limite
      gene.d0Offset = Math.max(
        -maxAdjustment,
        Math.min(maxAdjustment, newOffset)
      );
    }
  }
}

/**
 * Criar cromossomo aleatório
 */
export function createRandomChromosome(
  lotIds: string[],
  maxAdjustment: number
): Chromosome {
  const genes = lotIds.map((lotId) => ({
    lotId,
    d0Offset: Math.floor(Math.random() * (2 * maxAdjustment + 1)) - maxAdjustment,
  }));

  return { genes, fitness: 0 };
}
```

#### 2.4. `src/core/optimization/neh-heuristic.ts`

**O que é**: Heurística NEH para gerar solução inicial de qualidade.

**Código completo**:

```typescript
import { Lot } from '@/domain/value-objects/Lot';
import { Chromosome } from './types';
import { evaluateChromosome } from './fitness-calculator';

/**
 * Heurística NEH para inicialização
 *
 * Ordena lotes por duração total do protocolo e tenta
 * posicioná-los de forma a minimizar conflitos.
 */
export function nehInitialization(lots: Lot[]): Chromosome {
  // 1. Ordenar lotes por duração total do protocolo (decrescente)
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
  // (Simplified NEH - sem inserção complexa)
  for (let i = 0; i < genes.length; i++) {
    const gene = genes[i]!;

    // Testar pequenos offsets (-3 a +3 dias)
    let bestOffset = 0;
    let bestFitness = 0;

    for (let offset = -3; offset <= 3; offset++) {
      gene.d0Offset = offset;
      const testChromosome = { genes: [...genes], fitness: 0 };
      const { fitness } = evaluateChromosome(testChromosome, lots);

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
 * Calcula duração total do protocolo de um lote (4 rodadas)
 */
function getTotalProtocolDuration(lot: Lot): number {
  const intervals = lot.getIntervals(4);
  if (intervals.length === 0) return 0;

  const lastInterval = intervals[intervals.length - 1]!;
  return lastInterval.dayOffset;
}
```

#### 2.5. `src/core/optimization/diversity-selector.ts`

**O que é**: Seleciona top 3 soluções diversificadas.

**Código completo**:

```typescript
import { Lot } from '@/domain/value-objects/Lot';
import { Chromosome } from './types';

/**
 * Calcula distância entre dois cronogramas (soma de diferenças de D0)
 */
export function scheduleDistance(lots1: Lot[], lots2: Lot[]): number {
  let totalDiff = 0;

  for (let i = 0; i < lots1.length; i++) {
    const lot1 = lots1[i];
    const lot2 = lots2[i];

    if (lot1 && lot2) {
      const diff = Math.abs(lot1.d0.daysSince(lot2.d0));
      totalDiff += diff;
    }
  }

  return totalDiff;
}

/**
 * Aplica cromossomo aos lotes base
 */
export function applyChromosome(
  chromosome: Chromosome,
  baseLots: Lot[]
): Lot[] {
  return baseLots.map((lot) => {
    const gene = chromosome.genes.find((g) => g.lotId === lot.id);
    if (!gene || gene.d0Offset === 0) return lot;

    const newD0 = lot.d0.addDays(gene.d0Offset);
    return lot.withD0(newD0);
  });
}

/**
 * Seleciona top 3 soluções diversas
 */
export function selectDiverseTop3(
  population: Chromosome[],
  baseLots: Lot[],
  minDistance: number = 10
): Chromosome[] {
  // Ordenar por fitness (melhor primeiro)
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);

  if (sorted.length === 0) return [];
  if (sorted.length === 1) return [sorted[0]!];

  const selected: Chromosome[] = [sorted[0]!];
  const selectedLots: Lot[][] = [applyChromosome(sorted[0]!, baseLots)];

  // Buscar 2ª e 3ª soluções diversas
  for (const candidate of sorted.slice(1)) {
    const candidateLots = applyChromosome(candidate, baseLots);

    // Verificar distância mínima de todas as selecionadas
    let isDisverse = true;

    for (const selectedSchedule of selectedLots) {
      const dist = scheduleDistance(candidateLots, selectedSchedule);
      if (dist < minDistance) {
        isDisverse = false;
        break;
      }
    }

    if (isDisverse) {
      selected.push(candidate);
      selectedLots.push(candidateLots);

      if (selected.length === 3) break;
    }
  }

  // Se não encontramos 3 diversos, preencher com próximos melhores
  while (selected.length < 3 && selected.length < sorted.length) {
    const next = sorted[selected.length];
    if (next) selected.push(next);
  }

  return selected;
}
```

#### 2.6. `src/core/optimization/genetic-scheduler.ts`

**O que é**: Motor principal do algoritmo genético.

**Código completo**:

```typescript
import { Lot } from '@/domain/value-objects/Lot';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';
import {
  Chromosome,
  GeneticParams,
  DEFAULT_GA_PARAMS,
} from './types';
import {
  tournamentSelection,
  twoPointCrossover,
  gaussianMutation,
  createRandomChromosome,
} from './genetic-operators';
import { evaluateChromosome } from './fitness-calculator';
import { nehInitialization } from './neh-heuristic';
import { selectDiverseTop3, applyChromosome } from './diversity-selector';

/**
 * Scheduler baseado em Algoritmo Genético
 */
export class GeneticScheduler {
  private population: Chromosome[] = [];
  private generation = 0;
  private bestEver: Chromosome | null = null;

  constructor(
    private readonly lots: Lot[],
    private readonly params: GeneticParams = DEFAULT_GA_PARAMS
  ) {}

  /**
   * Otimiza cronograma (anytime algorithm)
   */
  async optimize(): Promise<OptimizationScenario[]> {
    const startTime = Date.now();

    // 1. Inicialização da população
    this.initializePopulation();

    // 2. Avaliar população inicial
    this.evaluatePopulation();

    // 3. Evolução até timeout
    while (Date.now() - startTime < this.params.timeLimitMs) {
      this.evolveGeneration();

      // Yield para UI a cada 100ms
      if (this.generation % 5 === 0) {
        await this.yieldToUI();
      }
    }

    // 4. Selecionar top 3 diversos
    const top3 = selectDiverseTop3(this.population, this.lots);

    // 5. Converter para cenários
    return this.chromosomesToScenarios(top3);
  }

  /**
   * Inicializa população com NEH + aleatórios
   */
  private initializePopulation(): void {
    this.population = [];

    // 1 solução NEH (boa heurística)
    const nehSolution = nehInitialization(this.lots);
    this.population.push(nehSolution);

    // Resto aleatório
    const lotIds = this.lots.map((l) => l.id);
    for (let i = 1; i < this.params.populationSize; i++) {
      const chromosome = createRandomChromosome(
        lotIds,
        this.params.maxD0Adjustment
      );
      this.population.push(chromosome);
    }
  }

  /**
   * Avalia fitness de toda a população
   */
  private evaluatePopulation(): void {
    for (const chromosome of this.population) {
      const { fitness, objectives } = evaluateChromosome(chromosome, this.lots);
      chromosome.fitness = fitness;
      chromosome.objectives = objectives;

      // Atualizar melhor de sempre
      if (!this.bestEver || fitness > this.bestEver.fitness) {
        this.bestEver = chromosome;
      }
    }
  }

  /**
   * Evolve uma geração
   */
  private evolveGeneration(): void {
    this.generation++;

    // Ordenar por fitness
    this.population.sort((a, b) => b.fitness - a.fitness);

    // Preservar elite
    const elite = this.population.slice(0, this.params.eliteSize);

    // Gerar nova população
    const newPopulation: Chromosome[] = [...elite];

    while (newPopulation.length < this.params.populationSize) {
      // Seleção
      const parent1 = tournamentSelection(
        this.population,
        this.params.tournamentSize
      );
      const parent2 = tournamentSelection(
        this.population,
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

      // Mutação
      gaussianMutation(child1, this.params.mutationRate, this.params.maxD0Adjustment);
      gaussianMutation(child2, this.params.mutationRate, this.params.maxD0Adjustment);

      newPopulation.push(child1);
      if (newPopulation.length < this.params.populationSize) {
        newPopulation.push(child2);
      }
    }

    this.population = newPopulation;

    // Avaliar nova população
    this.evaluatePopulation();
  }

  /**
   * Yield para não bloquear UI
   */
  private async yieldToUI(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Converte cromossomos em cenários
   */
  private chromosomesToScenarios(
    chromosomes: Chromosome[]
  ): OptimizationScenario[] {
    const scenarios: OptimizationScenario[] = [];
    const scenarioNames = ['Sem Conflitos', 'Ciclo Curto', 'Balanceado'];

    for (let i = 0; i < chromosomes.length; i++) {
      const chromosome = chromosomes[i]!;
      const adjustedLots = applyChromosome(chromosome, this.lots);

      const scenario = OptimizationScenario.create(
        scenarioNames[i] || `Cenário ${i + 1}`,
        adjustedLots,
        chromosome.objectives!,
        chromosome.fitness
      );

      scenarios.push(scenario);
    }

    return scenarios;
  }
}
```

#### 2.7. `src/core/optimization/index.ts`

**O que é**: Barrel export para facilitar imports.

**Código completo**:

```typescript
export * from './types';
export * from './genetic-scheduler';
export * from './fitness-calculator';
export * from './genetic-operators';
export * from './neh-heuristic';
export * from './diversity-selector';
```

---

### 3. Web Worker

#### 3.1. `src/workers/optimizer.worker.ts`

**O que é**: Worker para rodar otimização sem bloquear UI.

**Código completo**:

```typescript
import { Lot } from '@/domain/value-objects/Lot';
import { GeneticScheduler } from '@/core/optimization/genetic-scheduler';
import { GeneticParams, DEFAULT_GA_PARAMS } from '@/core/optimization/types';

/**
 * Mensagem recebida pelo worker
 */
interface WorkerMessage {
  lots: any[];  // Lotes serializados
  maxD0Adjustment?: number;
  timeLimitMs?: number;
}

/**
 * Web Worker para otimização
 */
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  try {
    const { lots: lotsData, maxD0Adjustment = 15, timeLimitMs = 5000 } = e.data;

    // Deserializar lotes
    const lots = lotsData.map((data) => Lot.fromJSON(data));

    // Criar scheduler
    const params: GeneticParams = {
      ...DEFAULT_GA_PARAMS,
      maxD0Adjustment,
      timeLimitMs,
    };

    const scheduler = new GeneticScheduler(lots, params);

    // Otimizar
    const scenarios = await scheduler.optimize();

    // Serializar e enviar resultado
    const serializedScenarios = scenarios.map((scenario) => ({
      name: scenario.name,
      lots: scenario.lots.map((lot) => lot.toJSON()),
      objectives: scenario.objectives,
      fitness: scenario.fitness,
    }));

    self.postMessage({
      success: true,
      scenarios: serializedScenarios,
    });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
};
```

---

### 4. State Management

#### 4.1. `src/state/signals/optimization.ts`

**O que é**: Signals para estado de otimização.

**Código completo**:

```typescript
import { signal } from '@preact/signals';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';

/**
 * Estado de otimização
 */
export const isOptimizingSignal = signal<boolean>(false);
export const optimizationScenariosSignal = signal<OptimizationScenario[]>([]);
export const maxD0AdjustmentSignal = signal<number>(15);

/**
 * Resetar cenários
 */
export function clearOptimizationScenarios(): void {
  optimizationScenariosSignal.value = [];
}

/**
 * Definir cenários otimizados
 */
export function setOptimizationScenarios(scenarios: OptimizationScenario[]): void {
  optimizationScenariosSignal.value = scenarios;
}

/**
 * Definir valor máximo de ajuste
 */
export function setMaxD0Adjustment(value: number): void {
  maxD0AdjustmentSignal.value = Math.max(1, Math.min(30, value));
}
```

---

### 5. Services

#### 5.1. `src/services/optimization/optimizer-service.ts`

**O que é**: Serviço para rodar otimização via Web Worker.

**Código completo**:

```typescript
import { Lot } from '@/domain/value-objects/Lot';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';

/**
 * Serviço de otimização usando Web Worker
 */
export class OptimizerService {
  private worker: Worker | null = null;

  /**
   * Otimiza lotes usando Web Worker
   */
  async optimizeSchedule(
    lots: Lot[],
    maxD0Adjustment: number = 15,
    timeLimitMs: number = 5000
  ): Promise<OptimizationScenario[]> {
    return new Promise((resolve, reject) => {
      // Criar worker
      this.worker = new Worker(
        new URL('@/workers/optimizer.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Timeout de segurança (worker + 1s)
      const timeout = setTimeout(() => {
        this.worker?.terminate();
        reject(new Error('Timeout de otimização'));
      }, timeLimitMs + 1000);

      // Receber resultado
      this.worker.onmessage = (e: MessageEvent) => {
        clearTimeout(timeout);

        if (e.data.success) {
          // Deserializar cenários
          const scenarios = e.data.scenarios.map((data: any) =>
            OptimizationScenario.create(
              data.name,
              data.lots.map((lotData: any) => Lot.fromJSON(lotData)),
              data.objectives,
              data.fitness
            )
          );

          resolve(scenarios);
        } else {
          reject(new Error(e.data.error || 'Erro na otimização'));
        }

        this.worker?.terminate();
        this.worker = null;
      };

      // Erro no worker
      this.worker.onerror = (error) => {
        clearTimeout(timeout);
        this.worker?.terminate();
        this.worker = null;
        reject(error);
      };

      // Enviar mensagem
      this.worker.postMessage({
        lots: lots.map((lot) => lot.toJSON()),
        maxD0Adjustment,
        timeLimitMs,
      });
    });
  }

  /**
   * Cancela otimização em andamento
   */
  cancel(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * Instância singleton
 */
export const optimizerService = new OptimizerService();
```

---

### 6. Components

#### 6.1. `src/components/Optimization/OptimizationModal.tsx`

**O que é**: Modal para exibir cenários otimizados.

**Código completo**:

```typescript
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';
import { Lot } from '@/domain/value-objects/Lot';

interface Props {
  scenarios: OptimizationScenario[];
  originalLots: Lot[];
  onApply: (scenario: OptimizationScenario) => void;
  onClose: () => void;
}

export function OptimizationModal({ scenarios, originalLots, onApply, onClose }: Props) {
  if (scenarios.length === 0) return null;

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div
        class="modal optimization-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>✨ Cenários Otimizados</h2>
        <p class="text-muted mb-lg">
          Foram gerados {scenarios.length} cenário(s) otimizado(s). Escolha um para aplicar.
        </p>

        <div class="scenarios-grid">
          {scenarios.map((scenario, idx) => {
            const changes = scenario.getChanges(originalLots);

            return (
              <div key={idx} class="scenario-card">
                <h3 class="scenario-title">
                  Cenário {idx + 1}: {scenario.name}
                </h3>

                {/* Métricas */}
                <div class="scenario-metrics">
                  <div class="metric">
                    <span class="metric-label">📅 Ciclo Total:</span>
                    <span class="metric-value">
                      {scenario.objectives.totalCycleDays} dias
                    </span>
                  </div>

                  <div class="metric">
                    <span class="metric-label">❌ Domingos (R1-R2):</span>
                    <span class="metric-value">
                      {scenario.objectives.sundaysRounds12}
                    </span>
                  </div>

                  <div class="metric">
                    <span class="metric-label">⚠️ Sobreposições (R1-R2):</span>
                    <span
                      class={`metric-value ${
                        scenario.objectives.overlapsRounds12 === 0
                          ? 'text-success'
                          : 'text-error'
                      }`}
                    >
                      {scenario.objectives.overlapsRounds12}
                    </span>
                  </div>

                  <div class="metric">
                    <span class="metric-label">⭐ Score:</span>
                    <span class="metric-value font-bold">
                      {scenario.getFormattedScore()}%
                    </span>
                  </div>
                </div>

                {/* Mudanças */}
                {changes.length > 0 && (
                  <div class="scenario-changes">
                    <h4>Mudanças:</h4>
                    <ul>
                      {changes.map((change) => (
                        <li key={change.lotId}>
                          <strong>{change.lotName}:</strong>{' '}
                          {change.oldD0} → {change.newD0}
                          <span
                            class={
                              change.daysDiff > 0 ? 'text-success' : 'text-warning'
                            }
                          >
                            {change.daysDiff > 0 ? ` (+${change.daysDiff})` : ` (${change.daysDiff})`} dias
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Botão aplicar */}
                <button
                  class="btn-primary w-full mt-md"
                  onClick={() => onApply(scenario)}
                >
                  Aplicar Cenário
                </button>
              </div>
            );
          })}
        </div>

        {/* Botão fechar */}
        <button class="btn-secondary w-full mt-lg" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
```

---

## 📝 ARQUIVOS A MODIFICAR

### 1. `src/components/Forms/LotForm.tsx`

**O que modificar**: Adicionar botão "Otimizar" e controle de maxD0Adjustment.

**Localização da modificação**:
- Linha ~98: Após o botão "Adicionar Lote"
- Linha ~104: Dentro da seção de "Tools"

**Modificações**:

```typescript
// NO TOPO DO ARQUIVO (novos imports):
import { optimizerService } from '@/services/optimization/optimizer-service';
import {
  isOptimizingSignal,
  optimizationScenariosSignal,
  maxD0AdjustmentSignal,
  setMaxD0Adjustment,
  setOptimizationScenarios,
  clearOptimizationScenarios,
} from '@/state/signals/optimization';
import { setLots } from '@/state/signals/lots';
import { OptimizationModal } from '@/components/Optimization/OptimizationModal';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';

// DENTRO DO COMPONENT (adicionar estes estados/handlers):

export function LotForm() {
  const lots = lotsSignal.value;
  const isOptimizing = isOptimizingSignal.value;
  const scenarios = optimizationScenariosSignal.value;
  const maxD0Adjustment = maxD0AdjustmentSignal.value;

  // ... estados existentes ...

  /**
   * Handler de otimização
   */
  const handleOptimize = async () => {
    if (lots.length < 2) {
      alert('Adicione pelo menos 2 lotes para otimizar.');
      return;
    }

    try {
      isOptimizingSignal.value = true;
      clearOptimizationScenarios();

      const optimizedScenarios = await optimizerService.optimizeSchedule(
        lots,
        maxD0Adjustment,
        5000
      );

      setOptimizationScenarios(optimizedScenarios);
    } catch (error) {
      console.error('Erro na otimização:', error);
      alert('Erro ao otimizar. Tente novamente.');
    } finally {
      isOptimizingSignal.value = false;
    }
  };

  /**
   * Handler de aplicação de cenário
   */
  const handleApplyScenario = (scenario: OptimizationScenario) => {
    setLots(scenario.lots);
    clearOptimizationScenarios();
  };

  /**
   * Handler de fechamento do modal
   */
  const handleCloseModal = () => {
    clearOptimizationScenarios();
  };

  // ... resto do component ...

  return (
    <div class="card">
      <h2>Gerenciar Lotes</h2>

      {/* Form existente ... */}
      <form onSubmit={handleSubmit} class="flex flex-col gap-md mb-lg">
        {/* ... campos existentes ... */}
      </form>

      {/* ADICIONAR ESTA SEÇÃO */}
      {lots.length > 0 && (
        <div class="flex flex-col gap-sm mb-lg">
          {/* Controle de ajuste máximo */}
          <div>
            <label htmlFor="maxAdjustment">
              Máximo de dias para ajustar D0 (±{maxD0Adjustment} dias)
            </label>
            <input
              id="maxAdjustment"
              type="range"
              min="1"
              max="30"
              value={maxD0Adjustment}
              onInput={(e) =>
                setMaxD0Adjustment(Number((e.target as HTMLInputElement).value))
              }
            />
          </div>

          {/* Botão otimizar */}
          <button
            type="button"
            class="btn-primary"
            onClick={handleOptimize}
            disabled={lots.length < 2 || isOptimizing}
          >
            {isOptimizing ? '⏳ Otimizando...' : '✨ Otimizar Calendário'}
          </button>

          {/* Exportar (já existe) */}
          <ExportDialog />
        </div>
      )}

      {/* ADICIONAR MODAL */}
      {scenarios.length > 0 && (
        <OptimizationModal
          scenarios={scenarios}
          originalLots={lots}
          onApply={handleApplyScenario}
          onClose={handleCloseModal}
        />
      )}

      {/* Modal de validação existente ... */}
    </div>
  );
}
```

---

### 2. `src/domain/value-objects/DateOnly.ts`

**O que modificar**: Adicionar método `addDays` e `compareTo` se não existirem.

**Verificar se já existem**, se não, adicionar:

```typescript
// No final da classe DateOnly, adicionar se não existirem:

/**
 * Adiciona dias e retorna novo DateOnly
 */
addDays(days: number): DateOnly {
  // Usar addDaysToDateOnly do utils
  const date = new Date(Date.UTC(this.year, this.month - 1, this.day));
  date.setUTCDate(date.getUTCDate() + days);

  return DateOnly.create(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

/**
 * Compara com outra data (-1: menor, 0: igual, 1: maior)
 */
compareTo(other: DateOnly): number {
  if (this.year !== other.year) return this.year - other.year;
  if (this.month !== other.month) return this.month - other.month;
  return this.day - other.day;
}
```

---

### 3. `src/app.tsx`

**O que modificar**: Nada (já está completo).

**Verificação**: Apenas confirmar que o app está renderizando LotForm corretamente.

---

### 4. `vite.config.ts`

**O que modificar**: Configurar Web Workers se necessário.

**Adicionar/Verificar**:

```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Configurar workers
  worker: {
    format: 'es',
  },
});
```

---

### 5. `tsconfig.json`

**O que modificar**: Garantir suporte a Web Workers.

**Adicionar se não existir**:

```json
{
  "compilerOptions": {
    // ... configurações existentes ...
    "lib": ["ES2020", "DOM", "DOM.Iterable", "WebWorker"]
  }
}
```

---

## 🎨 ESTILOS CSS (Opcional)

### `src/index.css` ou arquivo de estilos

**Adicionar estilos para modal de otimização**:

```css
/* Modal de Otimização */
.optimization-modal {
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
}

.scenarios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.scenario-card {
  border: 2px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
  background: var(--card-bg, #fff);
}

.scenario-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--primary-color, #3b82f6);
}

.scenario-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: var(--bg-secondary, #f9fafb);
  border-radius: 6px;
}

.metric {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.metric-label {
  color: var(--text-secondary, #6b7280);
}

.metric-value {
  font-weight: 500;
  color: var(--text-primary, #111827);
}

.scenario-changes {
  margin-bottom: 1rem;
  font-size: 0.85rem;
}

.scenario-changes h4 {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.scenario-changes ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.scenario-changes li {
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--border-light, #f3f4f6);
}

.text-success {
  color: #10b981;
}

.text-error {
  color: #ef4444;
}

.text-warning {
  color: #f59e0b;
}

.text-muted {
  color: var(--text-secondary, #6b7280);
}

.w-full {
  width: 100%;
}

.mt-md {
  margin-top: 0.75rem;
}

.mt-lg {
  margin-top: 1.5rem;
}

.mb-lg {
  margin-bottom: 1.5rem;
}

.font-bold {
  font-weight: 700;
}
```

---

## 📦 DEPENDÊNCIAS

**Nenhuma nova dependência NPM necessária!**

Tudo será implementado com:
- Bibliotecas existentes (React, Preact Signals, date-fns, TypeScript)
- Web Workers nativos do navegador
- Implementação manual do algoritmo genético

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Fundação
- [ ] Criar `src/domain/value-objects/OptimizationScenario.ts`
- [ ] Criar `src/core/optimization/types.ts`
- [ ] Criar `src/core/optimization/fitness-calculator.ts`
- [ ] Verificar e adicionar métodos `addDays` e `compareTo` em `DateOnly.ts`

### Fase 2: Algoritmo Genético
- [ ] Criar `src/core/optimization/genetic-operators.ts`
- [ ] Criar `src/core/optimization/neh-heuristic.ts`
- [ ] Criar `src/core/optimization/diversity-selector.ts`
- [ ] Criar `src/core/optimization/genetic-scheduler.ts`
- [ ] Criar `src/core/optimization/index.ts` (barrel export)

### Fase 3: Web Worker
- [ ] Criar `src/workers/optimizer.worker.ts`
- [ ] Configurar Vite para Web Workers em `vite.config.ts`
- [ ] Atualizar `tsconfig.json` com lib WebWorker

### Fase 4: State e Services
- [ ] Criar `src/state/signals/optimization.ts`
- [ ] Criar `src/services/optimization/optimizer-service.ts`

### Fase 5: Interface
- [ ] Criar `src/components/Optimization/OptimizationModal.tsx`
- [ ] Modificar `src/components/Forms/LotForm.tsx`
- [ ] Adicionar estilos CSS

### Fase 6: Testes
- [ ] Testar otimização com 2 lotes
- [ ] Testar otimização com 5 lotes
- [ ] Testar otimização com 10 lotes
- [ ] Verificar que não bloqueia UI
- [ ] Verificar timeout de 5s funciona
- [ ] Verificar cenários são diversos

---

## 🧪 TESTES SUGERIDOS

### Teste Manual 1: Otimização Básica
1. Adicionar 3 lotes com datas próximas que causem conflitos
2. Clicar em "Otimizar Calendário"
3. Verificar que aparecem 3 cenários
4. Aplicar cenário 1
5. Verificar que conflitos diminuíram/sumiram

### Teste Manual 2: Performance
1. Adicionar 10 lotes
2. Clicar em "Otimizar"
3. Verificar que UI não congela
4. Verificar que termina em até 5 segundos

### Teste Manual 3: Diversidade
1. Adicionar 5 lotes
2. Otimizar
3. Comparar os 3 cenários - devem ter diferenças visíveis nas datas D0

---

## 📊 MÉTRICAS DE SUCESSO

- ✅ Gera 3 cenários em ≤ 5 segundos
- ✅ UI permanece responsiva durante otimização
- ✅ Cenários respeitam restrição dura (0 sobreposições R1-R2)
- ✅ Cenários são diversos (>10 dias de diferença)
- ✅ Fitness visualmente mensurável (score em %)
- ✅ Mudanças claramente apresentadas ao usuário

---

## 🎯 PRÓXIMOS PASSOS APÓS IMPLEMENTAÇÃO

1. **Testes unitários** com Vitest
2. **Benchmarking** de performance
3. **Fine-tuning** de parâmetros GA
4. **Opção de salvar** cenários favoritos
5. **Histórico** de otimizações

---

**FIM DO SPEC.md v1.0**
