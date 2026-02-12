# Phase 1: Foundation - Research

**Researched:** 2026-02-12
**Domain:** React + TypeScript + Vite with date-fns for date calculations
**Confidence:** HIGH

## Summary

Phase 1 establishes a React + TypeScript + Vite foundation with a bulletproof date calculation engine using date-fns 4.x. The phase focuses on domain modeling with immutable protocol and round objects, date calculations without timezone bugs, and localStorage persistence. User decisions lock the tech stack (React + TypeScript + Vite + Tailwind CSS + shadcn/ui + date-fns), leaving architecture patterns, state management, and testing strategy to Claude's discretion.

date-fns 4.x introduces first-class timezone support via @date-fns/tz, but for this phase's pure date calculations (adding days from D0), the core addDays function handles edge cases (leap years, month boundaries) correctly without needing timezone handling. The domain model uses TypeScript's readonly and immutability patterns to ensure protocols cannot be mutated after creation.

**Primary recommendation:** Use date-fns core addDays for calculations, domain-driven folder structure with feature-first organization, Zustand for lightweight state management, and type-safe localStorage wrapper with Zod validation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Pre-defined protocols
- 3 protocolos padrão: D0-D7-D9, D0-D8-D10, D0-D9-D11
- Nomeados pela sequência de dias (ex: "D0-D7-D9"), sem nome descritivo
- Cada protocolo tem exatamente 3 manejos (D0 + 2 subsequentes)
- Manejos referenciados apenas pelo dia (D0, D7, D9), sem descrição do procedimento
- Pré-definidos são fixos — não podem ser editados ou deletados

#### Custom protocol rules
- Usuário informa os 3 dias diretamente (ex: D0, D8, D10)
- Sem restrição de validação — usuário pode colocar qualquer dia
- Protocolos customizados são salváveis — ficam na lista junto com pré-definidos
- Customizados podem ser editados e deletados

#### Round configuration
- Padrão: 4 rodadas (A1-A4), configurável de 1 a 6
- Número de rodadas é global — todos os lotes da estação têm o mesmo número
- Intervalo entre rodadas: padrão 22 dias, configurável por lote
- Intervalo único por lote (todas as transições A1→A2, A2→A3 etc usam o mesmo valor)
- Sem restrição na faixa do intervalo — usuário define o valor

#### Tech stack
- React + TypeScript + Vite
- Tailwind CSS + Shadcn/ui para componentes
- date-fns para cálculos de data (já definido nos success criteria)

### Claude's Discretion
- Estrutura de pastas e organização do código
- Padrão de state management (Context, Zustand, etc)
- Estratégia de testes (Vitest, testing patterns)
- Formato interno dos domain objects

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns | 4.1.0 | Date manipulation and calculations | 24,000+ dependents, tree-shakeable, handles edge cases (leap years, month boundaries), 200+ pure functions |
| React | 19.x | UI library | Latest stable, required by shadcn/ui |
| TypeScript | 5.x | Type safety | Industry standard for React projects in 2026 |
| Vite | 7.x | Build tool | 40x faster than CRA, native HMR, first-class TypeScript support |
| Tailwind CSS | 4.x | Styling | CSS-first configuration, required by shadcn/ui |
| shadcn/ui | latest | Component library | Copy-paste components, full control, Tailwind v4 support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.x | State management | Lightweight (<1kb), avoids Context API re-render issues, recommended for this phase's simple state |
| Vitest | 2.x | Testing framework | 4x faster than Jest, reuses Vite config, native TypeScript support |
| @testing-library/react | latest | Component testing | Behavior-focused testing, accessibility-first queries |
| @testing-library/user-event | latest | User interaction simulation | More realistic than fireEvent |
| Zod | 3.x | Runtime validation | Type-safe localStorage persistence, validates user input |
| @date-fns/tz | 1.x | Timezone support | ONLY if timezone conversions needed (NOT required for this phase) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand | Context API | Context causes unnecessary re-renders, more boilerplate |
| Zustand | Redux Toolkit | Overkill for simple state, larger bundle, more setup |
| Vitest | Jest | Slower, separate config from Vite, older ecosystem |
| date-fns | Moment.js | Deprecated, mutable API (dangerous), larger bundle |
| date-fns | Day.js | Smaller but fewer edge case fixes, less active maintenance |

**Installation:**
```bash
# Core dependencies
npm install react react-dom
npm install date-fns zustand zod

# Development dependencies
npm install -D vite @vitejs/plugin-react typescript
npm install -D tailwindcss @tailwindcss/vite
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npm install -D @types/node @types/react @types/react-dom

# shadcn/ui setup (after Tailwind configured)
npx shadcn@latest init
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── domain/              # Pure domain logic (no React)
│   ├── models/          # Domain entities
│   │   ├── Protocol.ts
│   │   ├── Round.ts
│   │   └── Lot.ts
│   ├── calculations/    # Date calculation engine
│   │   ├── dateEngine.ts
│   │   └── dateEngine.test.ts
│   └── constants/       # Pre-defined protocols
│       └── protocols.ts
├── store/               # Zustand stores
│   ├── protocolStore.ts
│   ├── roundStore.ts
│   └── persistenceMiddleware.ts
├── lib/                 # Utilities
│   ├── storage.ts       # Type-safe localStorage wrapper
│   └── utils.ts         # shadcn/ui cn() helper
├── components/          # React components (Phase 2 focus)
│   └── ui/              # shadcn/ui components
└── App.tsx
```

### Pattern 1: Immutable Domain Objects
**What:** Use readonly TypeScript properties and return new instances instead of mutating
**When to use:** All domain models (Protocol, Round, Lot)
**Example:**
```typescript
// Source: Domain-Driven Design TypeScript patterns
// https://medium.com/@matt.denobrega/domain-modeling-in-typescript-a53cb76a7226

export interface Protocol {
  readonly id: string;
  readonly name: string;  // "D0-D7-D9"
  readonly days: readonly [number, number, number];  // [0, 7, 9]
  readonly isPredefined: boolean;
}

export const createProtocol = (
  name: string,
  days: [number, number, number],
  isPredefined = false
): Protocol => ({
  id: crypto.randomUUID(),
  name,
  days: Object.freeze(days),
  isPredefined,
});

// Updating creates new instance
export const updateProtocol = (
  protocol: Protocol,
  updates: { name?: string; days?: [number, number, number] }
): Protocol => ({
  ...protocol,
  ...updates,
  id: protocol.id,  // Preserve identity
  isPredefined: protocol.isPredefined,  // Cannot change
});
```

### Pattern 2: Pure Date Calculation Engine
**What:** Separate date calculation logic from React, use date-fns addDays
**When to use:** All date calculations for manejo and round dates
**Example:**
```typescript
// Source: date-fns documentation
// https://date-fns.org/

import { addDays } from 'date-fns';

export interface ManejoDate {
  readonly day: number;      // D0, D7, D9
  readonly date: Date;
  readonly round: string;    // "A1", "A2", etc
}

export const calculateManejoDate = (
  d0: Date,
  dayOffset: number,
  roundOffset: number,
  roundInterval: number
): Date => {
  // Calculate round start (D0 for this round)
  const roundStartDate = addDays(d0, roundOffset * roundInterval);

  // Calculate manejo date
  return addDays(roundStartDate, dayOffset);
};

// Example: Calculate all manejo dates for protocol across rounds
export const calculateProtocolDates = (
  d0: Date,
  protocol: Protocol,
  rounds: number,
  roundInterval: number
): ManejoDate[] => {
  const dates: ManejoDate[] = [];

  for (let round = 0; round < rounds; round++) {
    protocol.days.forEach(day => {
      const date = calculateManejoDate(d0, day, round, roundInterval);
      dates.push({
        day,
        date,
        round: `A${round + 1}`,
      });
    });
  }

  return dates;
};
```

### Pattern 3: Type-Safe localStorage with Zod
**What:** Wrap localStorage with TypeScript types and Zod validation
**When to use:** Persisting custom protocols and user preferences
**Example:**
```typescript
// Source: Type-safe localStorage patterns
// https://www.herodevs.com/blog-posts/interact-with-browser-storage-type-safe

import { z } from 'zod';

const ProtocolSchema = z.object({
  id: z.string(),
  name: z.string(),
  days: z.tuple([z.number(), z.number(), z.number()]),
  isPredefined: z.boolean(),
});

const StorageSchema = z.object({
  customProtocols: z.array(ProtocolSchema),
  roundInterval: z.number().default(22),
  roundCount: z.number().min(1).max(6).default(4),
});

type StorageData = z.infer<typeof StorageSchema>;

export class TypedStorage {
  private static KEY = 'iatf-planner';

  static load(): StorageData {
    try {
      const json = localStorage.getItem(this.KEY);
      if (!json) return this.getDefaults();

      const parsed = JSON.parse(json);
      return StorageSchema.parse(parsed);  // Validates and throws on invalid data
    } catch (error) {
      console.warn('Invalid localStorage data, using defaults', error);
      return this.getDefaults();
    }
  }

  static save(data: StorageData): void {
    const validated = StorageSchema.parse(data);  // Ensure valid before saving
    localStorage.setItem(this.KEY, JSON.stringify(validated));
  }

  private static getDefaults(): StorageData {
    return {
      customProtocols: [],
      roundInterval: 22,
      roundCount: 4,
    };
  }
}
```

### Pattern 4: Zustand Store with Persistence Middleware
**What:** Lightweight state management with automatic localStorage sync
**When to use:** Global state (custom protocols, configuration)
**Example:**
```typescript
// Source: Zustand documentation + localStorage patterns
// https://medium.com/@sparklewebhelp/redux-vs-zustand-vs-context-api-in-2026-7f90a2dc3439

import { create } from 'zustand';
import { TypedStorage } from '@/lib/storage';

interface StoreState {
  customProtocols: Protocol[];
  roundCount: number;
  roundInterval: number;

  addProtocol: (protocol: Protocol) => void;
  updateProtocol: (id: string, updates: Partial<Protocol>) => void;
  deleteProtocol: (id: string) => void;
  setRoundCount: (count: number) => void;
  setRoundInterval: (interval: number) => void;
}

export const useStore = create<StoreState>((set, get) => {
  // Load initial state
  const initial = TypedStorage.load();

  // Helper to persist after state changes
  const persist = (updater: (state: StoreState) => Partial<StoreState>) => {
    set((state) => {
      const updates = updater(state);
      const newState = { ...state, ...updates };

      // Save to localStorage
      TypedStorage.save({
        customProtocols: newState.customProtocols,
        roundCount: newState.roundCount,
        roundInterval: newState.roundInterval,
      });

      return updates;
    });
  };

  return {
    customProtocols: initial.customProtocols,
    roundCount: initial.roundCount,
    roundInterval: initial.roundInterval,

    addProtocol: (protocol) => persist(() => ({
      customProtocols: [...get().customProtocols, protocol],
    })),

    updateProtocol: (id, updates) => persist(() => ({
      customProtocols: get().customProtocols.map(p =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

    deleteProtocol: (id) => persist(() => ({
      customProtocols: get().customProtocols.filter(p => p.id !== id),
    })),

    setRoundCount: (count) => persist(() => ({ roundCount: count })),

    setRoundInterval: (interval) => persist(() => ({ roundInterval: interval })),
  };
});
```

### Anti-Patterns to Avoid
- **Using Date constructor with strings:** Date parsing is inconsistent across browsers and timezones. Always use date-fns parseISO or construct with explicit parameters.
- **Mutating domain objects:** Protocols and rounds should be immutable. Never use `protocol.days[0] = 5`.
- **Context API for frequently-changing state:** Causes re-renders in all consumers. Use Zustand instead.
- **Testing implementation details:** Don't test internal state or private methods. Test behavior and outputs.
- **JSON.stringify for dates:** Dates serialize to ISO strings and lose timezone context. Store D0 as ISO string, reconstruct with parseISO.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date calculations | Custom day-adding logic with month/leap year checks | date-fns addDays | Handles edge cases: leap years, month boundaries, DST transitions. Battle-tested by 24,000+ packages. |
| Date formatting | String concatenation or Intl.DateTimeFormat wrappers | date-fns format | Consistent formatting, locale support, timezone-aware with @date-fns/tz. |
| State management | Custom context + reducer + localStorage sync | Zustand with persist middleware | 1kb, prevents re-render issues, built-in persistence patterns. |
| Runtime validation | Manual type checks and validation functions | Zod schemas | Type inference, composable validators, clear error messages. |
| UI components | Custom button/input/select components | shadcn/ui components | Accessible, customizable, Tailwind-based, no runtime dependency. |
| Immutability helpers | Object.freeze() everywhere or custom copy functions | TypeScript readonly + spread operators | Zero runtime cost, compile-time safety, idiomatic TypeScript. |

**Key insight:** Date manipulation is deceptively complex with timezone, DST, leap years, and month boundary edge cases. date-fns has 10+ years of bug fixes and edge case handling that would take months to replicate and test thoroughly.

## Common Pitfalls

### Pitfall 1: Timezone Confusion with Date Objects
**What goes wrong:** JavaScript Date objects always represent UTC timestamps but display in local timezone. Calculations that cross DST boundaries or work with user input can produce off-by-one-day errors.
**Why it happens:** Date constructor parses "2024-01-01" as local midnight, but "2024-01-01T00:00:00Z" as UTC midnight. Serialization with toISOString() always outputs UTC.
**How to avoid:**
  - For pure date arithmetic (this phase): use date-fns addDays with Date objects, never parse strings without explicit timezone
  - Store D0 as ISO string in localStorage: `new Date().toISOString()`
  - Reconstruct with parseISO: `parseISO(storedD0)`
  - Display with format: `format(date, 'dd/MM/yyyy')` (no timezone issues for date-only display)
**Warning signs:** Different results in different timezones, dates off by one day, December 31 + 1 day shows wrong year

### Pitfall 2: Mutating Domain Objects
**What goes wrong:** Accidentally modifying a protocol or round object breaks immutability assumptions, causing stale UI or incorrect persistence.
**Why it happens:** TypeScript readonly is compile-time only. Runtime code can still mutate if you ignore types or use libraries that mutate.
**How to avoid:**
  - Always use readonly on all domain object properties
  - Create new objects for updates: `{ ...protocol, name: newName }`
  - Use Object.freeze() on arrays: `days: Object.freeze([0, 7, 9])`
  - Enable strict TypeScript: `"strict": true` in tsconfig.json
**Warning signs:** Changes to one protocol affecting others, localStorage containing stale data, UI not updating after changes

### Pitfall 3: localStorage Data Corruption
**What goes wrong:** Manual edits to localStorage or version changes break JSON parsing, causing app to crash or lose data.
**Why it happens:** localStorage is plain text. Users can edit it. Code changes can invalidate old data structure.
**How to avoid:**
  - Wrap localStorage access in try-catch
  - Use Zod to validate loaded data: `StorageSchema.parse(json)`
  - Provide sensible defaults on validation failure
  - Version your schema: `{ version: 1, data: {...} }`
**Warning signs:** App crashes on reload, lost custom protocols, default values appearing unexpectedly

### Pitfall 4: Context API Performance Issues
**What goes wrong:** Using Context API for custom protocols list causes all consuming components to re-render on every protocol addition/edit/deletion.
**Why it happens:** Context value change triggers re-render in ALL consumers, even if they only read unrelated parts of state.
**How to avoid:**
  - Use Zustand instead of Context for state that changes frequently
  - If using Context, split into multiple contexts by concern
  - Use React.memo() and useMemo() to prevent cascade re-renders
**Warning signs:** Sluggish UI when adding protocols, unnecessary re-renders in React DevTools, input lag

### Pitfall 5: Leap Year and Month Boundary Bugs
**What goes wrong:** Custom date arithmetic fails on edge cases: Feb 29 in non-leap years, adding 30 days from Jan 31, Dec 31 + 1 day.
**Why it happens:** Manual date math assumes all months have 30 days or doesn't account for leap years.
**How to avoid:**
  - NEVER do manual arithmetic: `new Date(year, month, day + offset)`
  - ALWAYS use date-fns: `addDays(date, offset)`
  - Test edge cases: Dec 31, Feb 28/29, month boundaries
**Warning signs:** Wrong dates in December→January transitions, crashes in February on leap years, incorrect month rollover

### Pitfall 6: Vitest Browser Globals Not Configured
**What goes wrong:** Tests fail with "localStorage is not defined" or "crypto is not defined" errors.
**Why it happens:** Node environment doesn't have browser APIs. Vitest needs explicit configuration.
**How to avoid:**
  - Set `environment: 'jsdom'` in vitest.config.ts
  - Set `globals: true` to avoid importing describe/it/expect
  - Add setupFiles pointing to test setup that imports @testing-library/jest-dom
**Warning signs:** ReferenceError for browser APIs, missing expect matchers, having to import test functions

## Code Examples

Verified patterns from official sources:

### Adding Days to D0 (Core Calculation)
```typescript
// Source: date-fns documentation
// https://date-fns.org/

import { addDays, format } from 'date-fns';

const d0 = new Date(2024, 0, 15);  // Jan 15, 2024

// Calculate D7 for round A1
const d7_A1 = addDays(d0, 7);  // Jan 22, 2024

// Calculate D0 for round A2 (22 days after A1 D0)
const d0_A2 = addDays(d0, 22);  // Feb 6, 2024

// Calculate D9 for round A2
const d9_A2 = addDays(d0_A2, 9);  // Feb 15, 2024

// Format for display
const formatted = format(d9_A2, 'dd/MM/yyyy');  // "15/02/2024"
```

### Edge Case Handling
```typescript
// Source: date-fns edge case behavior
// https://www.slingacademy.com/article/handling-leap-years-and-edge-cases-in-javascript-date-calculations/

import { addDays, isLeapYear } from 'date-fns';

// Edge case 1: December 31 + 1 day
const dec31 = new Date(2024, 11, 31);
const jan1 = addDays(dec31, 1);  // Correctly: Jan 1, 2025

// Edge case 2: February 28 in leap year
const feb28Leap = new Date(2024, 1, 28);
const feb29 = addDays(feb28Leap, 1);  // Correctly: Feb 29, 2024

// Edge case 3: February 28 in non-leap year
const feb28NonLeap = new Date(2023, 1, 28);
const mar1 = addDays(feb28NonLeap, 1);  // Correctly: Mar 1, 2023

// Validation: Check if year is leap year
const is2024Leap = isLeapYear(new Date(2024, 0, 1));  // true
const is2023Leap = isLeapYear(new Date(2023, 0, 1));  // false
```

### Pre-defined Protocols Constant
```typescript
// Source: Domain modeling patterns
// https://medium.com/@matt.denobrega/domain-modeling-in-typescript-a53cb76a7226

export const PREDEFINED_PROTOCOLS: readonly Protocol[] = Object.freeze([
  {
    id: 'predefined-1',
    name: 'D0-D7-D9',
    days: Object.freeze([0, 7, 9] as [number, number, number]),
    isPredefined: true,
  },
  {
    id: 'predefined-2',
    name: 'D0-D8-D10',
    days: Object.freeze([0, 8, 10] as [number, number, number]),
    isPredefined: true,
  },
  {
    id: 'predefined-3',
    name: 'D0-D9-D11',
    days: Object.freeze([0, 9, 11] as [number, number, number]),
    isPredefined: true,
  },
]);

// Helper: Get all protocols (predefined + custom)
export const getAllProtocols = (customProtocols: Protocol[]): Protocol[] => {
  return [...PREDEFINED_PROTOCOLS, ...customProtocols];
};
```

### Vitest + React Testing Library Setup
```typescript
// vitest.config.ts
// Source: Vitest React Testing Library setup
// https://oneuptime.com/blog/post/2026-01-15-unit-test-react-vitest-testing-library/view

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

// src/test/setup.ts
import '@testing-library/jest-dom';

// Example test
// src/domain/calculations/dateEngine.test.ts
import { describe, it, expect } from 'vitest';
import { addDays } from 'date-fns';
import { calculateManejoDate } from './dateEngine';

describe('dateEngine', () => {
  it('calculates D7 for round A1 correctly', () => {
    const d0 = new Date(2024, 0, 15);  // Jan 15, 2024
    const d7 = calculateManejoDate(d0, 7, 0, 22);

    expect(d7).toEqual(new Date(2024, 0, 22));  // Jan 22, 2024
  });

  it('handles December 31 + 1 day correctly', () => {
    const d0 = new Date(2024, 11, 31);  // Dec 31, 2024
    const nextDay = addDays(d0, 1);

    expect(nextDay.getFullYear()).toBe(2025);
    expect(nextDay.getMonth()).toBe(0);  // January
    expect(nextDay.getDate()).toBe(1);
  });

  it('handles leap year Feb 29 correctly', () => {
    const feb28 = new Date(2024, 1, 28);
    const feb29 = addDays(feb28, 1);

    expect(feb29.getDate()).toBe(29);
    expect(feb29.getMonth()).toBe(1);  // February
  });
});
```

### shadcn/ui Setup for Vite
```typescript
// Source: shadcn/ui Vite installation
// https://ui.shadcn.com/docs/installation/vite

// Step 1: Install Tailwind
// npm install tailwindcss @tailwindcss/vite

// Step 2: src/index.css
// @import "tailwindcss";

// Step 3: vite.config.ts
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

// Step 4: tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// Step 5: Initialize shadcn/ui
// npx shadcn@latest init

// Step 6: Add components as needed
// npx shadcn@latest add button
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Moment.js | date-fns or Temporal (future) | 2020+ | Moment deprecated, date-fns is immutable and tree-shakeable |
| Create React App | Vite | 2021-2023 | CRA unmaintained, Vite 40x faster with native ESM |
| Redux | Zustand/Jotai for simple state | 2022-2026 | Redux overkill for simple apps, Zustand <1kb and simpler API |
| Jest | Vitest | 2023-2026 | Vitest 4x faster, reuses Vite config, better ESM support |
| Component libraries (MUI, Ant) | shadcn/ui (copy-paste) | 2023-2026 | Full control, no runtime dependency, Tailwind-based |
| tailwind.config.js | CSS-first config in Tailwind v4 | 2024-2026 | Simpler config, better performance, native CSS variables |
| Separate test config | Unified Vite config | 2023-2026 | Single source of truth for path aliases and plugins |

**Deprecated/outdated:**
- **Moment.js**: Officially deprecated, mutable API causes bugs, 67kb minified
- **Create React App**: Unmaintained since 2023, slow builds, webpack configuration complexity
- **date-fns v2 timezone handling**: v3 and v4 introduced breaking changes and better timezone support
- **tailwindcss-animate**: Replaced by tw-animate-css in Tailwind v4 + shadcn/ui projects

## Open Questions

1. **Date serialization format for localStorage**
   - What we know: Dates don't serialize to JSON preserving timezone
   - What's unclear: Should we store D0 as ISO string or timestamp?
   - Recommendation: ISO string (toISOString/parseISO) - human readable, standard format

2. **Testing strategy depth**
   - What we know: Vitest + React Testing Library is standard
   - What's unclear: How much coverage for domain logic vs UI components in Phase 1?
   - Recommendation: Focus on dateEngine tests (edge cases critical), minimal UI tests (Phase 2 focus)

3. **Round interval validation**
   - What we know: User can set any interval, no restrictions (per CONTEXT.md)
   - What's unclear: Should we warn on extreme values (0 days, 365 days)?
   - Recommendation: No validation per user decision, but could add UI hints (e.g., "typical: 21-25 days")

4. **Custom protocol persistence lifecycle**
   - What we know: Custom protocols are editable and deletable
   - What's unclear: Should edits create new version or mutate in place (with new dates)?
   - Recommendation: Update in place, recalculate dates - simpler UX, matches user expectation

## Sources

### Primary (HIGH confidence)
- [date-fns official documentation](https://date-fns.org/) - Core library features and API
- [date-fns v4.0 blog post](https://blog.date-fns.org/v40-with-time-zone-support/) - Timezone support changes
- [shadcn/ui Vite installation](https://ui.shadcn.com/docs/installation/vite) - Official setup guide
- [Vite official guide](https://vite.dev/guide/) - Current version and features

### Secondary (MEDIUM confidence)
- [State Management in 2026: Redux, Context API, and Modern Patterns](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns) - State management landscape
- [Redux vs Zustand vs Context API in 2026](https://medium.com/@sparklewebhelp/redux-vs-zustand-vs-context-api-in-2026-7f90a2dc3439) - Performance comparison
- [How to Unit Test React Components with Vitest and React Testing Library](https://oneuptime.com/blog/post/2026-01-15-unit-test-react-vitest-testing-library/view) - Testing setup
- [Domain modeling in TypeScript](https://medium.com/@matt.denobrega/domain-modeling-in-typescript-a53cb76a7226) - Immutability patterns
- [Type-Safe Browser Storage](https://www.herodevs.com/blog-posts/interact-with-browser-storage-type-safe) - localStorage patterns

### Tertiary (LOW confidence - requires validation)
- [Handling Leap Years and Edge Cases](https://www.slingacademy.com/article/handling-leap-years-and-edge-cases-in-javascript-date-calculations/) - Edge case examples (general JS, not date-fns specific)
- [React TypeScript project structure 2026](https://thiraphat-ps-dev.medium.com/best-practices-for-structuring-a-react-typescript-project-f5ee7f9a264e) - Folder organization patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries locked by user decision, versions verified via official docs and npm
- Architecture: HIGH - Domain-driven patterns well-established, Zustand recommended for this use case
- Pitfalls: MEDIUM-HIGH - Timezone and immutability pitfalls verified, Context performance issues documented
- Edge cases: HIGH - date-fns addDays edge case handling verified in docs and issue tracker

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days - stack is stable, Vite/React changes are infrequent)
