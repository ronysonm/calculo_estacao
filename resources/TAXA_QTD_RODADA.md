# TAXA_QTD_RODADA.md - Quantidade de Animais por Lote + Taxa de Sucesso por Rodada

## Resumo

Adicionar dois novos parametros ao planejamento:

1. **Quantidade de animais por lote** (`animalCount`) - propriedade do `Lot`, padrao 100, editavel no modal e no formulario de adicao.
2. **Taxa de sucesso por rodada** (`roundSuccessRates`) - signal global, padrao `[50, 20, 20, 10]`, editavel na barra de rodadas (compartilhada entre todos os lotes).

**Calculo de animais por rodada:**
- R1: `animalCount` (todos)
- R2: `animalCount - floor(R1 * taxa[0] / 100)`
- R3: `R2 - floor(R2 * taxa[1] / 100)`
- R4: `R3 - floor(R3 * taxa[2] / 100)`

Exemplo: 100 animais, taxas [50, 20, 20, 10]:
- R1: 100, R2: 50, R3: 40, R4: 32

---

## 1. `src/domain/constants.ts`

**Adicionar** duas novas constantes ao final do arquivo:

```typescript
/** Quantidade padrao de animais por lote */
export const DEFAULT_ANIMAL_COUNT = 100;

/** Taxas de sucesso padrao por rodada (%) - [R1, R2, R3, R4] */
export const DEFAULT_ROUND_SUCCESS_RATES: readonly number[] = [50, 20, 20, 10] as const;
```

---

## 2. `src/domain/value-objects/Lot.ts`

### 2.1. Adicionar `animalCount` ao constructor

```typescript
export class Lot {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly d0: DateOnly,
    public readonly protocol: Protocol,
    public readonly roundGaps: readonly number[] = [22, 22, 22],
    public readonly animalCount: number = 100
  ) {
    // Validation
    if (name.trim().length === 0) {
      throw new Error('Lot name cannot be empty');
    }
    for (const gap of roundGaps) {
      if (gap < 1) {
        throw new Error('Round gap must be at least 1 day');
      }
    }
    if (animalCount < 1) {
      throw new Error('Animal count must be at least 1');
    }
  }
```

### 2.2. Atualizar `create()`

```typescript
  static create(
    id: string,
    name: string,
    d0: DateOnly,
    protocol: Protocol,
    roundGaps: readonly number[] = [22, 22, 22],
    animalCount: number = 100
  ): Lot {
    return new Lot(id, name, d0, protocol, roundGaps, animalCount);
  }
```

### 2.3. Atualizar todos os metodos `with*()` para propagar `animalCount`

```typescript
  withD0(newD0: DateOnly): Lot {
    return new Lot(this.id, this.name, newD0, this.protocol, this.roundGaps, this.animalCount);
  }

  withProtocol(newProtocol: Protocol): Lot {
    return new Lot(this.id, this.name, this.d0, newProtocol, this.roundGaps, this.animalCount);
  }

  withName(newName: string): Lot {
    return new Lot(this.id, newName, this.d0, this.protocol, this.roundGaps, this.animalCount);
  }

  withRoundGap(index: number, newGap: number): Lot {
    const newGaps = [...this.roundGaps];
    newGaps[index] = newGap;
    return new Lot(this.id, this.name, this.d0, this.protocol, newGaps, this.animalCount);
  }
```

### 2.4. Adicionar `withAnimalCount()`

```typescript
  /**
   * Create a new lot with updated animal count (immutable update)
   */
  withAnimalCount(newCount: number): Lot {
    return new Lot(this.id, this.name, this.d0, this.protocol, this.roundGaps, newCount);
  }
```

### 2.5. Adicionar `getAnimalsPerRound()`

```typescript
  /**
   * Calculate the number of animals in each round based on success rates.
   *
   * Each round's remaining animals = previous round animals - floor(previous * rate/100).
   *
   * @param successRates - Success rate (%) for each round [R1, R2, R3, R4]
   * @param rounds - Number of rounds (default 4)
   * @returns Array with animal count per round
   */
  getAnimalsPerRound(successRates: readonly number[], rounds: number = 4): number[] {
    const result: number[] = [this.animalCount];
    for (let i = 1; i < rounds; i++) {
      const prev = result[i - 1]!;
      const rate = successRates[i - 1] ?? 0;
      const successful = Math.floor(prev * rate / 100);
      result.push(prev - successful);
    }
    return result;
  }
```

### 2.6. Atualizar `equals()`

```typescript
  equals(other: Lot): boolean {
    return (
      this.id === other.id &&
      this.name === other.name &&
      this.d0.equals(other.d0) &&
      this.protocol.equals(other.protocol) &&
      this.roundGaps.length === other.roundGaps.length &&
      this.roundGaps.every((g, i) => g === other.roundGaps[i]) &&
      this.animalCount === other.animalCount
    );
  }
```

### 2.7. Atualizar `toJSON()`

```typescript
  toJSON(): {
    id: string;
    name: string;
    d0: { year: number; month: number; day: number };
    protocol: {
      id: string;
      name: string;
      intervals: readonly number[];
      type: string;
    };
    roundGaps: readonly number[];
    animalCount: number;
  } {
    return {
      id: this.id,
      name: this.name,
      d0: this.d0.toJSON(),
      protocol: this.protocol.toJSON(),
      roundGaps: this.roundGaps,
      animalCount: this.animalCount,
    };
  }
```

### 2.8. Atualizar `fromJSON()`

```typescript
  static fromJSON(json: {
    id: string;
    name: string;
    d0: { year: number; month: number; day: number };
    protocol: {
      id: string;
      name: string;
      intervals: readonly number[];
      type: 'D0-D7-D9' | 'D0-D8-D10' | 'D0-D9-D11' | 'custom';
    };
    roundGaps?: readonly number[];
    roundInterval?: number;
    animalCount?: number;
  }): Lot {
    // Handle migration from old roundInterval to new roundGaps
    let gaps: readonly number[];
    if (json.roundGaps) {
      gaps = json.roundGaps;
    } else if (json.roundInterval !== undefined) {
      gaps = [json.roundInterval, json.roundInterval, json.roundInterval];
    } else {
      gaps = [22, 22, 22];
    }

    return new Lot(
      json.id,
      json.name,
      DateOnly.fromJSON(json.d0),
      Protocol.fromJSON(json.protocol),
      gaps,
      json.animalCount ?? 100
    );
  }
```

---

## 3. `src/state/signals/success-rates.ts` (NOVO ARQUIVO)

```typescript
/**
 * Success Rates State - Global round success rates
 *
 * Shared across all lots. Controls how many animals proceed to the next round.
 * Rate[i] = percentage of animals that succeed in round i+1 (don't need another round).
 */

import { signal } from '@preact/signals';
import { DEFAULT_ROUND_SUCCESS_RATES } from '@/domain/constants';

/**
 * Global success rates signal (one array for all lots)
 */
export const roundSuccessRatesSignal = signal<readonly number[]>([...DEFAULT_ROUND_SUCCESS_RATES]);

/**
 * Update a single round's success rate
 * @param roundIndex - Round index (0-3)
 * @param rate - New rate (0-100)
 */
export function setRoundSuccessRate(roundIndex: number, rate: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(rate)));
  const newRates = [...roundSuccessRatesSignal.value];
  newRates[roundIndex] = clamped;
  roundSuccessRatesSignal.value = newRates;
}

/**
 * Replace all success rates (for loading from storage)
 */
export function setAllRoundSuccessRates(rates: readonly number[]): void {
  roundSuccessRatesSignal.value = rates.map((r) => Math.max(0, Math.min(100, Math.round(r))));
}

/**
 * Reset to default rates
 */
export function resetRoundSuccessRates(): void {
  roundSuccessRatesSignal.value = [...DEFAULT_ROUND_SUCCESS_RATES];
}
```

---

## 4. `src/state/signals/lots.ts`

### 4.1. Importar `DEFAULT_ANIMAL_COUNT`

```typescript
import { DEFAULT_LOT_NAMES, DEFAULT_PROTOCOL, DEFAULT_ROUND_GAPS, DEFAULT_ANIMAL_COUNT } from '@/domain/constants';
```

### 4.2. Atualizar `addLot()` para receber `animalCount`

```typescript
/**
 * Add a new lot
 */
export function addLot(name: string, d0: DateOnly, protocol: Protocol, animalCount: number = DEFAULT_ANIMAL_COUNT): void {
  const newId = `lot-${Date.now()}`;
  const newLot = Lot.create(newId, name, d0, protocol, DEFAULT_ROUND_GAPS, animalCount);

  lotsSignal.value = [...lotsSignal.value, newLot];
}
```

### 4.3. Adicionar `changeLotAnimalCount()`

```typescript
/**
 * Change lot animal count
 */
export function changeLotAnimalCount(lotId: string, newCount: number): void {
  lotsSignal.value = lotsSignal.value.map((lot) =>
    lot.id === lotId ? lot.withAnimalCount(newCount) : lot
  );
}
```

---

## 5. `src/services/persistence/storage.ts`

### 5.1. Atualizar `StorageData` interface

```typescript
interface StorageData {
  version: number;
  lots: ReturnType<Lot['toJSON']>[];
  customProtocols: ReturnType<Protocol['toJSON']>[];
  roundSuccessRates?: readonly number[];
  savedAt: string;
}
```

### 5.2. Atualizar `save()` para receber taxas

```typescript
  save(lots: Lot[], customProtocols: Protocol[] = [], roundSuccessRates?: readonly number[]): boolean {
    try {
      const data: StorageData = {
        version: VERSION,
        lots: lots.map((lot) => lot.toJSON()),
        customProtocols: customProtocols.map((p) => p.toJSON()),
        roundSuccessRates,
        savedAt: new Date().toISOString(),
      };

      // ... resto igual
```

### 5.3. Atualizar `load()` para retornar taxas

```typescript
  load(): { lots: Lot[]; customProtocols: Protocol[]; roundSuccessRates?: readonly number[] } | null {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return null;

      const data = JSON.parse(json) as StorageData;

      if (data.version !== VERSION) {
        console.warn(`Storage version mismatch: ${data.version} vs ${VERSION}`);
        return null;
      }

      const lots = data.lots.map((lotData) => Lot.fromJSON(lotData as any));
      const customProtocols = data.customProtocols.map((pData) =>
        Protocol.fromJSON(pData)
      );

      return { lots, customProtocols, roundSuccessRates: data.roundSuccessRates };
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }
```

---

## 6. `src/hooks/usePersistence.ts`

### 6.1. Importar signal de taxas

```typescript
import { roundSuccessRatesSignal, setAllRoundSuccessRates } from '@/state/signals/success-rates';
```

### 6.2. Atualizar load para carregar taxas

No `useEffect` de load, adicionar:

```typescript
    const data = storage.load();
    if (data) {
      setLots(data.lots);
      if (data.roundSuccessRates) {
        setAllRoundSuccessRates(data.roundSuccessRates);
      }
      console.log(`Loaded ${data.lots.length} lots from localStorage`);
    }
```

### 6.3. Atualizar save para incluir taxas

No `useEffect` de save, adicionar `roundSuccessRatesSignal.value` como dependencia e passar na chamada:

```typescript
  // Save on lots or success rates change (debounced 1 second)
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (!storage.isAvailable()) return;

    const debouncedSave = debounce(() => {
      const lots = lotsSignal.value;
      const rates = roundSuccessRatesSignal.value;
      storage.save(lots, [], rates);

      // ... resto da checagem de quota igual
    }, 1000);

    debouncedSave();
  }, [lotsSignal.value, roundSuccessRatesSignal.value]);
```

---

## 7. `src/components/Forms/LotForm.tsx`

### 7.1. Importar constante

```typescript
import { DEFAULT_ANIMAL_COUNT } from '@/domain/constants';
```

### 7.2. Adicionar estado local para `animalCount`

Dentro de `LotForm()`, adicionar:

```typescript
const [animalCount, setAnimalCount] = useState(DEFAULT_ANIMAL_COUNT);
```

### 7.3. Adicionar campo no formulario (entre "Protocolo" e o botao "Adicionar Lote")

```tsx
        <div>
          <label htmlFor="animalCount">Quantidade de Animais</label>
          <input
            id="animalCount"
            type="number"
            min="1"
            max="10000"
            value={animalCount}
            onInput={(e) => setAnimalCount(Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1))}
          />
        </div>
```

### 7.4. Atualizar `handleSubmit` para passar `animalCount`

```typescript
    addLot(lotName, d0, protocol, animalCount);

    // Reset form
    setLotName('');
    setD0Date(addDaysToDateOnly(d0, 1).toISOString());
    setAnimalCount(DEFAULT_ANIMAL_COUNT);
```

---

## 8. `src/components/Table/CalculationTable.tsx`

### 8.1. Novos imports

```typescript
import { changeLotAnimalCount } from '@/state/signals/lots';
import { roundSuccessRatesSignal, setRoundSuccessRate } from '@/state/signals/success-rates';
import { DEFAULT_ANIMAL_COUNT } from '@/domain/constants';
```

### 8.2. Barra de rodadas: adicionar taxa de sucesso editavel

Na funcao `CalculationTable()`, adicionar leitura do signal:

```typescript
export function CalculationTable() {
  const lots = lotsSignal.value;
  const allHandlingDates = handlingDatesSignal.value;
  const successRates = roundSuccessRatesSignal.value;
```

Modificar a barra de rodadas para incluir a taxa de sucesso abaixo do nome da rodada:

```tsx
      <div class="round-headers-bar">
        <div class="round-headers-spacer"></div>
        {Array.from({ length: DEFAULT_ROUNDS }).map((_, roundIdx) => (
          <>
            <div key={`rnd-${roundIdx}`} class="round-header-label">
              <span>{ROUND_NAMES[roundIdx]}</span>
              <div class="success-rate-control">
                <label class="success-rate-label">Taxa:</label>
                <input
                  type="number"
                  class="success-rate-input"
                  min="0"
                  max="100"
                  value={successRates[roundIdx] ?? 0}
                  onInput={(e) => {
                    const val = parseInt((e.target as HTMLInputElement).value) || 0;
                    setRoundSuccessRate(roundIdx, val);
                  }}
                />
                <span class="success-rate-percent">%</span>
              </div>
            </div>
            {roundIdx < DEFAULT_ROUNDS - 1 && (
              <div class="round-header-gap-spacer"></div>
            )}
          </>
        ))}
      </div>
```

### 8.3. LotBlock: passar `successRates` como prop

```typescript
function LotBlock({
  lot,
  handlingDates,
  allHandlingDates,
  cycleStart,
  successRates,
}: {
  lot: Lot;
  handlingDates: HandlingDate[];
  allHandlingDates: HandlingDate[];
  cycleStart: DateOnly;
  successRates: readonly number[];
}) {
```

E na chamada do `LotBlock` dentro de `CalculationTable`:

```tsx
            <LotBlock
              key={lot.id}
              lot={lot}
              handlingDates={lotHandlingDates}
              allHandlingDates={allHandlingDates}
              cycleStart={cycleStart}
              successRates={successRates}
            />
```

### 8.4. `rowSpan` de 4 para 5

Na Row 1 (dia-row), alterar o `lot-name-cell`:

```tsx
<td class="lot-name-cell" rowSpan={5}>
```

Na Row 1 (dia-row), alterar o `gap-cell`:

```tsx
<td class="gap-cell gap-buttons-cell" rowSpan={5}>
```

### 8.5. Adicionar Row 5: "Qtd. Animais" (apos a `paricao-row`)

Dentro do `LotBlock`, calcular animais por rodada:

```typescript
  const animalsPerRound = lot.getAnimalsPerRound(successRates, DEFAULT_ROUNDS);
```

Nova row apos a `paricao-row` (antes do `</tbody>`):

```tsx
          {/* Row 5: Qtd. Animais */}
          <tr class="animais-row">
            <td class="row-label-cell row-label-bottom">Qtd. Animais</td>
            {Array.from({ length: DEFAULT_ROUNDS }).map((_, roundIdx) => {
              const count = animalsPerRound[roundIdx] ?? 0;
              return (
                <>
                  {protocolDays.map((_pd, pdIdx) => {
                    const isFirst = pdIdx === 0;
                    return (
                      <td
                        key={`animais-${roundIdx}-${pdIdx}`}
                        class={`data-cell animais-cell${isFirst ? ' animais-count-cell' : ''}`}
                      >
                        {isFirst ? count : ''}
                      </td>
                    );
                  })}
                </>
              );
            })}
          </tr>
```

### 8.6. Modal de edicao: adicionar campo `animalCount`

Dentro do `LotBlock`, adicionar estado local para edicao:

```typescript
  const [editAnimalCount, setEditAnimalCount] = useState(100);
```

No `openEditModal`, adicionar:

```typescript
    setEditAnimalCount(lot.animalCount);
```

No `handleSave`, adicionar (antes de `setIsEditModalOpen(false)`):

```typescript
    if (editAnimalCount !== lot.animalCount) {
      changeLotAnimalCount(lot.id, editAnimalCount);
    }
```

No JSX do modal, adicionar campo (apos o campo de protocolo, antes dos botoes):

```tsx
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600, fontSize: '0.875rem' }}>
                Quantidade de animais
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                style={{ width: '100%', padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                value={editAnimalCount}
                onInput={(e) => setEditAnimalCount(Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1))}
              />
            </div>
```

---

## 9. `src/styles/table.css`

### 9.1. Estilos para taxa de sucesso na barra de rodadas

```css
/* ============ Success Rate Control (in round header) ============ */
.success-rate-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  margin-top: 2px;
}

.success-rate-label {
  font-size: 0.6875rem;
  font-weight: 400;
  color: var(--color-text-secondary);
}

.success-rate-input {
  width: 42px;
  padding: 1px 3px;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: white;
}

.success-rate-input:focus {
  outline: none;
  border-color: #00B0F0;
  box-shadow: 0 0 0 1px #00B0F0;
}

.success-rate-percent {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}
```

### 9.2. Estilos para a linha de quantidade de animais

```css
/* ============ Animais Row ============ */
.animais-cell {
  font-size: 0.75rem;
  color: #2563eb;
  border-bottom: 0.5px solid var(--color-border);
}

.animais-count-cell {
  font-weight: 700;
  background-color: rgba(37, 99, 235, 0.06);
}
```

### 9.3. Atualizar print media query

Adicionar ao bloco `@media print`:

```css
  .success-rate-input {
    border: none;
    background: transparent;
  }
```

---

## 10. `src/services/export/pdf-generator.ts`

### 10.1. Importar signal de taxas

```typescript
import { DEFAULT_ROUND_SUCCESS_RATES } from '@/domain/constants';
```

### 10.2. Atualizar assinatura de `generatePDF()`

```typescript
export function generatePDF(
  lots: Lot[],
  handlingDates: HandlingDate[],
  cycleStart?: DateOnly | null,
  roundSuccessRates?: readonly number[]
): void {
```

Dentro da funcao, definir taxas efetivas:

```typescript
  const effectiveRates = roundSuccessRates ?? DEFAULT_ROUND_SUCCESS_RATES;
```

### 10.3. `rowSpan` de 4 para 5

No `diaRow` (lot name cell), alterar `rowSpan: 4` para `rowSpan: 5`.

No `diaRow` (gap column), alterar `rowSpan: 4` para `rowSpan: 5`.

### 10.4. Adicionar Row 5 (animais) apos `paricaoRow`

```typescript
    // Row 5: Qtd. Animais
    const ANIMAIS_TEXT_COLOR: [number, number, number] = [37, 99, 235];
    const animalsPerRound = lot.getAnimalsPerRound(effectiveRates, DEFAULT_ROUNDS);
    const animaisRow: any[] = [
      {
        content: 'Qtd. Animais',
        styles: {
          fillColor: LABEL_BG,
          fontSize: 7,
          halign: 'center',
          fontStyle: 'bold',
          textColor: ANIMAIS_TEXT_COLOR,
        },
      },
    ];
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      const count = animalsPerRound[ri] ?? 0;
      for (let pdIdx = 0; pdIdx < pdCount; pdIdx++) {
        const isFirst = pdIdx === 0;
        animaisRow.push({
          content: isFirst ? String(count) : '',
          styles: {
            halign: 'center',
            fontSize: 8,
            fontStyle: isFirst ? 'bold' : 'normal',
            textColor: isFirst ? ANIMAIS_TEXT_COLOR : [200, 200, 200] as [number, number, number],
            fillColor: isFirst ? [237, 243, 255] as [number, number, number] : WHITE,
          },
        });
      }
      // Gap columns handled by rowSpan from diaRow
    }
```

### 10.5. Atualizar `body` do `autoTable`

```typescript
      body: [diaRow, dataRow, cicloRow, paricaoRow, animaisRow],
```

### 10.6. Atualizar `pageBreak` check

Alterar o check de espaco de ~30mm para ~36mm (5 rows):

```typescript
    if (startY > pageHeight - 40) {
```

---

## 11. `src/services/export/excel-generator.ts`

### 11.1. Importar constantes de taxas

```typescript
import { DEFAULT_ROUNDS, ROUND_NAMES, GESTACAO_DIAS, DEFAULT_ROUND_SUCCESS_RATES } from '@/domain/constants';
```

### 11.2. Atualizar assinatura de `generateExcel()`

```typescript
export async function generateExcel(
  lots: Lot[],
  handlingDates: HandlingDate[],
  roundSuccessRates?: readonly number[]
): Promise<void> {
```

No inicio da funcao, definir taxas efetivas:

```typescript
  const effectiveRates = roundSuccessRates ?? DEFAULT_ROUND_SUCCESS_RATES;
```

### 11.3. Adicionar constantes de estilo para animais

```typescript
const FILL_ANIMAIS: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFEDF3FF' },
};
const FONT_ANIMAIS: Partial<ExcelJS.Font> = { size: 10, color: { argb: 'FF2563EB' }, bold: true };
```

### 11.4. Adicionar Row 5 (Qtd. Animais) apos Row 4 (Prov. Paricao)

```typescript
    // === Row: Qtd. Animais ===
    const animalsPerRound = lot.getAnimalsPerRound(effectiveRates, DEFAULT_ROUNDS);

    ws.getCell(r, 2).value = 'Qtd. Animais';
    ws.getCell(r, 2).font = FONT_LABEL;
    ws.getCell(r, 2).fill = FILL_LABEL;
    ws.getCell(r, 2).border = THIN_BORDER;
    ws.getCell(r, 2).alignment = ALIGN_LEFT_MIDDLE;

    col = 3;
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      const count = animalsPerRound[ri] ?? 0;

      for (let pdIdx = 0; pdIdx < protocolDays.length; pdIdx++) {
        const cell = ws.getCell(r, col);
        const isFirst = pdIdx === 0;
        if (isFirst) {
          cell.value = count;
          cell.font = FONT_ANIMAIS;
          cell.fill = FILL_ANIMAIS;
        } else {
          cell.value = '';
          cell.font = FONT_LABEL;
        }
        cell.alignment = ALIGN_CENTER;
        cell.border = THIN_BORDER;
        col++;
      }
      if (ri < DEFAULT_ROUNDS - 1) {
        const gapCell = ws.getCell(r, col);
        gapCell.value = '';
        gapCell.border = NO_BORDER;
        col++;
      }
    }
    r++;
```

### 11.5. Merge de 4 para 5 linhas

Alterar o merge do lot name cell:

```typescript
    // === Merge: lot name cell across 5 data rows (column 1) ===
    ws.mergeCells(dataStartRow, 1, dataStartRow + 4, 1);
    // ... (lotNameCell setup igual)
    // Apply borders to all merged cells in lot name column
    ws.getCell(dataStartRow + 1, 1).border = THIN_BORDER;
    ws.getCell(dataStartRow + 2, 1).border = THIN_BORDER;
    ws.getCell(dataStartRow + 3, 1).border = THIN_BORDER;
    ws.getCell(dataStartRow + 4, 1).border = THIN_BORDER;
```

Alterar o merge das gap columns:

```typescript
    // === Merge: gap columns across 5 data rows ===
    col = 3;
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      col += lotPdCount;
      if (ri < DEFAULT_ROUNDS - 1) {
        ws.mergeCells(dataStartRow, col, dataStartRow + 4, col);
        const gapMergedCell = ws.getCell(dataStartRow, col);
        gapMergedCell.alignment = ALIGN_CENTER;
        col++;
      }
    }
```

---

## 12. Chamadas de exportacao

Os componentes que chamam `generatePDF()` e `generateExcel()` precisam passar as taxas globais.

Verificar em `src/components/Export/ExportDialog.tsx` (ou onde as funcoes sao chamadas) e adicionar:

```typescript
import { roundSuccessRatesSignal } from '@/state/signals/success-rates';

// Na chamada:
generatePDF(lots, handlingDates, cycleStart, roundSuccessRatesSignal.value);
generateExcel(lots, handlingDates, roundSuccessRatesSignal.value);
```

---

## 13. Testes

### 13.1. `tests/domain/value-objects/Lot.test.ts` (NOVO)

```typescript
import { describe, it, expect } from 'vitest';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';

const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
const d0 = DateOnly.create(2026, 3, 1);

describe('Lot - animalCount', () => {
  it('should default to 100 animals', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol);
    expect(lot.animalCount).toBe(100);
  });

  it('should accept custom animal count', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 200);
    expect(lot.animalCount).toBe(200);
  });

  it('should throw if animalCount < 1', () => {
    expect(() => Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 0)).toThrow();
  });

  it('withAnimalCount should return new lot with updated count', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const updated = lot.withAnimalCount(150);
    expect(updated.animalCount).toBe(150);
    expect(lot.animalCount).toBe(100); // original unchanged
    expect(updated.id).toBe(lot.id);
    expect(updated.name).toBe(lot.name);
  });

  it('withD0 should preserve animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 250);
    const updated = lot.withD0(DateOnly.create(2026, 4, 1));
    expect(updated.animalCount).toBe(250);
  });

  it('withName should preserve animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 250);
    const updated = lot.withName('New Name');
    expect(updated.animalCount).toBe(250);
  });

  it('withProtocol should preserve animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 250);
    const p2 = Protocol.create('p2', 'D0-D8-D10', [0, 8, 10], 'D0-D8-D10');
    const updated = lot.withProtocol(p2);
    expect(updated.animalCount).toBe(250);
  });

  it('withRoundGap should preserve animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 250);
    const updated = lot.withRoundGap(0, 25);
    expect(updated.animalCount).toBe(250);
  });
});

describe('Lot - getAnimalsPerRound', () => {
  it('should calculate correctly with default rates [50, 20, 20, 10]', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const result = lot.getAnimalsPerRound([50, 20, 20, 10]);

    // R1: 100
    // R2: 100 - floor(100 * 50/100) = 100 - 50 = 50
    // R3: 50 - floor(50 * 20/100) = 50 - 10 = 40
    // R4: 40 - floor(40 * 20/100) = 40 - 8 = 32
    expect(result).toEqual([100, 50, 40, 32]);
  });

  it('should handle 200 animals with same rates', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 200);
    const result = lot.getAnimalsPerRound([50, 20, 20, 10]);

    // R1: 200
    // R2: 200 - 100 = 100
    // R3: 100 - 20 = 80
    // R4: 80 - 16 = 64
    expect(result).toEqual([200, 100, 80, 64]);
  });

  it('should handle 0% success rate (no animals succeed)', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const result = lot.getAnimalsPerRound([0, 0, 0, 0]);

    expect(result).toEqual([100, 100, 100, 100]);
  });

  it('should handle 100% success rate (all succeed)', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const result = lot.getAnimalsPerRound([100, 100, 100, 100]);

    expect(result).toEqual([100, 0, 0, 0]);
  });

  it('should use floor for fractional results', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 33);
    const result = lot.getAnimalsPerRound([50, 50, 50, 50]);

    // R1: 33
    // R2: 33 - floor(33 * 50/100) = 33 - 16 = 17
    // R3: 17 - floor(17 * 50/100) = 17 - 8 = 9
    // R4: 9 - floor(9 * 50/100) = 9 - 4 = 5
    expect(result).toEqual([33, 17, 9, 5]);
  });

  it('should handle different number of rounds', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const result = lot.getAnimalsPerRound([50, 20], 2);

    expect(result).toEqual([100, 50]);
  });
});

describe('Lot - serialization with animalCount', () => {
  it('toJSON should include animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 150);
    const json = lot.toJSON();
    expect(json.animalCount).toBe(150);
  });

  it('fromJSON should restore animalCount', () => {
    const lot = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 150);
    const json = lot.toJSON();
    const restored = Lot.fromJSON(json as any);
    expect(restored.animalCount).toBe(150);
  });

  it('fromJSON should default to 100 when animalCount is missing (migration)', () => {
    const json = {
      id: 'l1',
      name: 'Test',
      d0: { year: 2026, month: 3, day: 1 },
      protocol: { id: 'p1', name: 'D0-D7-D9', intervals: [0, 7, 9], type: 'D0-D7-D9' as const },
      roundGaps: [22, 22, 22],
      // animalCount is NOT present (old data)
    };
    const lot = Lot.fromJSON(json);
    expect(lot.animalCount).toBe(100);
  });

  it('equals should compare animalCount', () => {
    const lot1 = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 100);
    const lot2 = Lot.create('l1', 'Test', d0, protocol, [22, 22, 22], 200);
    expect(lot1.equals(lot2)).toBe(false);
  });
});
```

### 13.2. `tests/state/signals/success-rates.test.ts` (NOVO)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  roundSuccessRatesSignal,
  setRoundSuccessRate,
  setAllRoundSuccessRates,
  resetRoundSuccessRates,
} from '../../../src/state/signals/success-rates';
import { DEFAULT_ROUND_SUCCESS_RATES } from '../../../src/domain/constants';

describe('roundSuccessRatesSignal', () => {
  beforeEach(() => {
    resetRoundSuccessRates();
  });

  it('should start with default rates', () => {
    expect(roundSuccessRatesSignal.value).toEqual([...DEFAULT_ROUND_SUCCESS_RATES]);
  });

  it('setRoundSuccessRate should update a single rate', () => {
    setRoundSuccessRate(0, 60);
    expect(roundSuccessRatesSignal.value[0]).toBe(60);
    // Others unchanged
    expect(roundSuccessRatesSignal.value[1]).toBe(DEFAULT_ROUND_SUCCESS_RATES[1]);
  });

  it('setRoundSuccessRate should clamp to 0-100', () => {
    setRoundSuccessRate(0, -10);
    expect(roundSuccessRatesSignal.value[0]).toBe(0);

    setRoundSuccessRate(0, 150);
    expect(roundSuccessRatesSignal.value[0]).toBe(100);
  });

  it('setRoundSuccessRate should round to integer', () => {
    setRoundSuccessRate(0, 33.7);
    expect(roundSuccessRatesSignal.value[0]).toBe(34);
  });

  it('setAllRoundSuccessRates should replace all rates', () => {
    setAllRoundSuccessRates([10, 20, 30, 40]);
    expect(roundSuccessRatesSignal.value).toEqual([10, 20, 30, 40]);
  });

  it('resetRoundSuccessRates should restore defaults', () => {
    setAllRoundSuccessRates([10, 20, 30, 40]);
    resetRoundSuccessRates();
    expect(roundSuccessRatesSignal.value).toEqual([...DEFAULT_ROUND_SUCCESS_RATES]);
  });
});
```

---

## Ordem de Implementacao

1. `src/domain/constants.ts` - constantes novas
2. `src/domain/value-objects/Lot.ts` - dominio (animalCount + getAnimalsPerRound)
3. `src/state/signals/success-rates.ts` - signal global de taxas (novo arquivo)
4. `src/state/signals/lots.ts` - addLot atualizado + changeLotAnimalCount
5. `src/services/persistence/storage.ts` - StorageData + save/load com taxas
6. `src/hooks/usePersistence.ts` - auto-save/load com taxas
7. `src/components/Forms/LotForm.tsx` - campo quantidade no form
8. `src/components/Table/CalculationTable.tsx` - Row 5 animais + taxa na barra + modal
9. `src/styles/table.css` - estilos para taxa e animais
10. `src/services/export/pdf-generator.ts` - Row 5 + rowSpan 5
11. `src/services/export/excel-generator.ts` - Row 5 + merge 5
12. Componente de exportacao - passar taxas nas chamadas
13. Testes: `Lot.test.ts` + `success-rates.test.ts`
14. Executar `npm run type-check` e `npm test`

---

## Notas de Migracao

- `Lot.fromJSON()` trata `animalCount` como opcional (`?? 100`) para compatibilidade com dados salvos antes dessa feature.
- `StorageData.roundSuccessRates` e opcional (`?`) no tipo para compatibilidade com dados salvos antes dessa feature.
- A versao do storage (`VERSION`) **nao precisa** ser incrementada pois os novos campos sao opcionais com defaults.
