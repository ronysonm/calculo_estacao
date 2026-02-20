# FIX Plan - otimizar calendario

## Current diagnosis

The intermittent errors when triggering optimization are likely caused by timeout design and worker lifecycle handling.

### Evidence in code

- Shared mutable worker instance in service: `src/services/optimization/optimizer-service.ts:8`.
- Tight timeout budget: `timeLimitMs + 1000`: `src/services/optimization/optimizer-service.ts:26`.
- Scheduler splits time equally and still does extra work outside inner loops: `src/core/optimization/genetic-scheduler.ts:38`.
- UI exposes generic error alert only: `src/components/Forms/LotForm.tsx:124`.
- `cancel()` terminates worker but does not settle pending promise with a typed cancel error: `src/services/optimization/optimizer-service.ts:85`.

### Validation summary

- `npm run type-check`: passed
- `npm run build`: passed
- `npm test -- --run`: 1 nondeterministic test failure in `tests/core/optimization/genetic-operators.test.ts:207`

## Root cause hypotheses (priority)

1. Timeout budget mismatch (P0)
   - Runtime + serialization + overhead occasionally exceeds strict timeout.

2. Shared worker race risk (P0)
   - `this.worker` may be overwritten on rapid retrigger, causing incorrect cleanup.

3. Weak error contract and observability (P1)
   - Generic errors make diagnosis difficult.

4. Nondeterministic reliability tests (P1)
   - Random behavior without seed control makes failures harder to reproduce.

## Change plan

### Phase 1 - Stabilize runtime (P0)

- Refactor `OptimizerService` to request-scoped worker context (no shared mutable worker pointer).
- Add a settled guard to avoid double resolve/reject.
- Add single-flight policy:
  - Recommended: reject new calls while one optimization is in progress with `OPTIMIZATION_IN_PROGRESS`.
- Relax timeout window for overhead:
  - `hardTimeoutMs = max(timeLimitMs * 1.25, timeLimitMs + 5000)`.
  - Emit typed code `OPTIMIZATION_TIMEOUT` on timeout.

### Phase 2 - Make scheduler deadline-aware (P0)

- Replace fixed per-attempt slices with global deadline control.
- Before each attempt, compute remaining time and stop gracefully when budget is low.
- Guarantee at least one fallback scenario (baseline) when stopping early.
- Keep `totalCombinations` but do not overstate precision when exiting early.

### Phase 3 - Improve error protocol and UI (P1)

- Define typed worker response contract:
  - `{ success, requestId, code, message, details, elapsedMs }`.
- Distinguish user-facing errors:
  - timeout
  - optimization already in progress
  - runtime/validation error
- Optional UX safeguard: keep last successful scenarios if current run fails.

### Phase 4 - Reliability tests (P1)

- Add service tests with mocked Worker:
  - timeout path
  - onerror path
  - concurrent trigger behavior
  - cleanup integrity
- Add scheduler deadline tests:
  - returns before hard deadline
  - returns fallback scenario on early stop
- Make stochastic operator tests deterministic using mocked RNG or seeded randomness.

### Phase 5 - Observability (P2)

- Add lightweight per-request diagnostics:
  - requestId
  - lot count
  - elapsedMs
  - result code
- Keep diagnostics behind debug flag.

## Best practices

- Use single-flight for expensive UI-triggered background jobs.
- Keep workers, timers, and handlers request-local.
- Use timeout budgets with overhead margin, not exact algorithm time.
- Prefer typed error codes over generic exceptions.
- Use deterministic tests for stochastic algorithms.
- Validate payloads before crossing worker boundary.
- Prefer graceful fallback over hard failure when safe.

## Acceptance criteria

- No intermittent failures in 20 sequential optimization runs on normal data.
- No wrong-worker cleanup under rapid retriggers.
- Timeout failures are explicit, rare, and reproducible under stress.
- Tests cover timeout, concurrency, and deadline behavior.
- UI shows distinct messages for timeout, in-progress, and runtime errors.

## Suggested implementation order

1. `src/services/optimization/optimizer-service.ts`
2. `src/core/optimization/genetic-scheduler.ts`
3. `src/workers/optimizer.worker.ts`
4. `src/components/Forms/LotForm.tsx`
5. Tests under `tests/core/optimization/` and `tests/services/optimization/`
