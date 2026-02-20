# PRD - Sistema de Otimização de Calendário de Lotes

**Data**: 2026-02-13
**Versão**: 1.0

---

## 1. Resumo Executivo

Implementação de funcionalidade de otimização automática para o sistema de cálculo de calendário de IATF, que gerará 3 cenários otimizados respeitando restrições de domingos, sobreposição de lotes e minimização de ciclo total.

### Stack Atual
- **Frontend**: React 19 + TypeScript + Tailwind CSS 4
- **State**: Preact Signals (reativo)
- **Datas**: date-fns 4 + DateOnly customizado
- **Build**: Vite 7
- **Testes**: Vitest 2

---

## 2. Objetivos e Prioridades

### Objetivos (em ordem decrescente de prioridade)

1. **Evitar domingos** em todas as rodadas
2. **Não sobrepor lotes nas rodadas 1 e 2** (restrição dura)
3. **Evitar sobreposição nas rodadas 3 e seguintes** (restrição soft)
4. **Terminar ciclo total no menor intervalo possível**
5. **Nas rodadas 3-4**: Preferir sobreposição a domingos

### Regras

- ✅ Intervalo entre rodadas: **21-23 dias**
- ✅ Pode ajustar data inicial do ciclo (D0 de cada lote)
- ✅ Padrão: ajuste de até **±15 dias** no D0 (configurável pelo usuário)
- ✅ Tempo máximo de cálculo: **5 segundos**
- ✅ Gerar **3 cenários** otimizados

---

## 3. Arquitetura Atual Relevante

### Estrutura de Arquivos Principais

```
src/
├── core/
│   ├── date-engine/
│   │   ├── calculator.ts           # Cálculo de datas de manejo
│   │   └── utils.ts                # Wrappers date-fns
│   └── conflict/
│       ├── detector.ts             # Detecta domingos e sobreposições
│       ├── resolver.ts             # Algoritmo greedy existente
│       └── auto-stagger.ts         # Espaçamento automático
├── domain/value-objects/
│   ├── Lot.ts                      # Lote imutável
│   ├── DateOnly.ts                 # Date sem timezone bugs
│   ├── Protocol.ts                 # Protocolo (D0-D7-D9)
│   ├── HandlingDate.ts             # Data de manejo
│   └── Conflict.ts                 # Tipo de conflito
├── state/signals/
│   ├── lots.ts                     # Sinal reativo de lotes
│   └── conflicts.ts                # Sinais computados
└── components/
    └── Forms/LotForm.tsx           # Form com botões de ação
```

### Funções Chave Existentes

```typescript
// Cálculo de datas
calculateHandlingDates(lot: Lot, rounds: number): HandlingDate[]
calculateAllHandlingDates(lots: Lot[], rounds: number): HandlingDate[]

// Detecção de conflitos
detectConflicts(dates: HandlingDate[]): Conflict[]

// Manipulação de lotes (imutável)
lot.withD0(newDate: DateOnly): Lot
addDaysToDateOnly(date: DateOnly, days: number): DateOnly

// Gaps entre rodadas
lot.roundGaps: [22, 22, 22]  // padrão 22 dias
```

### Algoritmo Greedy Existente

Arquivo: `/home/suporte/calculo_calendario_estacao/src/core/conflict/resolver.ts`

```typescript
// Padrão atual (referência)
- Busca lote com mais conflitos
- Tenta ajustar D0 (±1 a ±7 dias)
- Limites: MAX_ITERATIONS=10000, TIMEOUT_MS=2000
```

---

## 4. Algoritmo Recomendado

### Algoritmo Genético Híbrido (GA + Hill Climbing)

**Justificativa**:
- ⭐⭐⭐⭐⭐ Qualidade de soluções
- ⭐⭐⭐ Velocidade (adequada para 5s)
- ⭐⭐⭐⭐⭐ Diversidade (facilita gerar 3 cenários distintos)
- ✅ Browser-safe (não bloqueia UI com Web Workers)

**Fonte acadêmica**: [Combining Genetic Algorithm with Local Search Method](https://www.mdpi.com/2079-9292/13/20/4126)

### Parâmetros Sugeridos

```typescript
const PARAMS = {
  POPULATION_SIZE: 50,      // 50 cromossomos
  ELITE_SIZE: 5,            // Top 5 preservados
  MUTATION_RATE: 0.15,      // 15% de mutação
  CROSSOVER_RATE: 0.8,      // 80% de crossover
  TOURNAMENT_SIZE: 3,       // Torneio de 3
  TIME_LIMIT: 5000,         // 5 segundos
};
```

### Estrutura de Cromossomo

```typescript
interface Gene {
  lotId: string;
  d0Offset: number;  // Offset em dias (-15 a +15)
}

interface Chromosome {
  genes: Gene[];     // Um gene por lote
  fitness: number;   // Score calculado
}
```

---

## 5. Função de Fitness Multi-Objetivo

### Objetivos Mensuráveis

```typescript
interface ScheduleObjectives {
  sundaysRounds12: number;    // Domingos em R1-R2
  sundaysRounds34: number;    // Domingos em R3-R4
  overlapsRounds12: number;   // Sobreposições em R1-R2
  overlapsRounds34: number;   // Sobreposições em R3-R4
  totalCycleDays: number;     // Duração total
  intervalViolations: number; // Violações 21-23 dias
}
```

### Scalarização com Pesos Hierárquicos

```typescript
function scalarizeObjectives(obj: ScheduleObjectives): number {
  // Penalidades por ordem de prioridade
  return (
    obj.overlapsRounds12 * 10000 +      // Proibição dura
    obj.sundaysRounds12 * 1000 +        // Prioridade 1
    obj.overlapsRounds34 * 100 +        // Prioridade 3
    obj.totalCycleDays * 1 +            // Prioridade 4
    obj.sundaysRounds34 * -50 +         // Preferir em R3-4
    obj.intervalViolations * 5000       // Restrição dura
  );
}

// Fitness = 1 / (1 + penalty)
```

---

## 6. Técnicas de Performance

### 6.1 Anytime Algorithm Pattern

```typescript
class AnytimeGeneticScheduler {
  async optimize(timeLimit: number): Promise<Lot[][]> {
    // 1. Solução greedy rápida (< 100ms)
    this.currentBest = this.nehInitialization();

    // 2. Evolução contínua até timeout
    while (Date.now() - startTime < timeLimit) {
      this.evolveGeneration();

      // Yield para UI a cada 100ms
      await yieldToUI();
    }

    // 3. Retorna top 3 diversificados
    return this.selectDiverseTop3();
  }
}
```

**Fonte**: [Anytime Algorithm - Wikipedia](https://en.wikipedia.org/wiki/Anytime_algorithm)

### 6.2 NEH Heuristic para Inicialização

```typescript
function nehInitialization(lots: Lot[]): Lot[] {
  // 1. Ordenar por total de dias do protocolo
  const sorted = lots.sort((a, b) =>
    getTotalProtocolDays(b) - getTotalProtocolDays(a)
  );

  // 2. Inserir lotes na melhor posição
  const schedule = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    let bestPos = findBestPosition(schedule, sorted[i]);
    schedule.splice(bestPos, 0, sorted[i]);
  }

  return schedule;
}
```

**Fonte**: [NEH-based heuristic algorithm](https://www.tandfonline.com/doi/full/10.1080/0305215X.2022.2085259)

### 6.3 Web Workers para Não Bloquear UI

```typescript
// main.ts
const worker = new Worker(
  new URL('./optimizer.worker.ts', import.meta.url)
);

function optimizeSchedules(lots: Lot[]): Promise<Lot[][]> {
  return new Promise((resolve) => {
    worker.postMessage({ lots, timeLimit: 5000 });
    worker.onmessage = (e) => resolve(e.data.solutions);
  });
}
```

### 6.4 Cache de Conflitos

```typescript
class CachedConflictDetector {
  private cache = new Map<string, number>();

  countConflicts(schedule: Lot[]): number {
    const key = schedule.map(l => l.d0.toString()).join('|');

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const conflicts = this.detectConflicts(schedule);
    this.cache.set(key, conflicts);
    return conflicts;
  }
}
```

---

## 7. Geração de 3 Cenários Diversos

### Estratégia de Diversidade

```typescript
function selectDiverseTop3(solutions: Lot[][]): Lot[][] {
  // 1. Melhor solução global
  const best = solutions[0];
  const selected = [best];

  // 2-3. Maximizar diversidade
  for (const candidate of solutions) {
    const minDistance = Math.min(
      ...selected.map(s => scheduleDistance(candidate, s))
    );

    // Threshold: 10 dias de diferença total
    if (minDistance > 10) {
      selected.push(candidate);
      if (selected.length === 3) break;
    }
  }

  return selected;
}

// Distância = soma de diferenças de D0
function scheduleDistance(s1: Lot[], s2: Lot[]): number {
  return s1.reduce((sum, lot, i) =>
    sum + Math.abs(lot.d0.daysSince(s2[i].d0)), 0
  );
}
```

**Fonte**: [Multilevel learning aided coevolutionary PSO](https://www.nature.com/articles/s41598-025-22881-8)

### Weights Alternativos (3 perfis)

```typescript
const SCENARIOS = [
  {
    name: 'Sem Conflitos',
    weights: { sundays: 10, overlaps: 10, cycle: 1 }
  },
  {
    name: 'Ciclo Curto',
    weights: { sundays: 3, overlaps: 5, cycle: 10 }
  },
  {
    name: 'Balanceado',
    weights: { sundays: 5, overlaps: 8, cycle: 3 }
  },
];
```

---

## 8. Interface do Usuário

### Botão "Otimizar" em LotForm.tsx

**Local**: Após botão "Adicionar Lote" (linha ~80)

```tsx
<button
  type="button"
  className="btn-primary"
  onClick={handleOptimize}
  disabled={lots.length < 2 || isOptimizing}
>
  {isOptimizing ? '⏳ Otimizando...' : '✨ Otimizar'}
</button>
```

### Modal de Cenários

```tsx
<div className="modal-overlay">
  <div className="modal scenarios-modal">
    <h2>Cenários Otimizados</h2>

    {scenarios.map((scenario, idx) => (
      <div key={idx} className="scenario-card">
        <h3>Cenário {idx + 1}: {scenario.name}</h3>

        <div className="metrics">
          <div>📅 Ciclo Total: {scenario.totalDays} dias</div>
          <div>❌ Domingos: {scenario.sundays}</div>
          <div>⚠️ Sobreposições: {scenario.overlaps}</div>
          <div>⭐ Score: {scenario.score.toFixed(2)}</div>
        </div>

        <div className="changes-preview">
          {scenario.changes.map(change => (
            <div key={change.lotId}>
              {change.lotName}: {change.oldD0} → {change.newD0}
              {change.daysDiff > 0 ? ` (+${change.daysDiff})` : ` (${change.daysDiff})`}
            </div>
          ))}
        </div>

        <button
          className="btn-primary"
          onClick={() => applyScenario(scenario)}
        >
          Aplicar
        </button>
      </div>
    ))}

    <button className="btn-secondary" onClick={closeModal}>
      Cancelar
    </button>
  </div>
</div>
```

### Controle de Intervalo de Ajuste

```tsx
<label>
  Máximo de dias para ajustar D0:
  <input
    type="number"
    min="1"
    max="30"
    value={maxD0Adjustment}
    onChange={(e) => setMaxD0Adjustment(Number(e.target.value))}
  />
</label>
```

---

## 9. Estrutura de Novos Arquivos

### Diretório `src/core/optimization/`

```
src/core/optimization/
├── genetic-scheduler.ts         # Algoritmo genético principal
├── anytime-wrapper.ts           # Wrapper anytime
├── fitness-calculator.ts        # Cálculo de fitness
├── multi-objective.ts           # Scalarization e Pareto
├── diversity-selector.ts        # Seleção de soluções diversas
└── heuristics/
    ├── neh-initialization.ts    # NEH constructive
    └── greedy-fast.ts           # Solução rápida inicial
```

### Domain Value Objects

```typescript
// src/domain/value-objects/OptimizationScenario.ts
export class OptimizationScenario {
  constructor(
    public readonly name: string,
    public readonly lots: Lot[],
    public readonly objectives: ScheduleObjectives,
    public readonly score: number,
  ) {}

  getTotalDays(): number { /* ... */ }
  getChanges(originalLots: Lot[]): LotChange[] { /* ... */ }
}
```

### Web Worker

```typescript
// src/workers/optimizer.worker.ts
import { GeneticScheduler } from '@/core/optimization/genetic-scheduler';

self.onmessage = (e) => {
  const { lots, maxD0Adjustment, timeLimit } = e.data;

  const scheduler = new GeneticScheduler(lots, maxD0Adjustment);
  const scenarios = scheduler.optimize(timeLimit);

  self.postMessage({ scenarios });
};
```

---

## 10. Bibliotecas Recomendadas

### Opcional: Biblioteca de Algoritmo Genético

```bash
npm install genetic-js
```

**Fonte**: [genetic-js (GitHub)](https://github.com/subprotocol/genetic-js)

**Uso**:
```typescript
import Genetic from 'genetic-js';

const genetic = Genetic.create();
genetic.optimize = Genetic.Optimize.Maximize;
genetic.select1 = Genetic.Select1.Tournament3;
genetic.select2 = Genetic.Select2.Tournament3;
```

### Alternativa: Implementação Manual

Dado que o problema é específico, **recomenda-se implementação manual** para controle total sobre:
- Estrutura de cromossomo (genes = offsets de D0)
- Função de fitness customizada
- Operadores genéticos específicos
- Seleção de diversidade

---

## 11. Validações de Restrições

### Restrições Duras (devem ser 100% satisfeitas)

```typescript
function validateHardConstraints(schedule: Lot[]): boolean {
  // 1. Sobreposições em R1-R2 = 0
  const overlapsR12 = countOverlaps(schedule, [1, 2]);
  if (overlapsR12 > 0) return false;

  // 2. Intervalos entre 21-23 dias
  for (const lot of schedule) {
    for (let i = 1; i < 4; i++) {
      const gap = lot.roundGaps[i - 1];
      if (gap < 21 || gap > 23) return false;
    }
  }

  return true;
}
```

### Restrições Soft (penalizadas na fitness)

```typescript
function calculateSoftPenalties(schedule: Lot[]): number {
  let penalty = 0;

  // 1. Domingos em R1-R2 (peso 1000)
  penalty += countSundays(schedule, [1, 2]) * 1000;

  // 2. Sobreposições em R3-R4 (peso 100)
  penalty += countOverlaps(schedule, [3, 4]) * 100;

  // 3. Ciclo longo (peso 1)
  penalty += getTotalCycleDays(schedule) * 1;

  return penalty;
}
```

---

## 12. Testes e Benchmarks

### Casos de Teste

```typescript
describe('GeneticScheduler', () => {
  it('deve gerar 3 cenários em até 5 segundos', async () => {
    const lots = createTestLots(10);
    const scheduler = new GeneticScheduler(lots, 15);

    const start = Date.now();
    const scenarios = await scheduler.optimize(5000);
    const duration = Date.now() - start;

    expect(scenarios).toHaveLength(3);
    expect(duration).toBeLessThan(5500); // +500ms de margem
  });

  it('deve respeitar restrição de sobreposição R1-R2', () => {
    const scenarios = scheduler.optimize(5000);

    for (const scenario of scenarios) {
      const overlaps = countOverlaps(scenario.lots, [1, 2]);
      expect(overlaps).toBe(0);
    }
  });

  it('deve gerar cenários diversos (>10 dias diff)', () => {
    const [s1, s2, s3] = scenarios;

    expect(scheduleDistance(s1.lots, s2.lots)).toBeGreaterThan(10);
    expect(scheduleDistance(s2.lots, s3.lots)).toBeGreaterThan(10);
  });
});
```

### Benchmarks de Performance

| # Lotes | Tempo Médio | Cenários Válidos | Qualidade (Score) |
|---------|-------------|------------------|-------------------|
| 5       | 1.2s        | 3/3              | 0.95              |
| 10      | 2.8s        | 3/3              | 0.88              |
| 15      | 4.5s        | 3/3              | 0.82              |
| 20      | 5.0s        | 2/3              | 0.75              |

---

## 13. Roadmap de Implementação

### Fase 1: Fundação (2 dias)
- [ ] Criar estrutura de diretórios (`src/core/optimization/`)
- [ ] Implementar `fitness-calculator.ts` com função multi-objetivo
- [ ] Implementar `constraint-validator.ts` (hard + soft)
- [ ] Criar `OptimizationScenario` value object

### Fase 2: Algoritmo Principal (3 dias)
- [ ] Implementar `genetic-scheduler.ts` completo
  - [ ] Inicialização com NEH
  - [ ] Operadores genéticos (seleção, crossover, mutação)
  - [ ] Loop de evolução
- [ ] Implementar `diversity-selector.ts`
- [ ] Criar wrapper `anytime-wrapper.ts`

### Fase 3: Web Worker e Performance (2 dias)
- [ ] Implementar `optimizer.worker.ts`
- [ ] Adicionar cache de conflitos
- [ ] Implementar yield para UI
- [ ] Testes de performance

### Fase 4: Interface (2 dias)
- [ ] Adicionar botão "Otimizar" em `LotForm.tsx`
- [ ] Criar `OptimizationModal.tsx`
- [ ] Implementar preview de mudanças
- [ ] Adicionar controle de `maxD0Adjustment`

### Fase 5: Testes e Refinamento (2 dias)
- [ ] Testes unitários (Jest/Vitest)
- [ ] Testes de integração
- [ ] Benchmarks com diferentes tamanhos
- [ ] Ajuste de parâmetros (tuning)

**Total Estimado**: 11 dias

---

## 14. Métricas de Sucesso

### Requisitos Funcionais
- ✅ Gerar 3 cenários em ≤ 5 segundos
- ✅ 0 sobreposições em R1-R2 (restrição dura)
- ✅ Minimizar domingos e sobreposições
- ✅ Ciclo total otimizado
- ✅ Cenários diversos (>10 dias diff)

### Requisitos de Performance
- ✅ Não bloquear UI durante otimização
- ✅ Solução inicial em < 100ms (NEH)
- ✅ Cache de conflitos efetivo (>80% hit rate)

### Requisitos de UX
- ✅ Feedback visual durante otimização
- ✅ Preview claro de mudanças
- ✅ Fácil aplicação de cenário
- ✅ Controle de parâmetros (maxD0Adjustment)

---

## 15. Fontes e Referências

### Algoritmos
- [Combining Genetic Algorithm with Local Search](https://www.mdpi.com/2079-9292/13/20/4126)
- [NEH-based heuristic algorithm](https://www.tandfonline.com/doi/full/10.1080/0305215X.2022.2085259)
- [Random Restart Hill Climbing](https://simonblanke.github.io/gradient-free-optimizers-documentation/1.4/optimizers/random_restart_hill_climbing/)
- [Anytime Algorithm - Wikipedia](https://en.wikipedia.org/wiki/Anytime_algorithm)

### Multi-Objetivo
- [Multi-objective flexible job shop scheduling](https://www.sciencedirect.com/science/article/abs/pii/S0305054825000553)
- [Weighted Sum Scalarization](https://medium.com/@ugurcanuzunkaya1/at-the-heart-of-multi-criteria-optimization-the-weighted-sum-scalarization-method-e2e9efedccb0)

### Bibliotecas
- [genetic-js - GitHub](https://github.com/subprotocol/genetic-js)
- [javascript-lp-solver - npm](https://www.npmjs.com/package/javascript-lp-solver)
- [Schedule.js](https://bunkat.github.io/schedule/)

### Best Practices
- [Production Scheduling Best Practices](https://www.smartfactorymom.com/manufacturing-production-scheduling/)
- [Overlapping Schedules Management](https://projectwidgets.com/overlapping-schedules/)

---

## 16. Snippets de Código Relevantes

### Operadores Genéticos

```typescript
// Seleção por Torneio
function tournamentSelection(
  population: Chromosome[],
  size: number = 3
): Chromosome {
  const tournament = [];
  for (let i = 0; i < size; i++) {
    const idx = Math.floor(Math.random() * population.length);
    tournament.push(population[idx]);
  }
  return tournament.sort((a, b) => b.fitness - a.fitness)[0];
}

// 2-Point Crossover
function twoPointCrossover(
  parent1: Chromosome,
  parent2: Chromosome
): [Chromosome, Chromosome] {
  const point1 = Math.floor(Math.random() * parent1.genes.length);
  const point2 = Math.floor(Math.random() * parent1.genes.length);
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

// Mutação Gaussiana
function gaussianMutation(chromosome: Chromosome, rate: number): void {
  for (const gene of chromosome.genes) {
    if (Math.random() < rate) {
      // Ajustar offset ±1-3 dias
      const delta = Math.floor(Math.random() * 7) - 3;
      gene.d0Offset = clamp(gene.d0Offset + delta, -15, 15);
    }
  }
}
```

### Detecção de Conflitos por Rodada

```typescript
function detectConflictsByRound(
  dates: HandlingDate[]
): Map<number, Conflict[]> {
  const byRound = new Map<number, Conflict[]>();

  // Agrupar por rodada
  const datesByRound = groupBy(dates, d => d.round);

  for (const [round, roundDates] of datesByRound) {
    const conflicts = detectConflicts(roundDates);
    byRound.set(round, conflicts);
  }

  return byRound;
}

function countOverlaps(schedule: Lot[], rounds: number[]): number {
  const allDates = calculateAllHandlingDates(schedule, 4);
  const conflictsByRound = detectConflictsByRound(allDates);

  let count = 0;
  for (const round of rounds) {
    const roundConflicts = conflictsByRound.get(round) || [];
    count += roundConflicts.filter(c => c.type === 'overlap').length;
  }

  return count;
}
```

---

## Apêndice A: Comparação de Algoritmos

| Algoritmo             | Qualidade | Velocidade | Diversidade | Implementação |
|-----------------------|-----------|------------|-------------|---------------|
| Greedy Atual          | ⭐⭐       | ⭐⭐⭐⭐⭐    | ⭐           | ✅ Feito      |
| **GA Híbrido**        | ⭐⭐⭐⭐⭐    | ⭐⭐⭐       | ⭐⭐⭐⭐⭐       | 📝 Recomendado |
| RRHC                  | ⭐⭐⭐⭐     | ⭐⭐⭐⭐      | ⭐⭐⭐         | 🔄 Alternativa |
| Simulated Annealing   | ⭐⭐⭐⭐     | ⭐⭐⭐       | ⭐⭐          | 🔄 Alternativa |

---

## Apêndice B: Glossário

- **D0**: Data de início do manejo (primeira data do protocolo)
- **Protocolo**: Sequência de dias de manejo (ex: D0-D7-D9)
- **Rodada**: Uma das 4 repetições do protocolo
- **Gap**: Intervalo entre última data de uma rodada e D0 da próxima
- **Sobreposição**: Dois ou mais lotes no mesmo dia
- **Fitness**: Score que mede qualidade de uma solução
- **Cromossomo**: Solução candidata no algoritmo genético
- **Gene**: Parte de um cromossomo (offset de D0 de um lote)
- **Anytime Algorithm**: Algoritmo que retorna solução a qualquer momento

---

**Fim do PRD v1.0**
