# FIX_CHANGES.md

## Objective

Stabilize optimization execution by fixing timeout handling, worker lifecycle races, and weak error contracts; add deterministic reliability tests and improve UI error messaging.

## Selected design

Use a **single-flight, request-scoped worker execution model** with:

- typed request/response contract between service and worker
- hard timeout with overhead margin
- explicit error codes
- deadline-aware scheduler loop (global deadline instead of rigid per-attempt slicing)
- deterministic tests for stochastic operators

This design keeps the current architecture while removing intermittent failure modes.

---

## File-by-file plan

### 1) `src/services/optimization/optimizer-service.ts`

#### Methods to change

- `optimizeSchedule(lots, maxD0Adjustment, timeLimitMs)`
- `cancel()`

#### Private methods/helpers to add

- `computeHardTimeoutMs(timeLimitMs: number): number`
- `rejectIfBusy()`
- `settleOnce(...)` helper (or equivalent local closure guard)
- `createOptimizationError(code, message, details?)`

#### Required refactor

- Replace shared mutable `private worker: Worker | null` as global execution state.
- Introduce request-scoped execution context per call:
  - `requestId`
  - `worker`
  - `timeoutId`
  - `settled` guard
  - `reject` reference (to settle cancel path)
- Keep single-flight policy:
  - reject new calls while one optimization is active with `OPTIMIZATION_IN_PROGRESS`.
- Apply timeout policy:
  - `hardTimeoutMs = Math.max(timeLimitMs * 1.25, timeLimitMs + 5000)`
  - timeout rejects with `OPTIMIZATION_TIMEOUT`
- Ensure every path settles exactly once:
  - success message
  - worker error event
  - timeout
  - manual cancel
- Update `cancel()` to terminate worker and reject pending promise with `OPTIMIZATION_CANCELED`.

#### Contract handling in this file

- Parse worker responses through typed contract fields (`success`, `requestId`, `code`, `message`, `details`, `elapsedMs`).
- Validate `requestId` to ignore stale/out-of-order worker replies.

---

### 2) `src/workers/optimizer.worker.ts`

#### Method to change

- `self.onmessage = async (...) => { ... }`

#### Behavior to implement

- Accept request payload with `requestId`.
- Return typed responses with stable shape:
  - success: `{ success: true, requestId, code: 'OK', elapsedMs, scenarios, totalCombinations }`
  - error: `{ success: false, requestId, code, message, details?, elapsedMs }`
- Measure and return `elapsedMs` for observability.
- Validate payload before deserialization (`lots`, limits) and return `OPTIMIZATION_VALIDATION_ERROR` when invalid.
- Map runtime failures to `OPTIMIZATION_RUNTIME_ERROR`.

#### Why

- Eliminates generic errors and enables deterministic handling in service and UI.

---

### 3) `src/core/optimization/genetic-scheduler.ts`

#### Methods to change

- `optimize()`
- `runGeneticAlgorithm(weights, timeLimitMs)` -> change signature to use deadline

#### Private methods to add

- `hasRemainingBudget(deadlineMs: number, minBufferMs?: number): boolean`
- `createBaselineChromosome(): Chromosome`
- `maybeYield(generation: number): Promise<void>`

#### Algorithm changes

- Replace fixed `timePerAttempt` split with global deadline:
  - `deadlineMs = Date.now() + this.params.timeLimitMs`
- Before each profile/attempt, compute remaining time and stop gracefully when low.
- Update GA loop to stop by deadline instead of per-attempt hard slice.
- Guarantee fallback scenario when stopping early:
  - include baseline chromosome if candidate pool is empty or incomplete.
- Keep `totalCombinations` accurate:
  - count only evaluated chromosomes.
  - do not imply all planned attempts ran when exiting early.
- Keep diverse top-4 selection logic, but handle small candidate pools safely.

#### Why

- Aligns internal runtime with real timeout budget and reduces late/time-sensitive failures.

---

### 4) `src/core/optimization/types.ts`

#### Type updates

- Extend `GeneticParams` with optional budget controls:
  - `minAttemptBudgetMs?: number`
  - `deadlineSafetyMs?: number`
- Add optional deterministic RNG field for testability:
  - `rng?: () => number`

#### Why

- Supports predictable budget behavior and deterministic tests without breaking callers.

---

### 5) `src/core/optimization/genetic-operators.ts`

#### Methods to change

- `tournamentSelection(...)`
- `twoPointCrossover(...)`
- `gaussianMutation(...)`
- `createRandomChromosome(...)`

#### Change

- Add optional RNG parameter (default `Math.random`) in each operator.
- Keep runtime behavior identical when RNG is omitted.

#### Why

- Removes nondeterministic test flakiness and allows reproducible operator tests.

---

### 6) `src/components/Forms/LotForm.tsx`

#### Methods to change

- `handleOptimize()`
- timer/status message effect (optional to align with hard timeout)

#### UX/error changes

- Replace generic alert for optimization failure with code-aware messages:
  - `OPTIMIZATION_TIMEOUT`
  - `OPTIMIZATION_IN_PROGRESS`
  - `OPTIMIZATION_CANCELED`
  - `OPTIMIZATION_RUNTIME_ERROR` / `OPTIMIZATION_VALIDATION_ERROR`
- Optional resilience policy:
  - keep last successful scenarios visible when a new run fails.
- Ensure `isOptimizingSignal` is always reset in all terminal paths.

#### Why

- Gives actionable feedback to users and avoids losing valid previous results due to transient failures.

---

### 7) `src/state/signals/optimization.ts`

#### Signals/functions to add

- `optimizationErrorSignal` with typed shape `{ code, message, details? } | null`
- `setOptimizationError(...)`
- `clearOptimizationError()`

#### Existing behavior to adjust

- Keep `clearOptimizationScenarios()` focused on scenario/stat reset.
- Clear error state explicitly at optimization start/success.

#### Why

- Centralized typed error state for current and future UI surfaces.

---

### 8) New file (recommended): `src/services/optimization/optimizer-contract.ts`

#### Add shared types

- `OptimizerWorkerRequest`
- `OptimizerWorkerSuccessResponse`
- `OptimizerWorkerErrorResponse`
- `OptimizerWorkerResponse` (union)
- `OptimizationErrorCode` union with:
  - `OK`
  - `OPTIMIZATION_TIMEOUT`
  - `OPTIMIZATION_IN_PROGRESS`
  - `OPTIMIZATION_CANCELED`
  - `OPTIMIZATION_VALIDATION_ERROR`
  - `OPTIMIZATION_RUNTIME_ERROR`
  - `OPTIMIZATION_WORKER_ERROR`
- `OptimizationServiceError` class/type

#### Why

- Prevents contract drift between worker, service, and UI.

---

## Tests to add/update

### 9) New: `tests/services/optimization/optimizer-service.test.ts`

Cover:

- concurrent trigger rejects with `OPTIMIZATION_IN_PROGRESS`
- timeout rejects with `OPTIMIZATION_TIMEOUT`
- worker `onerror` maps to `OPTIMIZATION_WORKER_ERROR`
- `cancel()` rejects pending run with `OPTIMIZATION_CANCELED`
- cleanup integrity and settle-once semantics

### 10) New: `tests/core/optimization/genetic-scheduler.test.ts`

Cover:

- returns before configured hard deadline
- exits gracefully when remaining budget is low
- returns baseline fallback scenario on early stop
- `totalCombinations` equals actual evaluations

### 11) Update: `tests/core/optimization/genetic-operators.test.ts`

Change:

- remove probabilistic assertions that can fail intermittently
- inject deterministic RNG (or mock RNG sequence)
- stabilize crossover/material-exchange assertions around current flaky section

---

## Implementation order

1. `src/services/optimization/optimizer-contract.ts` (new)
2. `src/services/optimization/optimizer-service.ts`
3. `src/workers/optimizer.worker.ts`
4. `src/core/optimization/genetic-scheduler.ts`
5. `src/core/optimization/types.ts` and `src/core/optimization/genetic-operators.ts`
6. `src/state/signals/optimization.ts`
7. `src/components/Forms/LotForm.tsx`
8. tests under `tests/services/optimization/` and `tests/core/optimization/`

---

## Acceptance criteria

- 20 sequential optimization runs on normal data without intermittent failures.
- No wrong-worker cleanup under rapid retriggers.
- Timeout/in-progress/canceled/runtime failures are explicit and reproducible by code.
- Scheduler respects deadline and still returns safe fallback when budget is low.
- Deterministic reliability tests for scheduler/operator/service paths.
- UI shows distinct messages per optimization error type.
