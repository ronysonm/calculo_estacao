# Dia de Parição — Plano de Implementação

## Objetivo

Adicionar uma 4ª linha em cada bloco de lote na tabela, logo abaixo de "Dia do ciclo",
exibindo o **provável dia de parição** de cada rodada.

- **Cálculo**: `último dia da rodada (último protocolo) + 290 dias`
- **Exibição**: apenas na coluna do último dia do protocolo de cada rodada (ex: D9 para D0-D7-D9)
- As demais colunas da rodada ficam vazias nessa linha

---

## Arquivos a Alterar

| Arquivo | Motivo |
|---|---|
| `src/domain/constants.ts` | Adicionar constante `GESTACAO_DIAS = 290` |
| `src/components/Table/CalculationTable.tsx` | Adicionar 4ª linha na tabela HTML; ajustar `rowSpan` |
| `src/styles/table.css` | Estilos para a nova linha |
| `src/services/export/excel-generator.ts` | 4ª linha no Excel; ajustar mesclas verticais |
| `src/services/export/pdf-generator.ts` | 4ª linha no PDF; ajustar `rowSpan` |

---

## 1. `src/domain/constants.ts`

Adicionar ao final do arquivo:

```typescript
/** Duração média da gestação bovina em dias (usado para cálculo da parição) */
export const GESTACAO_DIAS = 290;
```

---

## 2. `src/components/Table/CalculationTable.tsx`

### 2a. Importar a nova constante

```typescript
// Linha existente — adicionar GESTACAO_DIAS
import { DEFAULT_ROUNDS, ROUND_NAMES, PREDEFINED_PROTOCOLS, GESTACAO_DIAS } from '@/domain/constants';
```

### 2b. `lot-name-cell` — rowSpan de 3 → 4

```tsx
// ANTES (linha ~133):
<td class="lot-name-cell" rowSpan={3}>

// DEPOIS:
<td class="lot-name-cell" rowSpan={4}>
```

### 2c. `gap-cell` — rowSpan de 3 → 4

```tsx
// ANTES (linha ~176):
<td class="gap-cell gap-buttons-cell" rowSpan={3}>

// DEPOIS:
<td class="gap-cell gap-buttons-cell" rowSpan={4}>
```

### 2d. Remover `row-label-bottom` do label de `ciclo-row`

```tsx
// ANTES (linha ~233):
<td class="row-label-cell row-label-bottom">Dia do ciclo</td>

// DEPOIS:
<td class="row-label-cell">Dia do ciclo</td>
```

### 2e. Adicionar 4ª linha `paricao-row` após `ciclo-row`

Inserir após o fechamento de `</tr>` da `ciclo-row` (após linha ~249):

```tsx
{/* Row 4: Prov. Parição (calving date = last handling day + 290 days) */}
<tr class="paricao-row">
  <td class="row-label-cell row-label-bottom">Prov. Parição</td>
  {Array.from({ length: DEFAULT_ROUNDS }).map((_, roundIdx) => {
    const lastPd = protocolDays[protocolDays.length - 1] ?? 0;
    const startOffset = lot.getRoundStartOffset(roundIdx);
    const paricaoDate = addDaysToDateOnly(lot.d0, startOffset + lastPd + GESTACAO_DIAS);
    return (
      <>
        {protocolDays.map((pd, pdIdx) => {
          const isLast = pdIdx === protocolDays.length - 1;
          return (
            <td
              key={`paricao-${roundIdx}-${pdIdx}`}
              class={`data-cell paricao-cell${isLast ? ' paricao-date-cell' : ''}`}
            >
              {isLast ? formatDateBR(paricaoDate) : ''}
            </td>
          );
        })}
      </>
    );
  })}
</tr>
```

> **Nota**: `addDaysToDateOnly` e `formatDateBR` já são importados. `lot.getRoundStartOffset` já existe no value object `Lot`.

---

## 3. `src/styles/table.css`

### 3a. Atualizar `.ciclo-cell` — remover `border-bottom`

```css
/* ANTES */
.ciclo-cell {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  border-bottom: 0.5px solid var(--color-border);
}

/* DEPOIS */
.ciclo-cell {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
```

### 3b. Adicionar estilos da nova linha (após `.ciclo-cell`)

```css
/* ============ Parição Row ============ */
.paricao-cell {
  font-size: 0.75rem;
  color: #5a7a3a;          /* verde oliva suave */
  border-bottom: 0.5px solid var(--color-border);
}

.paricao-date-cell {
  font-weight: 600;
  background-color: rgba(90, 170, 60, 0.06);
}
```

---

## 4. `src/services/export/excel-generator.ts`

### 4a. Importar constante

```typescript
// Linha existente — adicionar GESTACAO_DIAS
import { DEFAULT_ROUNDS, ROUND_NAMES, GESTACAO_DIAS } from '@/domain/constants';
```

### 4b. Importar `addDaysToDateOnly` e `formatDateBR` (já importados via utils)

```typescript
// Já existe:
import { getDayOfWeekName, formatDateBR } from '@/core/date-engine/utils';

// Adicionar addDaysToDateOnly:
import { getDayOfWeekName, formatDateBR, addDaysToDateOnly } from '@/core/date-engine/utils';
```

### 4c. Adicionar 4ª linha de dados após a linha "Dia do ciclo"

Logo após o bloco `// === Row: Dia do ciclo ===` e seu `r++` (após linha ~330):

```typescript
// === Row: Prov. Parição ===
ws.getCell(r, 2).value = 'Prov. Parição';
ws.getCell(r, 2).font = FONT_LABEL;
ws.getCell(r, 2).fill = FILL_LABEL;
ws.getCell(r, 2).border = THIN_BORDER;
ws.getCell(r, 2).alignment = ALIGN_LEFT_MIDDLE;

const FILL_PARICAO: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF0F7ED' }, // verde claro
};
const FONT_PARICAO: Partial<ExcelJS.Font> = { size: 10, color: { argb: 'FF5A7A3A' }, bold: true };

col = 3;
for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
  const lastPd = protocolDays[protocolDays.length - 1] ?? 0;
  const startOffset = lot.getRoundStartOffset(ri);
  const paricaoDate = addDaysToDateOnly(lot.d0, startOffset + lastPd + GESTACAO_DIAS);

  for (let pdIdx = 0; pdIdx < protocolDays.length; pdIdx++) {
    const cell = ws.getCell(r, col);
    const isLast = pdIdx === protocolDays.length - 1;
    if (isLast) {
      cell.value = formatDateBR(paricaoDate);
      cell.font = FONT_PARICAO;
      cell.fill = FILL_PARICAO;
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

### 4d. Ajustar merge vertical do nome do lote: de `+2` → `+3`

```typescript
// ANTES (linha ~332):
ws.mergeCells(dataStartRow, 1, dataStartRow + 2, 1);
// ...
ws.getCell(dataStartRow + 1, 1).border = THIN_BORDER;
ws.getCell(dataStartRow + 2, 1).border = THIN_BORDER;

// DEPOIS:
ws.mergeCells(dataStartRow, 1, dataStartRow + 3, 1);
// ...
ws.getCell(dataStartRow + 1, 1).border = THIN_BORDER;
ws.getCell(dataStartRow + 2, 1).border = THIN_BORDER;
ws.getCell(dataStartRow + 3, 1).border = THIN_BORDER;
```

### 4e. Ajustar merge das colunas de gap: de `+2` → `+3`

```typescript
// ANTES (linha ~349):
ws.mergeCells(dataStartRow, col, dataStartRow + 2, col);

// DEPOIS:
ws.mergeCells(dataStartRow, col, dataStartRow + 3, col);
```

---

## 5. `src/services/export/pdf-generator.ts`

### 5a. Importar constante e utilitário

```typescript
// Linha existente:
import { getDayOfWeekName, formatDateBR, daysBetween } from '@/core/date-engine/utils';
// Adicionar addDaysToDateOnly:
import { getDayOfWeekName, formatDateBR, daysBetween, addDaysToDateOnly } from '@/core/date-engine/utils';

// Linha existente:
import { DEFAULT_ROUNDS, ROUND_NAMES } from '@/domain/constants';
// Adicionar GESTACAO_DIAS:
import { DEFAULT_ROUNDS, ROUND_NAMES, GESTACAO_DIAS } from '@/domain/constants';
```

### 5b. Ajustar `rowSpan` do nome do lote em `diaRow`: de `3` → `4`

```typescript
// ANTES (linha ~201):
{
  content: lot.name,
  rowSpan: 3,
  styles: { ... },
},

// DEPOIS:
{
  content: lot.name,
  rowSpan: 4,
  styles: { ... },
},
```

### 5c. Ajustar `rowSpan` das células de gap em `diaRow`: de `3` → `4`

```typescript
// ANTES (linha ~239):
diaRow.push({
  content: `${lot.roundGaps[ri] ?? 22}\ndias`,
  rowSpan: 3,
  styles: { ...GAP_STYLE },
});

// DEPOIS:
diaRow.push({
  content: `${lot.roundGaps[ri] ?? 22}\ndias`,
  rowSpan: 4,
  styles: { ...GAP_STYLE },
});
```

### 5d. Adicionar `paricaoRow` após `cicloRow`

```typescript
// Adicionar após a definição de cicloRow (após linha ~305):

// Row 4: Prov. Parição
const PARICAO_TEXT_COLOR: [number, number, number] = [90, 122, 58]; // verde oliva
const paricaoRow: any[] = [
  {
    content: 'Prov. Parição',
    styles: {
      fillColor: LABEL_BG,
      fontSize: 7,
      halign: 'center',
      fontStyle: 'bold',
      textColor: PARICAO_TEXT_COLOR,
    },
  },
];
for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
  const lastPd = protocolDays[protocolDays.length - 1] ?? 0;
  const startOffset = lot.getRoundStartOffset(ri);
  const paricaoDate = addDaysToDateOnly(lot.d0, startOffset + lastPd + GESTACAO_DIAS);

  for (let pdIdx = 0; pdIdx < pdCount; pdIdx++) {
    const isLast = pdIdx === pdCount - 1;
    paricaoRow.push({
      content: isLast ? formatDateBR(paricaoDate) : '',
      styles: {
        halign: 'center',
        fontSize: 8,
        fontStyle: isLast ? 'bold' : 'normal',
        textColor: isLast ? PARICAO_TEXT_COLOR : [200, 200, 200] as [number, number, number],
        fillColor: isLast ? [240, 247, 237] as [number, number, number] : WHITE,
      },
    });
  }
  // Gap columns handled by rowSpan from diaRow
}
```

### 5e. Incluir `paricaoRow` no array `body` do `autoTable`

```typescript
// ANTES (linha ~326):
body: [diaRow, dataRow, cicloRow],

// DEPOIS:
body: [diaRow, dataRow, cicloRow, paricaoRow],
```

---

## Resumo Visual da Tabela Resultante

```
┌──────────┬───────────────┬─────────────────────────────┬─────┬─────────────────────────────┐
│          │               │        Rodada 1             │     │        Rodada 2             │
│          │               │  D0    │  D7    │  D9    │     │  D0    │  D7    │  D9    │
├──────────┼───────────────┼────────┼────────┼────────┼─────┼────────┼────────┼────────┤
│          │ Dia           │ Seg    │ Seg    │ Ter    │     │  ...   │  ...   │  ...   │
│  Lote A  │ Data          │10/01   │17/01   │19/01   │ 22  │  ...   │  ...   │  ...   │
│          │ Dia do ciclo  │   0    │   7    │   9    │dias │  ...   │  ...   │  ...   │
│          │ Prov. Parição │        │        │05/04   │     │        │        │  ...   │
└──────────┴───────────────┴────────┴────────┴────────┴─────┴────────┴────────┴────────┘
```

- Data de Parição da Rodada 1 = 19/01 + 290 dias = 05/04 (ano seguinte)
- Apenas a coluna do último protocolo (D9) exibe a data

---

## Considerações Técnicas

1. **Sem nova lógica de domínio** — o cálculo usa `addDaysToDateOnly` e `getRoundStartOffset` já existentes.
2. **Sem impacto nos signals** — é puramente UI + export; não altera `lotsSignal` nem `handlingDatesSignal`.
3. **`rowSpan` nos exportadores** — tanto Excel quanto PDF precisam de ajuste pois mesclam verticalmente o nome do lote e os gaps.
4. **`row-label-bottom`** — mover para a linha de Parição garante que a borda inferior do bloco de cada lote continue visualmente correta.
5. **Testes** — verificar se há testes de snapshot dos geradores de exportação e atualizá-los.
