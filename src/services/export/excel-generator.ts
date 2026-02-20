/**
 * Excel Generator (ExcelJS)
 *
 * Generates styled Excel file matching the on-screen CalculationTable layout:
 * - Round header row (merged per round) with gray background
 * - Protocol day header row (D0, D7, D9 etc.) with gray background
 * - Per lot: 3 data rows (Dia, Data, Dia do ciclo)
 * - Lot name merged vertically across the 3 data rows
 * - Gap columns between rounds with gap value merged vertically
 * - Conflict cells with colored backgrounds (red/orange)
 * - Legend with colored cells
 */

import ExcelJS from 'exceljs';
import { Lot } from '@/domain/value-objects/Lot';
import { HandlingDate } from '@/domain/value-objects/HandlingDate';
import { getConflictTypeForCell } from '@/core/conflict/detector';
import { DEFAULT_ROUNDS, ROUND_NAMES, GESTACAO_DIAS, DEFAULT_ROUND_SUCCESS_RATES } from '@/domain/constants';
import { getDayOfWeekName, formatDateBR, addDaysToDateOnly } from '@/core/date-engine/utils';

// --- Style constants ---
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

const NO_BORDER: Partial<ExcelJS.Borders> = {};

const FILL_GRAY: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF3F4F6' },
};

const FILL_LOT_NAME: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFAFAFA' },
};

const FILL_LABEL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFAFAFA' },
};

const FILL_SUNDAY: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFEBEB' },
};

const FILL_OVERLAP: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF0E0' },
};

const FILL_MULTIPLE: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFD9D9' },
};

const FONT_TITLE: Partial<ExcelJS.Font> = { bold: true, size: 14 };
const FONT_SUBTITLE: Partial<ExcelJS.Font> = { size: 10, italic: true };
const FONT_ROUND_HEADER: Partial<ExcelJS.Font> = { bold: true, size: 11 };
const FONT_PROTOCOL_HEADER: Partial<ExcelJS.Font> = { bold: true, size: 10 };
const FONT_LOT_NAME: Partial<ExcelJS.Font> = { bold: true, size: 11 };
const FONT_LABEL: Partial<ExcelJS.Font> = { size: 9 };
const FONT_DATA: Partial<ExcelJS.Font> = { size: 10 };
const FONT_GAP: Partial<ExcelJS.Font> = { bold: true, size: 10 };
const FONT_CONFLICT_SUNDAY: Partial<ExcelJS.Font> = { size: 10, color: { argb: 'FFCC0000' } };
const FONT_CONFLICT_OVERLAP: Partial<ExcelJS.Font> = { size: 10, color: { argb: 'FFCC6600' } };
const FONT_CONFLICT_MULTIPLE: Partial<ExcelJS.Font> = { size: 10, color: { argb: 'FFCC0000' } };

const FILL_ANIMAIS: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFEDF3FF' },
};
const FONT_ANIMAIS: Partial<ExcelJS.Font> = { size: 10, color: { argb: 'FF2563EB' }, bold: true };

const ALIGN_CENTER: Partial<ExcelJS.Alignment> = {
  horizontal: 'center',
  vertical: 'middle',
  wrapText: true,
};

const ALIGN_LEFT_MIDDLE: Partial<ExcelJS.Alignment> = {
  horizontal: 'left',
  vertical: 'middle',
};

/**
 * Generate styled Excel file matching the on-screen table layout
 */
export async function generateExcel(lots: Lot[], handlingDates: HandlingDate[], roundSuccessRates?: readonly number[]): Promise<void> {
  if (lots.length === 0) {
    alert('Nenhum lote para exportar');
    return;
  }

  const effectiveRates = roundSuccessRates ?? [...DEFAULT_ROUND_SUCCESS_RATES];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Calculadora IATF';
  wb.created = new Date();

  const ws = wb.addWorksheet('Calendario');

  const firstProtocol = lots[0]!.protocol.intervals;
  const pdCount = firstProtocol.length;
  const totalCols = 2 + pdCount * DEFAULT_ROUNDS + (DEFAULT_ROUNDS - 1);

  // --- Set column widths ---
  const colWidths: Partial<ExcelJS.Column>[] = [
    { width: 18 },  // Lot name
    { width: 14 },  // Row label
  ];
  for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
    for (let p = 0; p < pdCount; p++) {
      colWidths.push({ width: 14 });
    }
    if (ri < DEFAULT_ROUNDS - 1) {
      colWidths.push({ width: 8 }); // Gap column
    }
  }
  colWidths.forEach((cw, i) => {
    if (cw.width !== undefined) {
      ws.getColumn(i + 1).width = cw.width;
    }
  });

  let r = 1; // ExcelJS rows are 1-based

  // --- Title ---
  ws.mergeCells(r, 1, r, totalCols);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = 'Calendario de Estacao IATF';
  titleCell.font = FONT_TITLE;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  r++;

  // --- Generated date ---
  ws.mergeCells(r, 1, r, totalCols);
  const dateCell = ws.getCell(r, 1);
  dateCell.value = `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
  dateCell.font = FONT_SUBTITLE;
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  r++;

  // --- Blank separator ---
  r++;

  // Process each lot
  for (let lotIdx = 0; lotIdx < lots.length; lotIdx++) {
    const lot = lots[lotIdx]!;
    const protocolDays = lot.protocol.intervals;
    const lotPdCount = protocolDays.length;
    const lotHDs = handlingDates.filter((hd) => hd.lotId === lot.id);

    // Group handling dates by roundId
    const datesByRound = new Map<number, HandlingDate[]>();
    for (const hd of lotHDs) {
      const arr = datesByRound.get(hd.roundId) || [];
      arr.push(hd);
      datesByRound.set(hd.roundId, arr);
    }

    // === Row: Round headers (merged per round) ===
    let col = 3; // 1-based, skip lot name + label columns
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      if (lotPdCount > 1) {
        ws.mergeCells(r, col, r, col + lotPdCount - 1);
      }
      const cell = ws.getCell(r, col);
      cell.value = ROUND_NAMES[ri];
      cell.font = FONT_ROUND_HEADER;
      cell.fill = FILL_GRAY;
      cell.alignment = ALIGN_CENTER;
      cell.border = THIN_BORDER;
      // Apply border to all merged cells
      for (let p = 1; p < lotPdCount; p++) {
        ws.getCell(r, col + p).border = THIN_BORDER;
      }
      col += lotPdCount;
      if (ri < DEFAULT_ROUNDS - 1) {
        // Gap column header - empty
        const gapCell = ws.getCell(r, col);
        gapCell.value = '';
        gapCell.border = NO_BORDER;
        col++;
      }
    }
    // Empty cells for lot name and label in round header row
    ws.getCell(r, 1).border = THIN_BORDER;
    ws.getCell(r, 1).fill = FILL_GRAY;
    ws.getCell(r, 2).border = THIN_BORDER;
    ws.getCell(r, 2).fill = FILL_GRAY;
    r++;

    // === Row: Protocol day labels ===
    ws.getCell(r, 1).border = THIN_BORDER;
    ws.getCell(r, 1).fill = FILL_GRAY;
    ws.getCell(r, 2).border = THIN_BORDER;
    ws.getCell(r, 2).fill = FILL_GRAY;
    col = 3;
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      for (const pd of protocolDays) {
        const cell = ws.getCell(r, col);
        cell.value = `D${pd}`;
        cell.font = FONT_PROTOCOL_HEADER;
        cell.fill = FILL_GRAY;
        cell.alignment = ALIGN_CENTER;
        cell.border = THIN_BORDER;
        col++;
      }
      if (ri < DEFAULT_ROUNDS - 1) {
        // Gap column - empty
        const gapCell = ws.getCell(r, col);
        gapCell.value = '';
        gapCell.border = NO_BORDER;
        col++;
      }
    }
    r++;

    // Mark the start row of the 3 data rows
    const dataStartRow = r;

    // === Row: Dia (weekday) ===
    ws.getCell(r, 2).value = 'Dia';
    ws.getCell(r, 2).font = FONT_LABEL;
    ws.getCell(r, 2).fill = FILL_LABEL;
    ws.getCell(r, 2).border = THIN_BORDER;
    ws.getCell(r, 2).alignment = ALIGN_LEFT_MIDDLE;
    col = 3;
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      const roundDates = datesByRound.get(ri) || [];
      for (const pd of protocolDays) {
        const hd = roundDates.find((h) => h.protocolDay === pd);
        const cell = ws.getCell(r, col);
        if (hd) {
          const dayName = getDayOfWeekName(hd.date);
          const conflict = getConflictTypeForCell(hd.date, lot.id, handlingDates);
          cell.value = dayName;
          if (conflict) {
            applyConflictStyle(cell, conflict);
          } else {
            cell.font = FONT_DATA;
          }
        } else {
          cell.font = FONT_DATA;
        }
        cell.alignment = ALIGN_CENTER;
        cell.border = THIN_BORDER;
        col++;
      }
      if (ri < DEFAULT_ROUNDS - 1) {
        // Gap column - gap value
        const gapCell = ws.getCell(r, col);
        gapCell.value = lot.roundGaps[ri] ?? 22;
        gapCell.font = FONT_GAP;
        gapCell.alignment = ALIGN_CENTER;
        gapCell.border = NO_BORDER;
        col++;
      }
    }
    r++;

    // === Row: Data (dates) ===
    ws.getCell(r, 2).value = 'Data';
    ws.getCell(r, 2).font = FONT_LABEL;
    ws.getCell(r, 2).fill = FILL_LABEL;
    ws.getCell(r, 2).border = THIN_BORDER;
    ws.getCell(r, 2).alignment = ALIGN_LEFT_MIDDLE;
    col = 3;
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      const roundDates = datesByRound.get(ri) || [];
      for (const pd of protocolDays) {
        const hd = roundDates.find((h) => h.protocolDay === pd);
        const cell = ws.getCell(r, col);
        if (hd) {
          const dateStr = formatDateBR(hd.date);
          const conflict = getConflictTypeForCell(hd.date, lot.id, handlingDates);
          cell.value = dateStr;
          if (conflict) {
            applyConflictStyle(cell, conflict);
          } else {
            cell.font = FONT_DATA;
          }
        } else {
          cell.font = FONT_DATA;
        }
        cell.alignment = ALIGN_CENTER;
        cell.border = THIN_BORDER;
        col++;
      }
      if (ri < DEFAULT_ROUNDS - 1) {
        // Gap column - "dias"
        const gapCell = ws.getCell(r, col);
        gapCell.value = 'dias';
        gapCell.font = FONT_GAP;
        gapCell.alignment = ALIGN_CENTER;
        gapCell.border = NO_BORDER;
        col++;
      }
    }
    r++;

    // === Row: Dia do ciclo ===
    ws.getCell(r, 2).value = 'Dia do ciclo';
    ws.getCell(r, 2).font = FONT_LABEL;
    ws.getCell(r, 2).fill = FILL_LABEL;
    ws.getCell(r, 2).border = THIN_BORDER;
    ws.getCell(r, 2).alignment = ALIGN_LEFT_MIDDLE;
    col = 3;
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      const startOffset = lot.getRoundStartOffset(ri);
      for (const pd of protocolDays) {
        const cell = ws.getCell(r, col);
        cell.value = startOffset + pd;
        cell.font = FONT_DATA;
        cell.alignment = ALIGN_CENTER;
        cell.border = THIN_BORDER;
        col++;
      }
      if (ri < DEFAULT_ROUNDS - 1) {
        // Gap column - empty
        const gapCell = ws.getCell(r, col);
        gapCell.value = '';
        gapCell.border = NO_BORDER;
        col++;
      }
    }
    r++;

    // === Row: Prov. Parição ===
    ws.getCell(r, 2).value = 'Prov. Parição';
    ws.getCell(r, 2).font = FONT_LABEL;
    ws.getCell(r, 2).fill = FILL_LABEL;
    ws.getCell(r, 2).border = THIN_BORDER;
    ws.getCell(r, 2).alignment = ALIGN_LEFT_MIDDLE;

    const FILL_PARICAO: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F7ED' },
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

    // === Merge: lot name cell across 5 data rows (column 1) ===
    ws.mergeCells(dataStartRow, 1, dataStartRow + 4, 1);
    const lotNameCell = ws.getCell(dataStartRow, 1);
    lotNameCell.value = lot.name;
    lotNameCell.font = FONT_LOT_NAME;
    lotNameCell.fill = FILL_LOT_NAME;
    lotNameCell.alignment = ALIGN_CENTER;
    lotNameCell.border = THIN_BORDER;
    // Apply borders to all merged cells in lot name column
    ws.getCell(dataStartRow + 1, 1).border = THIN_BORDER;
    ws.getCell(dataStartRow + 2, 1).border = THIN_BORDER;
    ws.getCell(dataStartRow + 3, 1).border = THIN_BORDER;
    ws.getCell(dataStartRow + 4, 1).border = THIN_BORDER;

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

    // Separator row between lots
    if (lotIdx < lots.length - 1) {
      r++;
    }
  }

  // --- Legend ---
  r += 2;
  const legendTitleCell = ws.getCell(r, 1);
  legendTitleCell.value = 'Legenda:';
  legendTitleCell.font = { bold: true, size: 10 };
  r++;

  // Sunday conflict
  const sundayColorCell = ws.getCell(r, 1);
  sundayColorCell.fill = FILL_SUNDAY;
  sundayColorCell.border = THIN_BORDER;
  sundayColorCell.value = '';
  const sundayTextCell = ws.getCell(r, 2);
  sundayTextCell.value = 'Conflito com Domingo';
  sundayTextCell.font = { size: 10, color: { argb: 'FFCC0000' } };
  ws.mergeCells(r, 2, r, 4);
  r++;

  // Overlap conflict
  const overlapColorCell = ws.getCell(r, 1);
  overlapColorCell.fill = FILL_OVERLAP;
  overlapColorCell.border = THIN_BORDER;
  overlapColorCell.value = '';
  const overlapTextCell = ws.getCell(r, 2);
  overlapTextCell.value = 'Sobreposicao de lotes';
  overlapTextCell.font = { size: 10, color: { argb: 'FFCC6600' } };
  ws.mergeCells(r, 2, r, 4);
  r++;

  // Multiple conflict
  const multipleColorCell = ws.getCell(r, 1);
  multipleColorCell.fill = FILL_MULTIPLE;
  multipleColorCell.border = THIN_BORDER;
  multipleColorCell.value = '';
  const multipleTextCell = ws.getCell(r, 2);
  multipleTextCell.value = 'Conflito multiplo (Domingo + Sobreposicao)';
  multipleTextCell.font = { size: 10, color: { argb: 'FFCC0000' } };
  ws.mergeCells(r, 2, r, 4);

  // --- Generate and download ---
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estacao-${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Apply conflict-specific fill and font to a cell
 */
function applyConflictStyle(cell: ExcelJS.Cell, conflict: 'sunday' | 'overlap' | 'multiple'): void {
  switch (conflict) {
    case 'sunday':
      cell.fill = FILL_SUNDAY;
      cell.font = FONT_CONFLICT_SUNDAY;
      break;
    case 'overlap':
      cell.fill = FILL_OVERLAP;
      cell.font = FONT_CONFLICT_OVERLAP;
      break;
    case 'multiple':
      cell.fill = FILL_MULTIPLE;
      cell.font = FONT_CONFLICT_MULTIPLE;
      break;
  }
}
