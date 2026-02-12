# Architecture Research

**Domain:** Client-side scheduling/date calculation web app
**Researched:** 2026-02-12
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Table   │  │  Forms   │  │  Export  │  │  Config  │    │
│  │   UI     │  │   UI     │  │  Dialog  │  │  Panel   │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
├───────┴─────────────┴─────────────┴─────────────┴───────────┤
│                   State Management Layer                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Application State (Zustand/Redux/Context)           │   │
│  │  - Lots data                                          │   │
│  │  - Calculated dates                                   │   │
│  │  - Conflict markers                                   │   │
│  │  - UI state (locked lots, selected conflicts)        │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                        │
├─────────────────────┴───────────────────────────────────────┤
│                   Business Logic Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   Date   │  │ Conflict │  │ Conflict │  │  Export  │    │
│  │  Engine  │  │ Detector │  │ Resolver │  │ Generator│    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
├───────┴─────────────┴─────────────┴─────────────┴───────────┤
│                     Domain Model Layer                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Value Objects (immutable)                          │    │
│  │  - Protocol, Lot, DateRange, ConflictMarker         │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    Persistence Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  localStorage Adapter (type-safe wrapper)            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Date Engine** | Pure function: given D0 + protocol + intervals, compute all handling dates for a lot | TypeScript module with immutable value objects |
| **Conflict Detector** | Pure function: given array of lots with computed dates, identify Sunday conflicts and same-day overlaps | TypeScript module using Set/Map for efficient lookups |
| **Conflict Resolver** | CSP solver: tries all D0/interval combinations to find configuration minimizing conflicts | Backtracking algorithm with heuristics, possibly using constraint solver libraries |
| **Export Generator** | Takes application state, generates PDF/Excel/CSV | Client-side libraries (jsPDF, pdf-lib, ExcelJS) |
| **State Management** | Central store holding lots, calculated dates, conflicts, UI state | Zustand with persist middleware or Redux Toolkit |
| **Persistence Adapter** | Type-safe wrapper around localStorage with serialization/deserialization | Custom TypeScript class with generics |
| **UI Components** | React/Vue/Svelte components for rendering, user input | Framework-specific components consuming state via hooks/selectors |

## Recommended Project Structure

```
src/
├── domain/                 # Domain model (pure TypeScript, no framework dependencies)
│   ├── value-objects/      # Immutable value objects
│   │   ├── Protocol.ts     # Protocol definition with default intervals
│   │   ├── Lot.ts          # Lot with name, D0, protocol, intervals
│   │   ├── DateRange.ts    # Start/end date with validation
│   │   └── Conflict.ts     # ConflictType (Sunday/Overlap) + affected lots
│   └── types.ts            # Domain type definitions
├── core/                   # Business logic (pure functions)
│   ├── date-engine/        # Date calculation engine
│   │   ├── calculator.ts   # Main calculation logic
│   │   └── utils.ts        # Date arithmetic utilities
│   ├── conflict/           # Conflict detection and resolution
│   │   ├── detector.ts     # Identify conflicts
│   │   ├── resolver.ts     # CSP solver for conflict resolution
│   │   └── auto-stagger.ts # Auto D0 spacing algorithm
│   └── validation/         # Business rule validation
│       └── validators.ts   # Input validation logic
├── state/                  # State management
│   ├── store.ts            # Zustand/Redux store definition
│   ├── slices/             # State slices (if using Redux)
│   │   ├── lots.ts         # Lots state + actions
│   │   ├── conflicts.ts    # Conflicts state + actions
│   │   └── ui.ts           # UI state (locked lots, selections)
│   ├── selectors.ts        # Memoized selectors for derived state
│   └── hooks.ts            # Custom hooks for state access
├── services/               # Infrastructure/side effects
│   ├── persistence/        # localStorage persistence
│   │   ├── storage.ts      # Type-safe storage adapter
│   │   └── serializers.ts  # JSON serialization/deserialization
│   └── export/             # Export generation
│       ├── pdf.ts          # PDF generation
│       ├── excel.ts        # Excel generation
│       └── csv.ts          # CSV generation
├── components/             # UI components
│   ├── Table/              # Main data table
│   ├── Forms/              # Input forms
│   ├── ExportDialog/       # Export configuration
│   └── ConfigPanel/        # Configuration panel
├── hooks/                  # Custom React hooks
│   ├── useCalculation.ts   # Hook connecting UI to date engine
│   └── useConflicts.ts     # Hook for conflict detection/resolution
└── utils/                  # Shared utilities
    ├── date.ts             # Date formatting/parsing utilities
    └── constants.ts        # Application constants
```

### Structure Rationale

- **domain/:** Contains pure domain logic with no framework dependencies. Can be unit tested in isolation and potentially reused in Node.js CLI or backend.
- **core/:** Business logic layer. Pure functions that take inputs and return outputs. Easily testable, no side effects.
- **state/:** Centralized state management. Single source of truth for application data. Zustand recommended for simpler setup vs Redux.
- **services/:** Side effects and infrastructure concerns. Separated from business logic for testability.
- **components/:** UI layer. Thin presentation components that consume state and dispatch actions. Framework-specific code isolated here.

## Architectural Patterns

### Pattern 1: Layered Architecture with Pure Core

**What:** Organize code in layers with dependencies flowing inward. Outer layers (UI, persistence) depend on inner layers (domain, core), never the reverse.

**When to use:** Always. Especially valuable for apps with complex business logic like date calculations and constraint solving.

**Trade-offs:**
- **Pros:** Testability (core logic has no dependencies), flexibility (swap UI framework or storage), clarity (clear component boundaries)
- **Cons:** More boilerplate, requires discipline to maintain boundaries

**Example:**
```typescript
// domain/value-objects/Lot.ts
export class Lot {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly d0: Date,
    public readonly protocol: Protocol,
    public readonly customIntervals?: number[]
  ) {}

  // Pure method - returns new instance
  withD0(newD0: Date): Lot {
    return new Lot(this.id, this.name, newD0, this.protocol, this.customIntervals);
  }
}

// core/date-engine/calculator.ts
export function calculateHandlingDates(lot: Lot): HandlingDate[] {
  // Pure function - no side effects
  const intervals = lot.customIntervals ?? lot.protocol.defaultIntervals;
  return intervals.map((offset, index) => ({
    lotId: lot.id,
    sequence: index,
    date: addDays(lot.d0, offset),
    type: determineHandlingType(index, lot.protocol)
  }));
}

// components/Table.tsx - UI consumes core logic
function Table() {
  const lots = useStore(state => state.lots);
  const dates = lots.flatMap(calculateHandlingDates); // Uses pure core function
  return <TableView dates={dates} />;
}
```

### Pattern 2: Immutable Value Objects for Domain Model

**What:** Model domain concepts (Protocol, Lot, Conflict) as immutable TypeScript classes with validation and behavior.

**When to use:** For core domain entities that have business rules. Not needed for simple DTOs or UI-only state.

**Trade-offs:**
- **Pros:** Type safety, encapsulated validation, prevents invalid state, easier debugging (no mutation tracking)
- **Cons:** More verbose than plain objects, requires creating new instances for changes

**Example:**
```typescript
// domain/value-objects/Protocol.ts
export class Protocol {
  private constructor(
    public readonly name: string,
    public readonly defaultIntervals: readonly number[]
  ) {
    if (defaultIntervals.length === 0) {
      throw new Error('Protocol must have at least one interval');
    }
  }

  static create(name: string, intervals: number[]): Protocol {
    return new Protocol(name, Object.freeze([...intervals]));
  }

  // Returns new instance with modified intervals
  withIntervals(newIntervals: number[]): Protocol {
    return Protocol.create(this.name, newIntervals);
  }
}

// Usage
const protocol = Protocol.create('IATF', [0, 8, 9, 11]);
const modified = protocol.withIntervals([0, 7, 9, 11]); // New instance
```

### Pattern 3: CSP Solver with Backtracking for Conflict Resolution

**What:** Model conflict resolution as a Constraint Satisfaction Problem. Use backtracking algorithm to explore D0/interval combinations, pruning branches that violate constraints.

**When to use:** When you need to find optimal configurations from a large search space (e.g., trying all combinations of D0 dates and intervals for multiple lots).

**Trade-offs:**
- **Pros:** Systematic exploration guarantees finding solution if one exists, can optimize for objectives (minimize conflicts), extensible (add new constraints easily)
- **Cons:** Can be slow for large problems (exponential complexity), may need heuristics to improve performance

**Example:**
```typescript
// core/conflict/resolver.ts
interface CSPState {
  lots: Lot[];
  assignments: Map<string, { d0: Date; intervals: number[] }>;
  conflicts: Conflict[];
}

export class ConflictResolver {
  constructor(
    private lots: Lot[],
    private lockedLots: Set<string> // Lots that cannot be modified
  ) {}

  resolve(): CSPState | null {
    const initialState: CSPState = {
      lots: this.lots,
      assignments: new Map(),
      conflicts: []
    };

    return this.backtrack(initialState, 0);
  }

  private backtrack(state: CSPState, lotIndex: number): CSPState | null {
    // Base case: all lots assigned
    if (lotIndex >= this.lots.length) {
      return state.conflicts.length === 0 ? state : null;
    }

    const lot = this.lots[lotIndex];

    // Skip locked lots
    if (this.lockedLots.has(lot.id)) {
      return this.backtrack(state, lotIndex + 1);
    }

    // Try different D0 dates
    for (const d0 of this.generateD0Candidates(lot)) {
      // Try different interval configurations
      for (const intervals of this.generateIntervalCandidates(lot)) {
        const newAssignment = { d0, intervals };
        const newState = this.applyAssignment(state, lot.id, newAssignment);

        // Prune if conflicts exceed threshold
        if (newState.conflicts.length < state.conflicts.length) {
          const result = this.backtrack(newState, lotIndex + 1);
          if (result) return result;
        }
      }
    }

    return null; // No valid assignment found
  }

  private generateD0Candidates(lot: Lot): Date[] {
    // Generate range of D0 dates around current value
    const range = 7; // Try +/- 7 days
    return Array.from({ length: range * 2 + 1 }, (_, i) =>
      addDays(lot.d0, i - range)
    );
  }

  private generateIntervalCandidates(lot: Lot): number[][] {
    // For now, just use default intervals
    // Could generate variations if needed
    return [lot.protocol.defaultIntervals];
  }

  private applyAssignment(
    state: CSPState,
    lotId: string,
    assignment: { d0: Date; intervals: number[] }
  ): CSPState {
    const newAssignments = new Map(state.assignments);
    newAssignments.set(lotId, assignment);

    // Recalculate all dates and conflicts
    const updatedLots = state.lots.map(lot =>
      lot.id === lotId ? lot.withD0(assignment.d0) : lot
    );

    const conflicts = detectConflicts(updatedLots);

    return { lots: updatedLots, assignments: newAssignments, conflicts };
  }
}
```

### Pattern 4: Observer Pattern for State Changes

**What:** Use pub/sub or observer pattern to decouple state changes from side effects (persistence, recalculation).

**When to use:** When state changes should trigger multiple independent side effects (e.g., saving to localStorage, recalculating conflicts, updating UI).

**Trade-offs:**
- **Pros:** Decouples components, easy to add new observers, follows Open/Closed principle
- **Cons:** Can make data flow harder to trace, potential for memory leaks if observers not cleaned up

**Example:**
```typescript
// state/store.ts using Zustand with middleware
import create from 'zustand';
import { persist } from 'zustand/middleware';

interface BreedingState {
  lots: Lot[];
  conflicts: Conflict[];

  addLot: (lot: Lot) => void;
  updateLot: (id: string, updates: Partial<Lot>) => void;
  recalculateConflicts: () => void;
}

export const useBreedingStore = create<BreedingState>()(
  persist(
    (set, get) => ({
      lots: [],
      conflicts: [],

      addLot: (lot) => set(state => {
        const newLots = [...state.lots, lot];
        return {
          lots: newLots,
          conflicts: detectConflicts(newLots) // Auto-recalculate
        };
      }),

      updateLot: (id, updates) => set(state => {
        const newLots = state.lots.map(lot =>
          lot.id === id ? { ...lot, ...updates } : lot
        );
        return {
          lots: newLots,
          conflicts: detectConflicts(newLots) // Auto-recalculate
        };
      }),

      recalculateConflicts: () => set(state => ({
        conflicts: detectConflicts(state.lots)
      }))
    }),
    {
      name: 'breeding-storage', // localStorage key
      // Observers via middleware
      onRehydrateStorage: () => (state) => {
        if (state) state.recalculateConflicts();
      }
    }
  )
);

// UI components automatically re-render on state changes
function ConflictSummary() {
  const conflicts = useBreedingStore(state => state.conflicts);
  return <div>Total conflicts: {conflicts.length}</div>;
}
```

### Pattern 5: Adapter Pattern for Persistence

**What:** Create type-safe wrapper around localStorage with serialization/deserialization logic.

**When to use:** Always when using localStorage with TypeScript. Prevents runtime errors from invalid data.

**Trade-offs:**
- **Pros:** Type safety, encapsulated serialization, easy to swap storage backend, handles SSR gracefully
- **Cons:** Additional abstraction layer

**Example:**
```typescript
// services/persistence/storage.ts
export class TypedStorage<T> {
  constructor(
    private key: string,
    private validator: (data: unknown) => data is T
  ) {}

  get(): T | null {
    if (typeof window === 'undefined') return null; // SSR safety

    try {
      const item = localStorage.getItem(this.key);
      if (!item) return null;

      const parsed = JSON.parse(item);
      return this.validator(parsed) ? parsed : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  }

  set(value: T): void {
    if (typeof window === 'undefined') return; // SSR safety

    try {
      localStorage.setItem(this.key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  }

  remove(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.key);
  }
}

// Usage with type guard
interface AppData {
  lots: Lot[];
  version: number;
}

function isAppData(data: unknown): data is AppData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'lots' in data &&
    Array.isArray((data as AppData).lots) &&
    'version' in data &&
    typeof (data as AppData).version === 'number'
  );
}

export const appStorage = new TypedStorage<AppData>('breeding-app', isAppData);
```

## Data Flow

### Calculation Flow

```
User Input (D0, Protocol, Intervals)
    ↓
[State Update] → lots state modified
    ↓
[Date Engine] → calculateHandlingDates() for each lot
    ↓
[Conflict Detector] → detectConflicts() on all dates
    ↓
[State Update] → conflicts state updated
    ↓
[UI Re-render] → Table shows dates with conflict markers
    ↓
[Persistence] → Save to localStorage (automatic via middleware)
```

### Conflict Resolution Flow

```
User Action: "Resolve Conflicts"
    ↓
[Gather Inputs] → Locked lots, current configuration
    ↓
[CSP Resolver] → Backtrack through D0/interval combinations
    ↓
[Find Solution] → Configuration with minimal conflicts
    ↓
[State Update] → Update lot assignments
    ↓
[Recalculate] → Date engine + conflict detector run again
    ↓
[UI Update] → Table reflects new configuration
```

### Export Flow

```
User Action: "Export PDF"
    ↓
[Gather State] → Get lots, dates, conflicts from store
    ↓
[Transform] → Convert to export format (table rows, metadata)
    ↓
[PDF Generator] → jsPDF/pdf-lib renders document
    ↓
[Download] → Trigger browser download
```

### Key Data Flows

1. **Unidirectional State Flow:** UI dispatches actions → Core logic processes → State updates → UI re-renders. No circular dependencies.

2. **Derived State via Selectors:** Conflicts are derived from lots. Use memoized selectors (reselect) to avoid redundant calculations.

3. **Persistence as Side Effect:** State changes automatically trigger localStorage saves via middleware. Decoupled from business logic.

4. **Export as Read-Only Operation:** Export reads state but never modifies it. Pure function that transforms state to output format.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-50 lots | Simple Zustand store, direct calculations, no optimization needed |
| 50-200 lots | Add memoization for selectors, debounce conflict detection, consider Web Workers for CSP solving |
| 200+ lots | Web Workers mandatory for heavy calculations, virtualized table rendering, incremental conflict detection (only check modified lots) |

### Scaling Priorities

1. **First bottleneck:** Conflict detection becomes slow with many lots (O(n²) comparison). **Fix:** Spatial indexing (group dates by day in Map), incremental detection (only recheck affected lots).

2. **Second bottleneck:** CSP resolver explores exponential search space. **Fix:** Add heuristics (limit D0 search range, prune based on partial conflict count), timeout mechanism, consider simulated annealing instead of exhaustive backtracking.

3. **UI responsiveness:** Large tables freeze during re-renders. **Fix:** React.memo for table rows, virtualization (react-window), debounce user inputs.

## Anti-Patterns

### Anti-Pattern 1: Mixing Business Logic in Components

**What people do:** Put date calculation and conflict detection directly in React components.

**Why it's wrong:**
- Impossible to test without rendering components
- Cannot reuse logic in other contexts (CLI, Node.js)
- Tight coupling between UI framework and domain logic

**Do this instead:**
```typescript
// BAD - Logic in component
function Table() {
  const lots = useBreedingStore(state => state.lots);
  const dates = lots.flatMap(lot => {
    const intervals = lot.customIntervals ?? lot.protocol.defaultIntervals;
    return intervals.map((offset, i) => ({
      date: addDays(lot.d0, offset),
      lotId: lot.id
    }));
  });
  // ...
}

// GOOD - Logic in core module
// core/date-engine/calculator.ts
export function calculateHandlingDates(lot: Lot): HandlingDate[] {
  // Pure function
}

// components/Table.tsx
function Table() {
  const lots = useBreedingStore(state => state.lots);
  const dates = lots.flatMap(calculateHandlingDates); // Use pure function
  // ...
}
```

### Anti-Pattern 2: Mutating State Directly

**What people do:** Modify arrays/objects in state directly instead of creating new instances.

**Why it's wrong:**
- Breaks React's change detection (references don't change)
- Violates immutability principle
- Causes subtle bugs (stale closures, missed re-renders)

**Do this instead:**
```typescript
// BAD - Direct mutation
addLot: (lot) => {
  state.lots.push(lot); // Mutates existing array
}

// GOOD - Immutable update
addLot: (lot) => set(state => ({
  lots: [...state.lots, lot] // New array
}))
```

### Anti-Pattern 3: Global Date State Instead of Derived State

**What people do:** Store calculated dates in global state alongside lots.

**Why it's wrong:**
- Duplication (dates can be derived from lots)
- Synchronization bugs (dates get out of sync with lots)
- Larger state footprint in memory and localStorage

**Do this instead:**
```typescript
// BAD - Store derived data
interface State {
  lots: Lot[];
  calculatedDates: HandlingDate[]; // Derived from lots!
}

// GOOD - Derive on the fly with memoization
interface State {
  lots: Lot[];
}

// Memoized selector
const selectAllDates = createSelector(
  (state: State) => state.lots,
  (lots) => lots.flatMap(calculateHandlingDates)
);
```

### Anti-Pattern 4: Blocking UI During Long CSP Solving

**What people do:** Run conflict resolution synchronously in main thread.

**Why it's wrong:**
- Freezes UI during computation
- Poor UX (no feedback, appears hung)
- Cannot cancel long-running operations

**Do this instead:**
```typescript
// BAD - Blocking
function resolveConflicts() {
  const solution = new ConflictResolver(lots, lockedLots).resolve(); // Blocks!
  updateState(solution);
}

// GOOD - Web Worker with progress
// worker.ts
self.onmessage = (e) => {
  const { lots, lockedLots } = e.data;
  const resolver = new ConflictResolver(lots, lockedLots);
  const solution = resolver.resolve((progress) => {
    self.postMessage({ type: 'progress', value: progress });
  });
  self.postMessage({ type: 'complete', solution });
};

// main thread
function resolveConflicts() {
  setLoading(true);
  const worker = new Worker('worker.ts');

  worker.onmessage = (e) => {
    if (e.data.type === 'progress') {
      setProgress(e.data.value);
    } else if (e.data.type === 'complete') {
      updateState(e.data.solution);
      setLoading(false);
    }
  };

  worker.postMessage({ lots, lockedLots });
}
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| localStorage | Adapter pattern with type guards | Zustand persist middleware handles automatically |
| PDF Generation | jsPDF or pdf-lib | Use pdf-lib for more control, jsPDF for simpler tables |
| Excel/CSV Export | ExcelJS or SheetJS | ExcelJS better TypeScript support, SheetJS more features |
| Date Calculations | date-fns or Temporal | date-fns is mature, Temporal is future standard (stage 3) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ State | Hooks/selectors | One-way data flow (UI reads state, dispatches actions) |
| State ↔ Core Logic | Function calls | State calls pure functions from core, never vice versa |
| Core ↔ Domain | Direct imports | Core operates on domain value objects |
| State ↔ Persistence | Middleware | Zustand middleware auto-saves on state changes |

## Build Order Recommendations

For roadmap planning, components should be built in this order to satisfy dependencies:

### Phase 1: Foundation
1. **Domain model** (value objects: Protocol, Lot, Conflict)
2. **Date engine** (core calculation logic)
3. **Basic state management** (Zustand store with lots)

**Rationale:** Domain model has no dependencies. Date engine only depends on domain. State ties them together for UI.

### Phase 2: Core Features
4. **Conflict detector** (depends on date engine)
5. **Basic UI** (table displaying lots and dates, depends on state + date engine)
6. **Persistence** (localStorage adapter, integrates with state)

**Rationale:** Conflict detection needs dates from engine. UI needs working state. Persistence can be added to working UI.

### Phase 3: Advanced Features
7. **Conflict resolver** (CSP solver, depends on conflict detector)
8. **Auto-stagger** (depends on conflict detector and resolver)
9. **Export generation** (depends on complete state model)

**Rationale:** Resolution builds on detection. Auto-stagger uses resolver. Export needs finalized data model.

### Dependency Graph
```
Domain Model (no dependencies)
    ↓
Date Engine (→ Domain)
    ↓
Conflict Detector (→ Date Engine)
    ↓
Conflict Resolver (→ Conflict Detector)
    ↓
Auto-Stagger (→ Conflict Resolver)

State Management (→ Domain)
    ↓
UI Components (→ State, Date Engine, Conflict Detector)
    ↓
Export Generation (→ State, all core logic)

Persistence (→ State) [can be added anytime after State]
```

## Sources

**State Management (2026 Patterns):**
- [State Management in Vanilla JS: 2026 Trends](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de)
- [State Management in 2026: Redux, Context API, and Modern Patterns](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns)
- [Modern State Management in Vanilla JavaScript: 2026 Patterns and Beyond](https://medium.com/@orami98/modern-state-management-in-vanilla-javascript-2026-patterns-and-beyond-ce00425f7ac5)

**Conflict Detection and Scheduling:**
- [Advanced Conflict Detection Algorithms For Mobile Scheduling Resources](https://www.myshyft.com/blog/conflict-detection-algorithms/)
- [Automated Conflict Detection: Transforming Enterprise Scheduling Efficiency](https://www.myshyft.com/blog/conflict-detection-automation/)

**Constraint Satisfaction Problems:**
- [Kiwi.js - Fast TypeScript Cassowary constraint solver](https://github.com/IjzerenHein/kiwi.js/)
- [CSP.js - Constraint Satisfaction Problem solver in JavaScript](https://github.com/njoubert/csp.js/)
- [CSP Solvers](https://csp.hornik.dev/)

**Persistence Patterns:**
- [Mastering State Persistence with Local Storage in React](https://medium.com/@roman_j/mastering-state-persistence-with-local-storage-in-react-a-complete-guide-1cf3f56ab15c)
- [Zustand Persisting Store Data](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
- [Simplifying Local Storage with TypeScript](https://medium.com/@mithileshparmar1/simplifying-local-storage-with-typescript-1ac866ed5f40)

**PDF Generation:**
- [pdfme - Open-source PDF generation library with TypeScript](https://github.com/pdfme/pdfme)
- [pdf-lib - Create and modify PDFs in JavaScript](https://pdf-lib.js.org/)
- [jsPDF - Client-side JavaScript PDF generation](https://github.com/parallax/jsPDF)

**Domain-Driven Design:**
- [Value Objects in DDD Fundamentals](https://www.milanjovanovic.tech/blog/value-objects-in-dotnet-ddd-fundamentals)
- [DateTime as a Value Object](https://ardalis.com/datetime-as-a-value-object/)

**Immutable Data Structures:**
- [Immutable.js](https://immutable-js.com/)
- [Immer - Simplify immutable data structures](https://immerjs.github.io/immer/)
- [Immutable Data Structures in TypeScript](https://softwarepatternslexicon.com/patterns-ts/9/1/)

**Observer Pattern:**
- [Observer Design Pattern in TypeScript](https://medium.com/@robinviktorsson/a-guide-to-the-observer-design-pattern-in-typescript-and-node-js-with-practical-examples-9f8796f76516)
- [Observer Pattern with Event Emitters in TypeScript](https://softwarepatternslexicon.com/patterns-ts/14/4/)

**Separation of Concerns:**
- [Why You Should Separate UI from Business Logic](https://www.ics.com/blog/heres-why-you-should-separate-ui-business-logic-your-application)
- [The Benefits of Separating UI and Business Logic](https://medium.com/front-end-weekly/can-your-code-power-both-web-app-and-cli-26b564726d4f)

**Calendar App Architecture:**
- [Low-Level Design: Building Google Calendar's Backend Architecture](https://jinlow.medium.com/low-level-design-deep-dive-building-google-calendars-backend-architecture-46177494fc9b)
- [Google Calendar System Design](https://medium.com/@YodgorbekKomilo/google-calendar-system-design-a-scalable-and-real-time-architecture-5c2a0ef479cd)

---
*Architecture research for: IATF breeding season date calculator*
*Researched: 2026-02-12*
