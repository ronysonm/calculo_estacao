# Holidays Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add feriados as a new `'holiday'` ConflictType — highlighted in purple in the table and penalized by the optimization engine.

**Architecture:** Extend the existing conflict pipeline (ConflictType → detector → signals → UI) with a new `Holiday` value object and `customHolidaysSignal`. Holidays are persisted per-estação alongside lots. The optimizer receives holidays via worker message and adds them as penalties in `calculateObjectives`.

**Tech Stack:** Preact 10 + TypeScript, @preact/signals, Vitest, existing conflict pipeline.

---

## Quick Reference — Key Files

| File | Role |
|------|------|
| `src/domain/value-objects/Holiday.ts` | **NEW** — types + NATIONAL_HOLIDAYS constant + helpers |
| `src/domain/value-objects/Conflict.ts` | Add `'holiday'` to ConflictType + factory method |
| `src/domain/value-objects/OptimizationScenario.ts` | Add `holidayConflicts` to ScheduleObjectives |
| `src/core/conflict/detector.ts` | Add `detectHolidayConflicts()`, update `getConflictTypeForCell()` |
| `src/core/optimization/types.ts` | Add `holidayConflicts` weight to ScenarioWeights |
| `src/core/optimization/fitness-calculator.ts` | Add holiday counting + penalty |
| `src/state/signals/conflicts.ts` | Add `customHolidaysSignal`, `allHolidaysSignal`, update computed signals |
| `src/services/persistence/storage.ts` | VERSION 1→2, add customHolidays to schema |
| `src/hooks/usePersistence.ts` | Load/save customHolidays |
| `src/workers/optimizer.worker.ts` | Accept + deserialize holidays |
| `src/services/optimization/optimizer-service.ts` | Pass holidays to worker |
| `src/components/Forms/LotForm.tsx` | Pass `allHolidaysSignal.value` to optimizeSchedule |
| `src/components/Table/CalculationTable.tsx` | Pass `allHolidaysSignal.value` to getConflictTypeForCell |
| `src/components/HolidaysModal/HolidaysModal.tsx` | **NEW** — manage national + custom holidays |
| `src/styles/global.css` | Add `--color-conflict-holiday` |
| `src/styles/conflicts.css` | Add `.conflict-holiday`, `.conflict-badge-holiday`, legend |
| `src/app.tsx` | Button, badge, legend item, modal render |

---

## Task 1: Holiday Value Object

**Files:**
- Create: `src/domain/value-objects/Holiday.ts`
- Create: `tests/domain/value-objects/holiday.test.ts`

### Step 1: Write the failing test

```typescript
// tests/domain/value-objects/holiday.test.ts
import { describe, it, expect } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import {
  NATIONAL_HOLIDAYS,
  expandNationalHolidays,
  findHoliday,
} from '../../../src/domain/value-objects/Holiday';

describe('NATIONAL_HOLIDAYS', () => {
  it('should have exactly 8 national holidays', () => {
    expect(NATIONAL_HOLIDAYS.length).toBe(8);
  });

  it('should use months 1-12 (not 0-11)', () => {
    const months = NATIONAL_HOLIDAYS.map((h) => h.month);
    expect(Math.min(...months)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...months)).toBeLessThanOrEqual(12);
  });
});

describe('expandNationalHolidays', () => {
  it('expands 8 holidays for one year', () => {
    expect(expandNationalHolidays([2026])).toHaveLength(8);
  });

  it('expands 16 holidays for two years', () => {
    expect(expandNationalHolidays([2025, 2026])).toHaveLength(16);
  });

  it('creates correct DateOnly for Jan 1 2026', () => {
    const result = expandNationalHolidays([2026]);
    const jan1 = result.find((h) => h.name === 'Confraternização Universal');
    expect(jan1).toBeDefined();
    expect(jan1!.date.year).toBe(2026);
    expect(jan1!.date.month).toBe(1); // 1-based, not 0-based
    expect(jan1!.date.day).toBe(1);
  });

  it('marks national holidays as isCustom=false', () => {
    expect(expandNationalHolidays([2026]).every((h) => !h.isCustom)).toBe(true);
  });

  it('returns empty array for empty years', () => {
    expect(expandNationalHolidays([])).toHaveLength(0);
  });
});

describe('findHoliday', () => {
  it('finds matching holiday by date', () => {
    const holidays = expandNationalHolidays([2026]);
    const date = DateOnly.create(2026, 9, 7); // Independência do Brasil
    const result = findHoliday(date, holidays);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Independência do Brasil');
  });

  it('returns null for non-holiday date', () => {
    const holidays = expandNationalHolidays([2026]);
    const date = DateOnly.create(2026, 2, 15); // random weekday
    expect(findHoliday(date, holidays)).toBeNull();
  });

  it('returns null for empty holiday list', () => {
    const date = DateOnly.create(2026, 1, 1);
    expect(findHoliday(date, [])).toBeNull();
  });

  it('finds custom holiday', () => {
    const date = DateOnly.create(2026, 3, 15);
    const custom = [{ date, name: 'Feriado Municipal', isCustom: true }];
    const result = findHoliday(date, custom);
    expect(result!.name).toBe('Feriado Municipal');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test -- tests/domain/value-objects/holiday.test.ts
```
Expected: FAIL — "Cannot find module Holiday"

### Step 3: Create Holiday.ts

```typescript
// src/domain/value-objects/Holiday.ts
import { DateOnly } from './DateOnly';

export interface NationalHolidayDef {
  readonly month: number; // 1-12
  readonly day: number;
  readonly name: string;
}

export interface Holiday {
  readonly date: DateOnly;
  readonly name: string;
  readonly isCustom: boolean;
}

export interface CustomHoliday {
  readonly date: DateOnly;
  readonly name: string;
}

export const NATIONAL_HOLIDAYS: readonly NationalHolidayDef[] = [
  { month: 1,  day: 1,  name: 'Confraternização Universal' },
  { month: 4,  day: 21, name: 'Tiradentes' },
  { month: 5,  day: 1,  name: 'Dia do Trabalho' },
  { month: 9,  day: 7,  name: 'Independência do Brasil' },
  { month: 10, day: 12, name: 'N. Sra. Aparecida' },
  { month: 11, day: 2,  name: 'Finados' },
  { month: 11, day: 15, name: 'Proclamação da República' },
  { month: 12, day: 25, name: 'Natal' },
];

/**
 * Expand national holiday definitions to full Holiday objects for given years.
 */
export function expandNationalHolidays(years: readonly number[]): Holiday[] {
  const result: Holiday[] = [];
  for (const year of years) {
    for (const def of NATIONAL_HOLIDAYS) {
      result.push({
        date: DateOnly.create(year, def.month, def.day),
        name: def.name,
        isCustom: false,
      });
    }
  }
  return result;
}

/**
 * Find the first holiday matching the given date, or null.
 */
export function findHoliday(
  date: DateOnly,
  holidays: readonly Holiday[]
): Holiday | null {
  return holidays.find((h) => h.date.equals(date)) ?? null;
}
```

### Step 4: Run tests to verify they pass

```bash
npm test -- tests/domain/value-objects/holiday.test.ts
```
Expected: PASS (8 tests)

### Step 5: Commit

```bash
git add src/domain/value-objects/Holiday.ts tests/domain/value-objects/holiday.test.ts
git commit -m "feat: add Holiday value object with NATIONAL_HOLIDAYS constant"
```

---

## Task 2: Extend ConflictType + Conflict.holiday() Factory

**Files:**
- Modify: `src/domain/value-objects/Conflict.ts`
- Create: `tests/domain/value-objects/conflict.test.ts`

### Step 1: Write the failing test

```typescript
// tests/domain/value-objects/conflict.test.ts
import { describe, it, expect } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { HandlingDate } from '../../../src/domain/value-objects/HandlingDate';
import { Conflict } from '../../../src/domain/value-objects/Conflict';

function makeHandlingDate(date: DateOnly, lotId = 'lot-1'): HandlingDate {
  return new HandlingDate(lotId, 'Lote 1', 0, 'R1', 0, date);
}

describe('Conflict.holiday()', () => {
  it('creates a holiday conflict with correct type', () => {
    const date = DateOnly.create(2026, 9, 7);
    const hd = makeHandlingDate(date);
    const conflict = Conflict.holiday(hd);
    expect(conflict.type).toBe('holiday');
    expect(conflict.date.equals(date)).toBe(true);
    expect(conflict.handlingDates).toHaveLength(1);
  });

  it('ConflictType includes holiday', () => {
    const date = DateOnly.create(2026, 1, 1);
    const c = Conflict.holiday(makeHandlingDate(date));
    const type: 'sunday' | 'overlap' | 'holiday' = c.type;
    expect(type).toBe('holiday');
  });
});

describe('existing Conflict factories still work', () => {
  it('sunday conflict unchanged', () => {
    const date = DateOnly.create(2026, 2, 22); // a Sunday
    const hd = makeHandlingDate(date);
    const c = Conflict.sunday(hd);
    expect(c.type).toBe('sunday');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test -- tests/domain/value-objects/conflict.test.ts
```
Expected: FAIL — "Conflict.holiday is not a function" (or type error)

### Step 3: Update Conflict.ts

Replace in `src/domain/value-objects/Conflict.ts`:

**Old:**
```typescript
export type ConflictType = 'sunday' | 'overlap';
```

**New:**
```typescript
export type ConflictType = 'sunday' | 'overlap' | 'holiday';
```

Add after the `overlap` factory method:

```typescript
  /**
   * Create a holiday conflict
   */
  static holiday(handlingDate: HandlingDate): Conflict {
    return new Conflict('holiday', handlingDate.date, [handlingDate]);
  }
```

### Step 4: Run tests to verify they pass

```bash
npm test -- tests/domain/value-objects/conflict.test.ts
```
Expected: PASS

### Step 5: Run full tests to check for regressions

```bash
npm test
```
Expected: All tests pass (type errors may appear — fix any TypeScript strict-type switches)

### Step 6: Commit

```bash
git add src/domain/value-objects/Conflict.ts tests/domain/value-objects/conflict.test.ts
git commit -m "feat: add 'holiday' to ConflictType and Conflict.holiday() factory"
```

---

## Task 3: Extend Conflict Detector

**Files:**
- Modify: `src/core/conflict/detector.ts`
- Create: `tests/core/conflict/detector.test.ts`

### Step 1: Write the failing test

```typescript
// tests/core/conflict/detector.test.ts
import { describe, it, expect } from 'vitest';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { HandlingDate } from '../../../src/domain/value-objects/HandlingDate';
import {
  detectHolidayConflicts,
  getConflictTypeForCell,
} from '../../../src/core/conflict/detector';
import { expandNationalHolidays } from '../../../src/domain/value-objects/Holiday';

function makeHandlingDate(date: DateOnly, lotId = 'lot-1'): HandlingDate {
  return new HandlingDate(lotId, 'Lote 1', 0, 'R1', 0, date);
}

describe('detectHolidayConflicts', () => {
  it('returns empty array when no handling dates match holidays', () => {
    const date = DateOnly.create(2026, 2, 15); // not a holiday
    const hd = makeHandlingDate(date);
    const holidays = expandNationalHolidays([2026]);
    expect(detectHolidayConflicts([hd], holidays)).toHaveLength(0);
  });

  it('detects national holiday conflict', () => {
    const date = DateOnly.create(2026, 9, 7); // Independência
    const hd = makeHandlingDate(date);
    const holidays = expandNationalHolidays([2026]);
    const result = detectHolidayConflicts([hd], holidays);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('holiday');
    expect(result[0]!.date.equals(date)).toBe(true);
  });

  it('detects custom holiday conflict', () => {
    const date = DateOnly.create(2026, 3, 15);
    const hd = makeHandlingDate(date);
    const customHoliday = { date, name: 'Feriado Municipal', isCustom: true };
    const result = detectHolidayConflicts([hd], [customHoliday]);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('holiday');
  });

  it('returns empty array when holidays list is empty', () => {
    const date = DateOnly.create(2026, 9, 7);
    const hd = makeHandlingDate(date);
    expect(detectHolidayConflicts([hd], [])).toHaveLength(0);
  });

  it('creates one conflict per handling date on a holiday', () => {
    const date = DateOnly.create(2026, 12, 25); // Natal
    const holidays = expandNationalHolidays([2026]);
    const hd1 = makeHandlingDate(date, 'lot-1');
    const hd2 = makeHandlingDate(date, 'lot-2');
    const result = detectHolidayConflicts([hd1, hd2], holidays);
    expect(result).toHaveLength(2);
  });
});

describe('getConflictTypeForCell with holidays', () => {
  it('returns holiday for cell on a holiday (non-Sunday)', () => {
    // Sep 7, 2026 is Monday (Independência)
    const date = DateOnly.create(2026, 9, 7);
    const hd = makeHandlingDate(date);
    const holidays = expandNationalHolidays([2026]);
    const result = getConflictTypeForCell(date, 'lot-1', [hd], holidays);
    expect(result).toBe('holiday');
  });

  it('sunday takes priority over holiday', () => {
    // Feb 22, 2026 is a Sunday; we also mark it as a custom holiday
    const date = DateOnly.create(2026, 2, 22);
    const hd = makeHandlingDate(date);
    const customHoliday = { date, name: 'Feriado no Domingo', isCustom: true };
    const result = getConflictTypeForCell(date, 'lot-1', [hd], [customHoliday]);
    expect(result).toBe('sunday'); // sunday takes priority
  });

  it('returns null when date is not a holiday and no other conflicts', () => {
    const date = DateOnly.create(2026, 2, 17); // Tuesday, not a holiday
    const hd = makeHandlingDate(date);
    const result = getConflictTypeForCell(date, 'lot-1', [hd], []);
    expect(result).toBeNull();
  });

  it('backward compat: returns sunday without holidays param', () => {
    const date = DateOnly.create(2026, 2, 22); // Sunday
    const hd = makeHandlingDate(date);
    // @ts-expect-error testing optional param omission
    const result = getConflictTypeForCell(date, 'lot-1', [hd]);
    expect(result).toBe('sunday');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test -- tests/core/conflict/detector.test.ts
```
Expected: FAIL — `detectHolidayConflicts` is not exported

### Step 3: Update detector.ts

Full new contents of `src/core/conflict/detector.ts`:

```typescript
/**
 * Conflict Detector
 *
 * Detects three types of conflicts:
 * 1. Sunday conflicts - Handling dates that fall on Sunday
 * 2. Overlap conflicts - Multiple lots scheduled on the same date
 * 3. Holiday conflicts - Handling dates that fall on a holiday
 */

import { HandlingDate } from '@/domain/value-objects/HandlingDate';
import { Conflict } from '@/domain/value-objects/Conflict';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { Holiday } from '@/domain/value-objects/Holiday';
import { isSunday } from '@/core/date-engine/utils';
import { groupHandlingDatesByDate } from '@/core/date-engine/calculator';

/**
 * Detect all conflicts in a set of handling dates.
 * Pass holidays to also detect holiday conflicts.
 */
export function detectConflicts(
  handlingDates: HandlingDate[],
  holidays: readonly Holiday[] = []
): Conflict[] {
  const conflicts: Conflict[] = [];
  conflicts.push(...detectSundayConflicts(handlingDates));
  conflicts.push(...detectOverlapConflicts(handlingDates));
  conflicts.push(...detectHolidayConflicts(handlingDates, holidays));
  return conflicts;
}

function detectSundayConflicts(handlingDates: HandlingDate[]): Conflict[] {
  return handlingDates
    .filter((hd) => isSunday(hd.date))
    .map((hd) => Conflict.sunday(hd));
}

function detectOverlapConflicts(handlingDates: HandlingDate[]): Conflict[] {
  const overlapConflicts: Conflict[] = [];
  const grouped = groupHandlingDatesByDate(handlingDates);

  for (const [dateKey, datesOnSameDay] of grouped.entries()) {
    const uniqueLotIds = new Set(datesOnSameDay.map((hd) => hd.lotId));
    if (uniqueLotIds.size > 1) {
      const date = DateOnly.fromISOString(dateKey);
      overlapConflicts.push(Conflict.overlap(date, datesOnSameDay));
    }
  }

  return overlapConflicts;
}

/**
 * Detect holiday conflicts — one per handling date that falls on a holiday.
 */
export function detectHolidayConflicts(
  handlingDates: readonly HandlingDate[],
  holidays: readonly Holiday[]
): Conflict[] {
  if (holidays.length === 0) return [];
  return handlingDates
    .filter((hd) => holidays.some((h) => h.date.equals(hd.date)))
    .map((hd) => Conflict.holiday(hd));
}

/**
 * Get conflict type for a date cell (for table rendering).
 *
 * Priority: multiple > sunday > overlap > holiday
 *
 * @returns 'sunday' | 'overlap' | 'holiday' | 'multiple' | null
 */
export function getConflictTypeForCell(
  date: DateOnly,
  lotId: string,
  allHandlingDates: HandlingDate[],
  holidays: readonly Holiday[] = []
): 'sunday' | 'overlap' | 'holiday' | 'multiple' | null {
  const handlingDate = allHandlingDates.find(
    (hd) => hd.date.equals(date) && hd.lotId === lotId
  );
  if (!handlingDate) return null;

  const isSundayConflict = isSunday(date);

  const sameDate = allHandlingDates.filter((hd) => hd.date.equals(date));
  const uniqueLotIds = new Set(sameDate.map((hd) => hd.lotId));
  const isOverlapConflict = uniqueLotIds.size > 1;

  const isHolidayConflict = holidays.some((h) => h.date.equals(date));

  if (isSundayConflict && isOverlapConflict) return 'multiple';
  if (isSundayConflict) return 'sunday';
  if (isOverlapConflict) return 'overlap';
  if (isHolidayConflict) return 'holiday';
  return null;
}
```

### Step 4: Run tests to verify they pass

```bash
npm test -- tests/core/conflict/detector.test.ts
```
Expected: PASS

### Step 5: Run full tests + type-check

```bash
npm run type-check && npm test
```
Expected: All pass

### Step 6: Commit

```bash
git add src/core/conflict/detector.ts tests/core/conflict/detector.test.ts
git commit -m "feat: add detectHolidayConflicts and extend getConflictTypeForCell for holidays"
```

---

## Task 4: Update Reactive Signals

**Files:**
- Modify: `src/state/signals/conflicts.ts`

### Step 1: Full new contents of conflicts.ts

No failing test for this step — the signal reactivity is integration-tested implicitly. Apply the changes:

```typescript
/**
 * Conflicts State - Derived reactive state for conflict detection
 */

import { signal, computed } from '@preact/signals';
import { lotsSignal } from './lots';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { HandlingDate } from '@/domain/value-objects/HandlingDate';
import { Conflict } from '@/domain/value-objects/Conflict';
import {
  CustomHoliday,
  Holiday,
  expandNationalHolidays,
} from '@/domain/value-objects/Holiday';
import { calculateAllHandlingDates } from '@/core/date-engine/calculator';
import { detectConflicts } from '@/core/conflict/detector';
import { DEFAULT_ROUNDS } from '@/domain/constants';

/**
 * Mutable signal: user-defined custom holidays (persisted per-estação)
 */
export const customHolidaysSignal = signal<CustomHoliday[]>([]);

export function setCustomHolidays(holidays: CustomHoliday[]): void {
  customHolidaysSignal.value = holidays;
}

/**
 * Computed: all handling dates for all lots
 */
export const handlingDatesSignal = computed<HandlingDate[]>(() => {
  return calculateAllHandlingDates(lotsSignal.value, DEFAULT_ROUNDS);
});

/**
 * Computed: expanded national + custom holidays for years in the current cycle
 */
export const allHolidaysSignal = computed<Holiday[]>(() => {
  const handlingDates = handlingDatesSignal.value;
  const years = [...new Set(handlingDates.map((hd) => hd.date.year))];
  if (years.length === 0) {
    years.push(new Date().getFullYear());
  }
  const national = expandNationalHolidays(years);
  const custom: Holiday[] = customHolidaysSignal.value.map((ch) => ({
    date: ch.date,
    name: ch.name,
    isCustom: true,
  }));
  return [...national, ...custom];
});

/**
 * Computed: all conflicts (Sunday + Overlap + Holiday)
 */
export const conflictsSignal = computed<Conflict[]>(() => {
  return detectConflicts(handlingDatesSignal.value, allHolidaysSignal.value);
});

/**
 * Computed: conflict summary including holiday count
 */
export const conflictSummarySignal = computed<{
  total: number;
  sundays: number;
  overlaps: number;
  holidays: number;
}>(() => {
  const conflicts = conflictsSignal.value;
  const sundays = conflicts.filter((c) => c.type === 'sunday').length;
  const overlaps = conflicts.filter((c) => c.type === 'overlap').length;
  const holidays = conflicts.filter((c) => c.type === 'holiday').length;
  return { total: conflicts.length, sundays, overlaps, holidays };
});

/**
 * Computed: global cycle start = earliest D0 among all lots
 */
export const cycleStartSignal = computed<DateOnly | null>(() => {
  const lots = lotsSignal.value;
  if (lots.length === 0) return null;
  return lots.reduce<DateOnly>(
    (min, lot) => (lot.d0.isBefore(min) ? lot.d0 : min),
    lots[0]!.d0
  );
});
```

### Step 2: Update CalculationTable to pass holidays

In `src/components/Table/CalculationTable.tsx`, add the import:

```typescript
import { handlingDatesSignal, cycleStartSignal, allHolidaysSignal } from '@/state/signals/conflicts';
```

Then update the two calls to `getConflictTypeForCell` (lines ~234 and ~285) from:

```typescript
getConflictTypeForCell(hd.date, lot.id, allHandlingDates)
```

to:

```typescript
getConflictTypeForCell(hd.date, lot.id, allHandlingDates, allHolidaysSignal.value)
```

### Step 3: Run type-check and tests

```bash
npm run type-check && npm test
```
Expected: All pass

### Step 4: Commit

```bash
git add src/state/signals/conflicts.ts src/components/Table/CalculationTable.tsx
git commit -m "feat: add customHolidaysSignal, allHolidaysSignal; wire holidays into conflict detection"
```

---

## Task 5: CSS — Holiday Styles

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/styles/conflicts.css`

### Step 1: Add color variable in global.css

In `src/styles/global.css`, after the `--color-conflict-overlap` line, add:

```css
  --color-conflict-holiday: #9b59b6;
```

### Step 2: Add styles in conflicts.css

At the end of `src/styles/conflicts.css`, add:

```css
/* Holiday conflict */
.conflict-holiday {
  background-color: var(--color-conflict-holiday) !important;
  color: white !important;
}

.conflict-holiday .date-cell-day {
  color: rgba(255, 255, 255, 0.9) !important;
}

.conflict-badge-holiday {
  background-color: var(--color-conflict-holiday);
  color: white;
}

.conflict-legend-holiday .conflict-legend-color {
  background-color: var(--color-conflict-holiday);
}
```

### Step 3: Run type-check

```bash
npm run type-check
```

### Step 4: Commit

```bash
git add src/styles/global.css src/styles/conflicts.css
git commit -m "feat: add purple holiday conflict styles"
```

---

## Task 6: Update Persistence — Schema Migration

**Files:**
- Modify: `src/services/persistence/storage.ts`
- Modify: `src/hooks/usePersistence.ts`
- Create: `tests/services/persistence/storage-migration.test.ts`

### Step 1: Write the failing test

```typescript
// tests/services/persistence/storage-migration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EstacaoStorage } from '../../../src/services/persistence/storage';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';

// Mock localStorage for tests
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage });

describe('EstacaoStorage — v1 to v2 migration', () => {
  let storage: EstacaoStorage;

  beforeEach(() => {
    mockLocalStorage.clear();
    storage = new EstacaoStorage();
  });

  it('loads v2 data with customHolidays', () => {
    const v2Data = {
      version: 2,
      lots: [],
      customProtocols: [],
      customHolidays: [{ year: 2026, month: 3, day: 15, name: 'Feriado Municipal' }],
      savedAt: new Date().toISOString(),
    };
    mockLocalStorage.setItem('estacao-iatf-data', JSON.stringify(v2Data));
    const result = storage.load();
    expect(result).not.toBeNull();
    expect(result!.customHolidays).toHaveLength(1);
    expect(result!.customHolidays[0]!.name).toBe('Feriado Municipal');
  });

  it('migrates v1 data — returns empty customHolidays', () => {
    const v1Data = {
      version: 1,
      lots: [],
      customProtocols: [],
      savedAt: new Date().toISOString(),
    };
    mockLocalStorage.setItem('estacao-iatf-data', JSON.stringify(v1Data));
    const result = storage.load();
    expect(result).not.toBeNull();
    expect(result!.customHolidays).toEqual([]);
  });

  it('save includes customHolidays', () => {
    const holidays = [{ year: 2026, month: 6, day: 20, name: 'Festa Junina' }];
    storage.save([], [], undefined, holidays);
    const raw = JSON.parse(mockLocalStorage.getItem('estacao-iatf-data')!);
    expect(raw.version).toBe(2);
    expect(raw.customHolidays).toHaveLength(1);
    expect(raw.customHolidays[0].name).toBe('Festa Junina');
  });

  it('save without holidays defaults to empty array', () => {
    storage.save([], []);
    const raw = JSON.parse(mockLocalStorage.getItem('estacao-iatf-data')!);
    expect(raw.customHolidays).toEqual([]);
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test -- tests/services/persistence/storage-migration.test.ts
```
Expected: FAIL — version mismatch or missing customHolidays

### Step 3: Update storage.ts

Full new contents of `src/services/persistence/storage.ts`:

```typescript
/**
 * Storage Service - localStorage adapter with quota monitoring
 */

import { Lot } from '@/domain/value-objects/Lot';
import { Protocol } from '@/domain/value-objects/Protocol';

const STORAGE_KEY = 'estacao-iatf-data';
const VERSION = 2;

type CustomHolidayJSON = { year: number; month: number; day: number; name: string };

interface StorageData {
  version: number;
  lots: ReturnType<Lot['toJSON']>[];
  customProtocols: ReturnType<Protocol['toJSON']>[];
  roundSuccessRates?: readonly number[] | undefined;
  customHolidays: CustomHolidayJSON[];
  savedAt: string;
}

export class EstacaoStorage {
  save(
    lots: Lot[],
    customProtocols: Protocol[] = [],
    roundSuccessRates?: readonly number[],
    customHolidays: CustomHolidayJSON[] = []
  ): boolean {
    try {
      const data: StorageData = {
        version: VERSION,
        lots: lots.map((lot) => lot.toJSON()),
        customProtocols: customProtocols.map((p) => p.toJSON()),
        roundSuccessRates,
        customHolidays,
        savedAt: new Date().toISOString(),
      };

      const json = JSON.stringify(data);
      const sizeKB = new Blob([json]).size / 1024;

      if (sizeKB > 4096) {
        console.warn(`Storage size: ${sizeKB.toFixed(2)} KB - approaching limit!`);
        alert('Atenção: Dados estão ficando grandes. Considere exportar para Excel/PDF e começar nova estação.');
      }

      localStorage.setItem(STORAGE_KEY, json);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded');
        alert('Armazenamento cheio! Não foi possível salvar.\n\nPor favor, exporte seus dados para Excel/PDF e limpe o armazenamento.');
        return false;
      } else {
        console.error('Failed to save to localStorage:', error);
        return false;
      }
    }
  }

  load(): {
    lots: Lot[];
    customProtocols: Protocol[];
    roundSuccessRates?: readonly number[] | undefined;
    customHolidays: CustomHolidayJSON[];
  } | null {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return null;

      const data = JSON.parse(json) as StorageData;

      // Migration: v1 → v2 (add customHolidays)
      if (data.version === 1) {
        const lots = data.lots.map((lotData) => Lot.fromJSON(lotData as any));
        const customProtocols = data.customProtocols.map((pData) => Protocol.fromJSON(pData));
        return { lots, customProtocols, roundSuccessRates: data.roundSuccessRates, customHolidays: [] };
      }

      if (data.version !== VERSION) {
        console.warn(`Storage version mismatch: ${data.version} vs ${VERSION}`);
        return null;
      }

      const lots = data.lots.map((lotData) => Lot.fromJSON(lotData as any));
      const customProtocols = data.customProtocols.map((pData) => Protocol.fromJSON(pData));

      return {
        lots,
        customProtocols,
        roundSuccessRates: data.roundSuccessRates,
        customHolidays: data.customHolidays ?? [],
      };
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  getQuotaInfo(): { used: number; total: number; percentage: number } {
    try {
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key]!.length + key.length;
        }
      }
      const total = 5 * 1024 * 1024;
      const percentage = Math.round((used / total) * 100);
      return { used, total, percentage };
    } catch (error) {
      console.error('Failed to get quota info:', error);
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  hasSavedData(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const storage = new EstacaoStorage();
```

### Step 4: Update usePersistence.ts

In `src/hooks/usePersistence.ts`, add the import for `customHolidaysSignal` and `setCustomHolidays`:

```typescript
import { lotsSignal, setLots } from '@/state/signals/lots';
import { roundSuccessRatesSignal, setAllRoundSuccessRates } from '@/state/signals/success-rates';
import { customHolidaysSignal, setCustomHolidays } from '@/state/signals/conflicts';
import { DateOnly } from '@/domain/value-objects/DateOnly';
```

In the load effect, after `setLots(data.lots)`, add:

```typescript
      if (data.customHolidays && data.customHolidays.length > 0) {
        setCustomHolidays(
          data.customHolidays.map((h) => ({
            date: DateOnly.create(h.year, h.month, h.day),
            name: h.name,
          }))
        );
      }
```

In the save effect, replace `storage.save(lots, [], rates)` with:

```typescript
      const holidays = customHolidaysSignal.value.map((h) => ({
        year: h.date.year,
        month: h.date.month,
        day: h.date.day,
        name: h.name,
      }));
      storage.save(lots, [], rates, holidays);
```

Also add `customHolidaysSignal.value` to the dependency array of the save effect:

```typescript
  }, [lotsSignal.value, roundSuccessRatesSignal.value, customHolidaysSignal.value]);
```

### Step 5: Run tests + type-check

```bash
npm run type-check && npm test
```
Expected: All pass

### Step 6: Commit

```bash
git add src/services/persistence/storage.ts src/hooks/usePersistence.ts tests/services/persistence/storage-migration.test.ts
git commit -m "feat: persist customHolidays in storage with v1→v2 migration"
```

---

## Task 7: Update Optimization Engine for Holiday Penalties

**Files:**
- Modify: `src/domain/value-objects/OptimizationScenario.ts`
- Modify: `src/core/optimization/types.ts`
- Modify: `src/core/optimization/fitness-calculator.ts`
- Modify: `src/workers/optimizer.worker.ts`
- Modify: `src/services/optimization/optimizer-service.ts`
- Modify: `src/components/Forms/LotForm.tsx`

### Step 1: Add `holidayConflicts` to ScheduleObjectives

In `src/domain/value-objects/OptimizationScenario.ts`, update `ScheduleObjectives`:

```typescript
export interface ScheduleObjectives {
  sundaysRounds12: number;
  sundaysRounds34: number;
  overlapsRounds12: number;
  overlapsRounds34: number;
  totalCycleDays: number;
  intervalViolations: number;
  holidayConflicts: number;  // NEW
}
```

### Step 2: Add `holidayConflicts` weight to ScenarioWeights

In `src/core/optimization/types.ts`, update `ScenarioWeights`:

```typescript
export interface ScenarioWeights {
  intervalViolations: number;
  overlapsRounds12: number;
  sundaysRounds12: number;
  overlapsRounds34: number;
  sundaysRounds34: number;
  totalCycleDays: number;
  d0OffsetPenalty: number;
  gapChangePenalty: number;
  holidayConflicts: number;  // NEW
}
```

### Step 3: Update DEFAULT_WEIGHTS and SCENARIO_PROFILES in fitness-calculator.ts

In `src/core/optimization/fitness-calculator.ts`, add `holidayConflicts` to all weight objects:

```typescript
export const DEFAULT_WEIGHTS: ScenarioWeights = {
  intervalViolations: 5000,
  overlapsRounds12: 10000,
  sundaysRounds12: 1000,
  overlapsRounds34: 100,
  sundaysRounds34: 100,
  totalCycleDays: 1,
  d0OffsetPenalty: 0,
  gapChangePenalty: 0,
  holidayConflicts: 1000,   // same penalty as sundaysRounds12
};
```

Add `holidayConflicts: 1000` (or same value as the sunday equivalent) to each profile in `SCENARIO_PROFILES`. Also add `holidayConflicts: 0` default to any profile that shouldn't penalize it (all profiles should penalize, so use 1000 for all):

For each profile in `SCENARIO_PROFILES`, add `holidayConflicts: 1000` (for 'Sem Conflitos', use 5000 to match its sunday weight; for others use 1000).

Exact additions per profile:
- 'Sem Conflitos': `holidayConflicts: 2000`
- 'Ciclo Curto': `holidayConflicts: 500`
- 'Balanceado': `holidayConflicts: 1000`
- 'Conservador': `holidayConflicts: 1000`

### Step 4: Update calculateObjectives to accept and count holidays

In `src/core/optimization/fitness-calculator.ts`, update `calculateObjectives`:

Add import at top:
```typescript
import { Holiday } from '@/domain/value-objects/Holiday';
```

Update signature:
```typescript
export function calculateObjectives(
  lots: Lot[],
  holidays: readonly Holiday[] = []
): ScheduleObjectives {
```

After the existing Sunday/Overlap counting loops, add:

```typescript
  // Count holiday conflicts
  let holidayConflicts = 0;
  for (const hd of allDates) {
    if (holidays.some((h) => h.date.equals(hd.date))) {
      holidayConflicts++;
    }
  }
```

Update the return statement to include `holidayConflicts`:
```typescript
  return {
    sundaysRounds12,
    sundaysRounds34,
    overlapsRounds12,
    overlapsRounds34,
    totalCycleDays,
    intervalViolations,
    holidayConflicts,
  };
```

### Step 5: Update scalarizeObjectives and evaluateChromosome

In `scalarizeObjectives`, add holiday penalty term:

```typescript
  const penalty =
    obj.intervalViolations * weights.intervalViolations +
    obj.overlapsRounds12 * weights.overlapsRounds12 +
    obj.sundaysRounds12 * weights.sundaysRounds12 +
    obj.overlapsRounds34 * weights.overlapsRounds34 +
    obj.sundaysRounds34 * weights.sundaysRounds34 +
    obj.totalCycleDays * weights.totalCycleDays +
    (obj.holidayConflicts ?? 0) * weights.holidayConflicts;  // NEW
```

In `evaluateChromosome`, update signature and pass holidays to `calculateObjectives`:

```typescript
export function evaluateChromosome(
  chromosome: Chromosome,
  baseLots: Lot[],
  weights: ScenarioWeights = DEFAULT_WEIGHTS,
  holidays: readonly Holiday[] = []
): { fitness: number; objectives: ScheduleObjectives } {
```

Update the call to `calculateObjectives` inside `evaluateChromosome`:
```typescript
  const objectives = calculateObjectives(adjustedLots, holidays);
```

### Step 6: Update GeneticScheduler to accept and pass holidays

In `src/core/optimization/genetic-scheduler.ts`:

Add import:
```typescript
import { Holiday } from '@/domain/value-objects/Holiday';
```

Update constructor:
```typescript
  constructor(
    private readonly lots: Lot[],
    private readonly params: GeneticParams = DEFAULT_GA_PARAMS,
    private readonly holidays: readonly Holiday[] = []
  ) {}
```

Update `evaluatePopulation` to pass `this.holidays` to `evaluateChromosome`:
```typescript
  private evaluatePopulation(population: Chromosome[], weights: ScenarioWeights): void {
    for (const chromosome of population) {
      const { fitness, objectives } = evaluateChromosome(
        chromosome,
        this.lots,
        weights,
        this.holidays   // NEW
      );
      chromosome.fitness = fitness;
      chromosome.objectives = objectives;
    }
  }
```

### Step 7: Update worker to accept and pass holidays

Full new contents of `src/workers/optimizer.worker.ts`:

```typescript
import { Lot } from '@/domain/value-objects/Lot';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { expandNationalHolidays, Holiday } from '@/domain/value-objects/Holiday';
import { GeneticScheduler } from '@/core/optimization/genetic-scheduler';
import { GeneticParams, DEFAULT_GA_PARAMS } from '@/core/optimization/types';

interface CustomHolidayJSON {
  year: number;
  month: number;
  day: number;
  name: string;
}

interface WorkerMessage {
  lots: Parameters<typeof Lot.fromJSON>[0][];
  maxD0Adjustment?: number;
  timeLimitMs?: number;
  customHolidays?: CustomHolidayJSON[];
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  try {
    const {
      lots: lotsData,
      maxD0Adjustment = 15,
      timeLimitMs = 5000,
      customHolidays = [],
    } = e.data;

    const lots = lotsData.map((data) => Lot.fromJSON(data));

    // Reconstruct holidays for the years in this lot set
    const allDates = lots.flatMap((lot) => {
      // Approximate: use D0 year and D0 year + 1
      return [lot.d0.year, lot.d0.year + 1];
    });
    const years = [...new Set(allDates)];
    const nationalHolidays = expandNationalHolidays(years);
    const custom: Holiday[] = customHolidays.map((h) => ({
      date: DateOnly.create(h.year, h.month, h.day),
      name: h.name,
      isCustom: true,
    }));
    const holidays: Holiday[] = [...nationalHolidays, ...custom];

    const params: GeneticParams = {
      ...DEFAULT_GA_PARAMS,
      maxD0Adjustment,
      timeLimitMs,
    };

    const scheduler = new GeneticScheduler(lots, params, holidays);
    const { scenarios, totalCombinations } = await scheduler.optimize();

    const serializedScenarios = scenarios.map((scenario) => ({
      name: scenario.name,
      description: scenario.description,
      lots: scenario.lots.map((lot) => lot.toJSON()),
      objectives: scenario.objectives,
      fitness: scenario.fitness,
    }));

    self.postMessage({ success: true, scenarios: serializedScenarios, totalCombinations });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
};
```

### Step 8: Update OptimizerService to accept and pass holidays

In `src/services/optimization/optimizer-service.ts`:

Add import:
```typescript
import { Holiday } from '@/domain/value-objects/Holiday';
```

Update `optimizeSchedule` signature:
```typescript
  async optimizeSchedule(
    lots: Lot[],
    maxD0Adjustment: number = 15,
    timeLimitMs: number = 30000,
    holidays: readonly Holiday[] = []
  ): Promise<{ scenarios: OptimizationScenario[]; totalCombinations: number }> {
```

Update `postMessage` call to include holidays:
```typescript
      this.worker.postMessage({
        lots: lots.map((lot) => lot.toJSON()),
        maxD0Adjustment,
        timeLimitMs,
        customHolidays: holidays
          .filter((h) => h.isCustom)
          .map((h) => ({
            year: h.date.year,
            month: h.date.month,
            day: h.date.day,
            name: h.name,
          })),
      });
```
Note: national holidays are reconstructed in the worker by year range; only custom holidays need serialization.

### Step 9: Update LotForm to pass holidays

In `src/components/Forms/LotForm.tsx`, add import:
```typescript
import { allHolidaysSignal } from '@/state/signals/conflicts';
```

Update the `optimizeSchedule` call:
```typescript
      const { scenarios, totalCombinations } = await optimizerService.optimizeSchedule(
        lots,
        maxD0Adjustment,
        30000,
        allHolidaysSignal.value
      );
```

### Step 10: Run type-check and tests

```bash
npm run type-check && npm test
```
Expected: All pass

### Step 11: Commit

```bash
git add src/domain/value-objects/OptimizationScenario.ts \
        src/core/optimization/types.ts \
        src/core/optimization/fitness-calculator.ts \
        src/core/optimization/genetic-scheduler.ts \
        src/workers/optimizer.worker.ts \
        src/services/optimization/optimizer-service.ts \
        src/components/Forms/LotForm.tsx
git commit -m "feat: add holiday penalty to optimization engine"
```

---

## Task 8: HolidaysModal Component

**Files:**
- Create: `src/components/HolidaysModal/HolidaysModal.tsx`

### Step 1: Create the modal component

```tsx
// src/components/HolidaysModal/HolidaysModal.tsx
import { useState } from 'preact/hooks';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { NATIONAL_HOLIDAYS } from '@/domain/value-objects/Holiday';
import { customHolidaysSignal, setCustomHolidays } from '@/state/signals/conflicts';

interface HolidaysModalProps {
  onClose: () => void;
}

export function HolidaysModal({ onClose }: HolidaysModalProps) {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const customHolidays = customHolidaysSignal.value;

  const handleAdd = () => {
    if (!newDate || !newName.trim()) return;
    const parts = newDate.split('-');
    if (parts.length !== 3) return;
    const [yearStr, monthStr, dayStr] = parts;
    const year = parseInt(yearStr!, 10);
    const month = parseInt(monthStr!, 10);
    const day = parseInt(dayStr!, 10);
    if (!year || !month || !day) return;
    try {
      const date = DateOnly.create(year, month, day);
      if (customHolidays.some((h) => h.date.equals(date))) return; // no duplicates
      setCustomHolidays([...customHolidays, { date, name: newName.trim() }]);
      setNewDate('');
      setNewName('');
    } catch (e) {
      console.error('Data inválida', e);
    }
  };

  const handleRemove = (index: number) => {
    setCustomHolidays(customHolidays.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div
        class="modal"
        style={{ maxWidth: '480px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.125rem' }}>Feriados</h2>

        {/* Seção: Nacionais */}
        <h3 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
          Feriados Nacionais (Brasil)
        </h3>
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: 'var(--spacing-md)' }}>
          {NATIONAL_HOLIDAYS.map((h) => (
            <li
              key={h.name}
              style={{
                padding: '4px 0',
                borderBottom: '1px solid var(--color-border)',
                fontSize: '0.875rem',
              }}
            >
              <span style={{ color: 'var(--color-conflict-holiday)', fontWeight: 600 }}>
                {String(h.day).padStart(2, '0')}/{String(h.month).padStart(2, '0')}
              </span>
              {' · '}{h.name}
            </li>
          ))}
        </ul>

        {/* Seção: Personalizados */}
        <h3 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
          Feriados Personalizados
        </h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-sm)' }}>
          <input
            type="date"
            value={newDate}
            onInput={(e) => setNewDate((e.target as HTMLInputElement).value)}
            style={{ flex: '0 0 auto' }}
          />
          <input
            type="text"
            placeholder="Nome do feriado"
            value={newName}
            onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          <button type="button" class="btn-primary" onClick={handleAdd}>
            +
          </button>
        </div>

        {customHolidays.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Nenhum feriado personalizado adicionado.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {customHolidays.map((h, i) => (
              <li
                key={h.date.toISOString()}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                }}
              >
                <span>
                  <span style={{ color: 'var(--color-conflict-holiday)', fontWeight: 600 }}>
                    {String(h.date.day).padStart(2, '0')}/{String(h.date.month).padStart(2, '0')}/{h.date.year}
                  </span>
                  {' · '}{h.name}
                </span>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-danger)',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    fontSize: '0.75rem',
                  }}
                  onClick={() => handleRemove(i)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'right' }}>
          <button type="button" class="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Run type-check

```bash
npm run type-check
```

### Step 3: Commit

```bash
git add src/components/HolidaysModal/HolidaysModal.tsx
git commit -m "feat: add HolidaysModal component for managing national and custom holidays"
```

---

## Task 9: Update app.tsx — Button, Badge, Legend

**Files:**
- Modify: `src/app.tsx`

### Step 1: Apply all changes to app.tsx

Add imports at top:
```typescript
import { HolidaysModal } from '@/components/HolidaysModal/HolidaysModal';
```

Add state:
```typescript
  const [showHolidaysModal, setShowHolidaysModal] = useState(false);
```

**Update conflict summary section** — add holiday badge after overlaps badge:

```tsx
                  {conflictSummary.holidays > 0 && (
                    <span class="conflict-badge conflict-badge-holiday">
                      {conflictSummary.holidays} feriado{conflictSummary.holidays > 1 ? 's' : ''}
                    </span>
                  )}
```

**Add "Feriados" button** next to the conflict summary div (inside the header flex row):

```tsx
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              {/* existing conflict-summary div */}
              <button
                type="button"
                class="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={() => setShowHolidaysModal(true)}
              >
                Feriados
              </button>
            </div>
```

**Update footer legend** — add holiday legend item:

```tsx
          <div class="conflict-legend-item conflict-legend-holiday">
            <span class="conflict-legend-color"></span>
            <span>Feriado</span>
          </div>
```

**Render modal** — just before the closing `</div>` of the app root:

```tsx
      {showHolidaysModal && (
        <HolidaysModal onClose={() => setShowHolidaysModal(false)} />
      )}
```

### Step 2: Run type-check and tests

```bash
npm run type-check && npm test
```
Expected: All pass

### Step 3: Commit

```bash
git add src/app.tsx
git commit -m "feat: add holidays button, badge, and legend to app header and footer"
```

---

## Final Verification

### Step 1: Full type-check + test run

```bash
npm run type-check && npm test
```
Expected: All pass, no TypeScript errors.

### Step 2: Build check

```bash
npm run build
```
Expected: Build succeeds with no errors.

### Step 3: Final commit (if any unstaged changes)

```bash
git status
```
If clean: done. If there are unstaged changes, stage and commit them.

---

## Summary of Commits

1. `feat: add Holiday value object with NATIONAL_HOLIDAYS constant`
2. `feat: add 'holiday' to ConflictType and Conflict.holiday() factory`
3. `feat: add detectHolidayConflicts and extend getConflictTypeForCell for holidays`
4. `feat: add customHolidaysSignal, allHolidaysSignal; wire holidays into conflict detection`
5. `feat: add purple holiday conflict styles`
6. `feat: persist customHolidays in storage with v1→v2 migration`
7. `feat: add holiday penalty to optimization engine`
8. `feat: add HolidaysModal component`
9. `feat: add holidays button, badge, and legend to app header and footer`
