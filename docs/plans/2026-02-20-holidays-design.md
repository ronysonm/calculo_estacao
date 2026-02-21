# Design: Feriados como Alerta de Conflito

**Data:** 2026-02-20
**Status:** Aprovado

## Contexto

Adicionar feriados como um novo tipo de alerta na calculadora IATF. Dias de manejo que caem em feriados devem ser destacados em roxo na tabela e também devem ser evitados pelo motor de otimização automática.

## Decisões

- **Comportamento:** Alerta visual (roxo) + penalidade na otimização (como domingos)
- **Feriados pré-definidos:** 8 feriados nacionais fixos brasileiros (sem feriados móveis)
- **Gestão:** Modal separado com seção nacional (toggle) e personalizada (CRUD)
- **Persistência:** Por estação, salvo junto com os lotes no storage existente

## Modelo de Dados

### Constante `NATIONAL_HOLIDAYS`

```typescript
// src/domain/value-objects/Holiday.ts
export interface NationalHolidayDef {
  month: number;  // 1-12
  day: number;
  name: string;
}

export interface Holiday {
  date: DateOnly;
  name: string;
  isCustom: boolean;
}

export const NATIONAL_HOLIDAYS: NationalHolidayDef[] = [
  { month: 1,  day: 1,  name: "Confraternização Universal" },
  { month: 4,  day: 21, name: "Tiradentes" },
  { month: 5,  day: 1,  name: "Dia do Trabalho" },
  { month: 9,  day: 7,  name: "Independência do Brasil" },
  { month: 10, day: 12, name: "N. Sra. Aparecida" },
  { month: 11, day: 2,  name: "Finados" },
  { month: 11, day: 15, name: "Proclamação da República" },
  { month: 12, day: 25, name: "Natal" },
];
```

### Schema de Persistência (adição ao estado existente)

```typescript
// Adicionado a AppState em src/services/persistence.ts
interface AppState {
  lots: Lot[];
  customHolidays: Array<{
    year: number;
    month: number;
    day: number;
    name: string;
  }>;
  // disabledNationalHolidays?: Array<{ month: number; day: number }>;  // futuro
}
```

## Fluxo de Estado

```
NATIONAL_HOLIDAYS (constante) ──┐
                                 ├─→ allHolidaysSignal (computed)
customHolidaysSignal (signal) ──┘        │
                                         ↓
                              detectHolidayConflicts()
                                         │
                                         ↓
                              conflictsSignal (computed, já existente)
                                         │
                              ┌──────────┴──────────┐
                              ↓                     ↓
                     conflictSummarySignal      getConflictTypeForCell()
                     (+ holidays count)         (+ 'holiday' case)
```

### Novos Signals (`src/state/signals/conflicts.ts`)

```typescript
export const customHolidaysSignal = signal<CustomHoliday[]>([]);

export const allHolidaysSignal = computed<Holiday[]>(() => {
  const years = getYearsInCurrentRange();  // deriva do cycleStartSignal
  const national = expandNationalHolidays(NATIONAL_HOLIDAYS, years);
  return [...national, ...customHolidaysSignal.value];
});
```

### Extensão de `ConflictType`

```typescript
// src/domain/value-objects/Conflict.ts
export type ConflictType = 'sunday' | 'overlap' | 'holiday';
```

Adicionar factory method:
```typescript
static holiday(handlingDate: HandlingDate, holidayName: string): Conflict
```

### Detector (`src/core/conflict/detector.ts`)

Nova função:
```typescript
export function detectHolidayConflicts(
  handlingDates: readonly HandlingDate[],
  holidays: readonly Holiday[]
): Conflict[]
```

Hierarquia de severidade em `getConflictTypeForCell()`:
- `overlap` ou `sunday` presente → `'multiple'` (vermelho, como hoje)
- Somente `holiday` → `'holiday'` (roxo)

### `conflictSummarySignal`

```typescript
// Adicionar campo ao tipo retornado
{ total: number; sundays: number; overlaps: number; holidays: number }
```

## UI

### Modal `HolidaysModal`

**Localização:** `src/components/HolidaysModal/HolidaysModal.tsx`

**Estrutura:**
```
┌─────────────────────────────────────────────────────┐
│  Feriados                                       [X]  │
├─────────────────────────────────────────────────────┤
│  Feriados Nacionais (Brasil)                         │
│  ─────────────────────────────────────────────────  │
│  ☑ 01/01 · Confraternização Universal                │
│  ☑ 21/04 · Tiradentes                                │
│  ☑ 01/05 · Dia do Trabalho                           │
│  ...                                                 │
├─────────────────────────────────────────────────────┤
│  Feriados Personalizados                             │
│  ─────────────────────────────────────────────────  │
│  [Data: ____/____/____] [Nome: ____________] [+]     │
│                                                      │
│  [lista de personalizados com botão remover]         │
└─────────────────────────────────────────────────────┘
```

**Abertura:** Botão "Feriados" no header da aplicação.

### Estilo

```css
/* src/styles/global.css */
--color-conflict-holiday: #9b59b6;

/* src/styles/table.css */
.conflict-holiday {
  background-color: rgba(155, 89, 182, 0.15) !important;
  color: #7d3c98;
}

/* src/styles/conflicts.css */
.conflict-badge-holiday {
  background-color: var(--color-conflict-holiday);
  color: white;
}
```

### Header (resumo de conflitos)

Badge adicional em roxo:
```
[N conflito(s): X domingo(s) | Y sobreposição | Z feriado(s)]
```

### Legenda no rodapé

Novo item:
```
■ Domingo   ■ Sobreposição   ■ Feriado
```

## Otimização

Feriados passados como parâmetro adicional para `optimizeWithHybridEngine()`:

```typescript
interface OptimizationInput {
  // ... existente
  holidays: readonly Holiday[];  // novo
}
```

Penalidade equivalente à de domingo — manejo em feriado conta como conflito a evitar no cálculo do fitness/custo.

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/domain/value-objects/Conflict.ts` | Adicionar `'holiday'` ao `ConflictType`, factory `holiday()` |
| `src/domain/value-objects/Holiday.ts` | **Novo** — `NationalHolidayDef`, `Holiday`, `NATIONAL_HOLIDAYS`, `CustomHoliday` |
| `src/core/conflict/detector.ts` | Adicionar `detectHolidayConflicts()`, atualizar `getConflictTypeForCell()` |
| `src/state/signals/conflicts.ts` | Adicionar `customHolidaysSignal`, `allHolidaysSignal`, atualizar summary |
| `src/services/persistence.ts` | Adicionar `customHolidays` ao schema com migração |
| `src/core/optimization/` | Passar holidays como input, adicionar penalidade |
| `src/workers/optimizer.worker.ts` | Propagar holidays ao engine |
| `src/components/HolidaysModal/` | **Novo** — modal de gerenciamento |
| `src/app.tsx` | Adicionar botão, badge e legenda |
| `src/styles/global.css` | Adicionar `--color-conflict-holiday` |
| `src/styles/table.css` | Adicionar `.conflict-holiday` |
| `src/styles/conflicts.css` | Adicionar `.conflict-badge-holiday` |

## Testes

- `detectHolidayConflicts()` — datas nacionais, datas personalizadas, sem match
- `getConflictTypeForCell()` — novo caso `'holiday'`, combos existentes não afetados
- `allHolidaysSignal` — expansão correta dos anos, deduplicação
- Persistência — migração de schema sem dados existentes quebrados
- Modal — adicionar/remover feriados personalizados
