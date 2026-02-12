---
phase: 01-foundation
plan: 02
subsystem: domain-model
tags: [foundation, domain-model, immutability, typescript]
dependency_graph:
  requires:
    - React 19 + TypeScript runtime (01-01)
    - Path alias @ resolves to src/ (01-01)
  provides:
    - Protocol type with readonly tuple enforcement
    - 3 pre-defined protocols with stable IDs
    - Lot and RoundConfig domain models
    - Immutable factory functions for all domain objects
    - Domain constants (pre-defined protocols, lot names)
  affects:
    - all-calculation-logic
    - all-ui-components
    - state-management
tech_stack:
  added: []
  patterns:
    - Immutable domain objects with Object.freeze()
    - Factory functions for object creation
    - Readonly tuple types for fixed-length arrays
    - Barrel exports for clean imports
    - Guard functions for business rules (canDeleteProtocol, updateProtocol)
key_files:
  created:
    - src/domain/models/Protocol.ts: Protocol type and factory functions
    - src/domain/models/Round.ts: RoundConfig type and label generation
    - src/domain/models/Lot.ts: Lot type linking protocol, D0, and interval
    - src/domain/models/index.ts: Barrel export for all domain models
    - src/domain/constants/protocols.ts: Pre-defined protocols and helpers
    - src/domain/constants/index.ts: Barrel export for constants
    - src/domain/models/Protocol.test.ts: Protocol test suite (10 tests)
    - src/domain/models/Round.test.ts: Round test suite (5 tests)
    - src/domain/models/Lot.test.ts: Lot test suite (9 tests)
    - src/domain/constants/protocols.test.ts: Constants test suite (15 tests)
  modified: []
decisions:
  - decision: Use readonly tuple [number, number, number] for Protocol.days
    rationale: Enforces exactly 3 manejos at type level, prevents accidental array mutation
  - decision: Stable IDs for pre-defined protocols (not random UUIDs)
    rationale: Ensures pre-defined protocol IDs are consistent across sessions and localStorage saves
  - decision: Per-lot round interval configuration
    rationale: Allows flexibility while maintaining global round count (user decision from research)
  - decision: Guard functions enforce business rules (updateProtocol throws for pre-defined)
    rationale: Prevents pre-defined protocol mutation at runtime, not just UI level
  - decision: No validation restrictions on protocol days or round intervals
    rationale: User decision "sem restricao de validacao" - accept any numeric values
metrics:
  duration: 182
  tasks_completed: 2
  files_created: 10
  files_modified: 1
  commits: 2
  tests_added: 39
  completed_date: 2026-02-12
---

# Phase 01 Plan 02: Immutable Domain Model Summary

**One-liner:** Pure TypeScript domain models (Protocol, Round, Lot) with immutable factory functions, frozen pre-defined protocols, and zero React dependencies.

## What Was Built

This plan created the complete immutable domain model layer that all calculation and UI code will depend on. The models are pure TypeScript with no framework dependencies, ensuring they can be used anywhere in the app (calculations, UI, state management, tests).

**Key characteristics:**
1. **Immutability enforced**: All objects frozen via `Object.freeze()`, factory functions return new instances
2. **Type safety**: readonly properties, readonly tuples for fixed-length arrays
3. **Business rules encoded**: Pre-defined protocols cannot be edited/deleted (enforced at runtime)
4. **Stable IDs**: Pre-defined protocols use consistent IDs (not random UUIDs) for localStorage compatibility
5. **Zero validation restrictions**: Accepts any numeric values per user decision

## Tasks Completed

### Task 1: Create domain model types and factory functions
- **Commit:** 722e0e9
- **Status:** ✓ Complete
- Created Protocol type with readonly tuple `[number, number, number]` enforcing exactly 3 manejos
- Created `createProtocol` factory with auto-generated name (D0-D7-D9 format) and frozen days array
- Created `updateProtocol` with immutable update pattern and pre-defined protocol guard
- Created `canDeleteProtocol` guard function
- Created RoundConfig type with count (1-6) and defaultInterval (22) fields
- Created `generateRoundLabels` helper for A1, A2, etc. labels
- Created Lot type linking protocol, D0 date, and per-lot round interval
- Created `createLot` and `updateLot` factories with immutable updates
- Created barrel export from `domain/models/index.ts`
- **Tests:** 24 tests covering all domain model behavior
- **Verification:** Type-check passed, all tests passed (26/26)

### Task 2: Create pre-defined protocol constants and helpers
- **Commit:** 5893ecf
- **Status:** ✓ Complete
- Created 3 pre-defined protocols with stable IDs:
  - `predefined-d0-d7-d9`: D0-D7-D9 [0, 7, 9]
  - `predefined-d0-d8-d10`: D0-D8-D10 [0, 8, 10]
  - `predefined-d0-d9-d11`: D0-D9-D11 [0, 9, 11]
- All pre-defined protocols frozen and marked `isPredefined=true`
- Created `DEFAULT_LOT_NAMES` constant with 5 standard lot names
- Created `getAllProtocols` helper merging pre-defined + custom (pre-defined first)
- Created `getProtocolById` helper searching pre-defined then custom
- Created barrel export from `domain/constants/index.ts`
- **Tests:** 15 tests covering all constants and helpers
- **Verification:** Type-check passed, all tests passed (41/41)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed updateLot to preserve original Lot ID**
- **Found during:** Task 1 verification (test failure)
- **Issue:** `updateLot` called `createLot` which generated a new random UUID instead of preserving the original lot's ID. This broke the immutable update contract where updated objects should have the same ID.
- **Fix:** Changed `updateLot` to construct the updated Lot object directly instead of calling `createLot`, preserving the original `lot.id` while creating a new frozen instance.
- **Files modified:** src/domain/models/Lot.ts
- **Commit:** 722e0e9 (included in Task 1 commit)
- **Test impact:** Fixed failing test "returns new lot with updated name" and verified ID preservation across all update operations

## Verification Results

All success criteria met:

- ✓ Protocol type enforces exactly 3 manejos via readonly tuple `[number, number, number]`
- ✓ 3 pre-defined protocols exist with correct day sequences and stable IDs
- ✓ Pre-defined protocols are immutable (updateProtocol throws, canDeleteProtocol returns false)
- ✓ Custom protocols can be created with any day values (no validation restrictions)
- ✓ Lot model links lot to protocol with per-lot interval configuration
- ✓ Round config defaults to 4 rounds, 22-day interval
- ✓ All types importable via barrel exports
- ✓ `npm run type-check` passes with zero errors
- ✓ All domain types use readonly properties
- ✓ Pre-defined protocols have stable IDs (not random UUIDs)
- ✓ Factory functions return frozen instances (Object.freeze)
- ✓ All tests pass (41 tests)

**Import verification:**
```typescript
// All these imports work via barrel exports
import { Protocol, Lot, RoundConfig, createProtocol, createLot } from '@/domain/models';
import { PREDEFINED_PROTOCOLS, DEFAULT_LOT_NAMES } from '@/domain/constants';
```

## Next Steps

Domain model layer is complete. Subsequent plans can now:
- Import domain types and factories via clean barrel exports
- Use pre-defined protocols from `PREDEFINED_PROTOCOLS` constant
- Create custom protocols via `createProtocol` factory
- Build calculation logic using immutable domain objects
- Implement UI components that display and manipulate domain data
- Store/load domain objects from localStorage (stable IDs ensure consistency)

## Performance Metrics

- **Duration:** 3 minutes 2 seconds
- **Tasks completed:** 2 of 2
- **Commits:** 2
- **Files created:** 10
- **Files modified:** 1 (bug fix)
- **Tests added:** 39 (24 + 15)
- **Test coverage:** 41 tests passing

## Self-Check: PASSED

Verifying all claimed artifacts exist:

✓ src/domain/models/Protocol.ts exists
✓ src/domain/models/Round.ts exists
✓ src/domain/models/Lot.ts exists
✓ src/domain/models/index.ts exists
✓ src/domain/constants/protocols.ts exists
✓ src/domain/constants/index.ts exists
✓ src/domain/models/Protocol.test.ts exists
✓ src/domain/models/Round.test.ts exists
✓ src/domain/models/Lot.test.ts exists
✓ src/domain/constants/protocols.test.ts exists

✓ Commit 722e0e9 exists
✓ Commit 5893ecf exists

All files created and commits verified.
