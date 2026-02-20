# OPTIMIER: Improving `otimizar calendario` Calculation

## What was analyzed

Current implementation in this repo:

- `src/core/optimization/genetic-scheduler.ts`
- `src/core/optimization/fitness-calculator.ts`
- `src/core/optimization/diversity-selector.ts`
- `src/core/optimization/neh-heuristic.ts`
- `src/workers/optimizer.worker.ts`

The optimizer is currently a genetic algorithm (GA) that:

1. Runs 4 scenario profiles.
2. Runs multiple attempts per profile.
3. Evaluates many chromosomes under a global time budget.
4. Selects 4 diverse final scenarios.

---

## Current bottlenecks (code-level)

### 1) Fitness evaluation is not O(1)-friendly

In `evaluateChromosome()` there are repeated `find()` operations inside loops:

- `chromosome.genes.find(...)` per lot
- `baseLots.find(...)` per gene

This creates repeated scans and tends to O(L^2) behavior for `L` lots in parts of each evaluation.

### 2) Many object allocations per chromosome

Each chromosome evaluation builds new `Lot`/`DateOnly` objects and arrays repeatedly. Under heavy GA loops this increases GC pressure and wall time.

### 3) Full recomputation on every neighbor/mutation

Small chromosome changes still trigger full objective recomputation (`calculateAllHandlingDates` + conflict detection + penalties).

### 4) NEH warm-start is expensive

`nehInitialization()` tries 7 offsets x 27 gap combinations = 189 evaluations per gene. This can be expensive before GA even starts, especially with many lots.

### 5) Diversity selection repeats expensive application

`selectDiverseTop4()` repeatedly calls `applyChromosome()` + distance checks, with repeated gene lookup scans.

---

## Complexity sketch

Let:

- `L` = number of lots
- `P` = population size
- `G` = generations executed in time budget
- `S` = scenario profiles (4)
- `A` = attempts per profile

Roughly:

- total evaluations: about `S * A * G * P` (bounded by time)
- cost per evaluation now: includes repeated scans + full date/conflict recomputation

So total runtime is dominated by `eval_cost * evaluations`.

This means the biggest win is reducing fitness evaluation cost, not tweaking crossover/mutation first.

---

## Internet research: most efficient options

### Option A: Keep GA, but move to incremental/delta fitness (highest ROI)

Why this is strong:

- OptaPlanner docs explicitly note that most solving time is spent in score calculation and that incremental (delta) score calculation is a huge scalability gain versus full recomputation.
- This directly matches your architecture because GA repeatedly evaluates similar solutions.

Expected effect in this project:

- Very high practical speedup (often multi-x) with no product behavior change.

### Option B: Hybrid GA + local search (memetic style)

Why this is strong:

- For combinatorial scheduling, adding short local search around elite individuals commonly improves quality per unit time.
- Good fit: your optimizer already has elite preservation and scenario diversity.

Expected effect:

- Better objective quality under same time limit; moderate implementation complexity.

### Option C: Parallel portfolio / island execution

Why this is strong:

- Running independent populations/islands in parallel is a standard acceleration strategy for metaheuristics.
- In browser/worker architecture, this can be done with multiple workers and migration.

Expected effect:

- Near-linear speedup up to a point (CPU/memory bandwidth limited).

### Option D: Re-model as CP-SAT (exact/near-exact) for small-medium instances

Why this is strong:

- OR-Tools CP-SAT is designed for integer combinatorial optimization and is generally faster than MIP wrappers for many integer models.
- Scheduling constraints map naturally to interval/no-overlap style models.

Expected effect:

- Strong optimality guarantees and robust feasibility handling for moderate instance sizes.
- Higher migration complexity from current TS GA implementation.

---

## Recommended priority order

1. **Delta fitness + data structure refactor** (fastest ROI, lowest risk)
2. **Memoization + duplicate elimination improvements**
3. **Parallel islands / multi-worker evaluation**
4. **Memetic local search around elites**
5. **CP-SAT hybrid/exact engine (optional strategic upgrade)**

---

## Detailed technical plan

## Phase 1 - Fast wins (no algorithm replacement)

### 1.1 Pre-index everything used in hot loops

Create immutable evaluation context once per optimization run:

- `lotIndexById: Map<string, number>`
- `baseLotById: Map<string, Lot>`
- stable lot arrays for O(1) access

Then replace `.find()` calls in evaluation/diversity code by index access.

### 1.2 Numeric schedule representation for evaluation only

Keep domain objects for API/UI, but use numeric arrays inside fitness:

- `d0EpochDay[i]`
- `gap[i][r]`
- protocol intervals as `Int16Array`

Compute objective metrics from numeric values to avoid object churn.

### 1.3 Cache objective vectors by chromosome signature

You already have signatures; extend with memoization:

- cache key: canonical chromosome signature
- cache value: `{ objectives, basePenaltyTerms }`

Use bounded LRU cache to avoid memory blowup.

### 1.4 Fix gene-order canonicalization

Guarantee genes are always in the same lot order after crossover/mutation. This avoids hidden inefficiencies and potential quality degradation from positional crossover across different gene orders.

---

## Phase 2 - Incremental fitness (largest speedup)

Core idea: mutation changes only a few genes; recompute only affected contributions.

Maintain per-chromosome state:

- per-lot handling day list
- per-day occupancy counts (for overlap)
- per-round Sunday counters
- current penalty components

On mutation of lot `i`:

1. Remove old lot contribution from counters.
2. Recompute lot `i` dates only.
3. Add new contribution.
4. Update objective/penalty delta.

Pseudo-flow:

```text
deltaEvaluate(chromosome, changedLotIds):
  for lotId in changedLotIds:
    removeContribution(lotId)
    recomputeLot(lotId)
    addContribution(lotId)
  return updatedFitness
```

This converts many full evaluations into small updates.

---

## Phase 3 - Parallelization

### 3.1 Island model

- Run N worker islands (independent GA populations).
- Every T generations migrate top-k chromosomes.
- Merge candidate pools at end and keep diversity selection.

### 3.2 Alternative: parallel fitness batch

- Split population fitness evaluation across sub-workers.
- Aggregate results in main optimizer worker.

Island model usually gives better exploration + speed than only parallel evaluation.

---

## Phase 4 - Search quality upgrades

### 4.1 Memetic step on elites

After each generation (or every K generations), run small local search on top M chromosomes:

- try +/-1 D0 offset moves
- try local gap swaps
- keep first or best improving move

Cap local search budget tightly to avoid time explosion.

### 4.2 Multi-objective front directly (NSGA-II style)

Instead of 4 weighted profiles, run one multi-objective population and select 4 scenarios from Pareto front + diversity metric.

Benefit: one run can produce naturally diverse trade-off solutions.

---

## Phase 5 - CP-SAT strategic path (optional)

Best when you need stronger optimality/feasibility guarantees.

High-level model:

- integer variables for D0 shifts and gap choices
- derived handling day variables
- overlap constraints via no-overlap or pairwise day constraints
- Sunday penalties via modulo constraints
- objective as weighted sum or lexicographic sequence

Practical deployment pattern:

- if instance size <= threshold: CP-SAT
- else: GA/memetic engine

This hybrid gives predictable behavior across sizes.

---

## Validation and benchmarking protocol

Use reproducible benchmark sets (small/medium/large) and fixed RNG seeds.

Track:

- `elapsedMs`
- chromosomes evaluated per second
- objective components (all)
- final fitness + diversity distance
- P50/P95 runtime across seeds

Run A/B against current `main` implementation.

Acceptance targets (example):

- >= 3x evaluated chromosomes per second
- equal or better objective quality in 30s budget
- no regression in scenario diversity

---

## Risks and mitigations

- **Incremental state corruption risk** -> add cross-check mode that periodically recomputes full score and asserts equality.
- **Cache memory growth** -> bounded LRU + hit-rate telemetry.
- **Parallel overhead** -> benchmark 1/2/4 workers and auto-select best on device.
- **Algorithm drift** -> lock test suite with golden seeds and target objective envelopes.

---

## Internet references used

1. OR-Tools CP-SAT Solver (Google):
   - https://developers.google.com/optimization/cp/cp_solver
   - Notes used: integer CP focus; generally faster than MPSolver on integer problems.

2. OR-Tools Scheduling (Job Shop):
   - https://developers.google.com/optimization/scheduling/job_shop
   - Notes used: scheduling variable/constraint patterns (`NoOverlap`, precedence, makespan).

3. OR-Tools solver limits:
   - https://developers.google.com/optimization/cp/cp_tasks
   - Notes used: time limits and controlled termination.

4. OptaPlanner User Guide (score calculation performance and incremental scoring):
   - https://docs.optaplanner.org/latestFinal/optaplanner-docs/html_single/
   - Notes used: solver time dominated by score calculation; incremental/delta scoring provides major scalability gains.

5. CP-SAT Primer (parameter and parallelization deep dive):
   - https://d-krupke.github.io/cpsat-primer/05_parameters.html
   - Notes used: worker tuning, portfolio parallelization behavior, practical tuning cautions.

6. NSGA-II canonical paper metadata:
   - https://doi.org/10.1109/4235.996017
   - Notes used: standard multi-objective GA baseline for Pareto-front generation.

7. jMetal algorithm documentation (NSGA-II variants and parallel evaluation component mention):
   - https://jmetal.readthedocs.io/en/latest/algorithms.html

---

## Short conclusion

The most efficient path for your current codebase is **not** a full rewrite first.

Start with:

1. **O(1) indexing + numeric evaluation representation**
2. **incremental/delta fitness**
3. **parallel islands**

This combination should deliver the largest runtime reduction quickly, while preserving your current domain model and UI contract.
