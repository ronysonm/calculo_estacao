/**
 * Excel Generator
 *
 * Generates Excel file matching the on-screen CalculationTable layout:
 * - Round header row (merged per round)
 * - Protocol day header row (D0, D7, D9 etc.)
 * - Per lot: 3 data rows (Dia, Data, Dia do ciclo)
 * - Lot name merged vertically across the 3 data rows
 * - Gap columns between rounds with gap value merged vertically
 * - Conflict markers with legend (SheetJS free has no color support)
 */

import * as XLSX from 'xlsx';
import { Lot } from '@/domain/value-objects/Lot';
import { HandlingDate } from '@/domain/value-objects/HandlingDate';
import { getConflictTypeForCell } from '@/core/conflict/detector';
import { DEFAULT_ROUNDS, ROUND_NAMES } from '@/domain/constants';
import { getDayOfWeekName, formatDateBR } from '@/core/date-engine/utils';

/**
 * Generate Excel file matching the on-screen table layout
 */
export function generateExcel(lots: Lot[], handlingDates: HandlingDate[]): void {
  if (lots.length === 0) {
    alert('Nenhum lote para exportar');
    return;
  }

  const rows: any[][] = [];
  const merges: XLSX.Range[] = [];
  let r = 0; // current row index

  // --- Title ---
  rows.push(['Calendario de Estacao IATF']);
  r++;

  // --- Generated date ---
  rows.push([`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`]);
  r++;

  // --- Blank separator ---
  rows.push([]);
  r++;

  // Process each lot
  for (let lotIdx = 0; lotIdx < lots.length; lotIdx++) {
    const lot = lots[lotIdx]!;
    const protocolDays = lot.protocol.intervals;
    const pdCount = protocolDays.length;
    const lotHDs = handlingDates.filter((hd) => hd.lotId === lot.id);

    // Group handling dates by roundId
    const datesByRound = new Map<number, HandlingDate[]>();
    for (const hd of lotHDs) {
      const arr = datesByRound.get(hd.roundId) || [];
      arr.push(hd);
      datesByRound.set(hd.roundId, arr);
    }

    // === Row: Round headers (merged per round) ===
    const roundHeaderRow: any[] = ['', ''];
    let col = 2;
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      roundHeaderRow.push(ROUND_NAMES[ri]);
      for (let p = 1; p < pdCount; p++) roundHeaderRow.push('');
      if (pdCount > 1) {
        merges.push({ s: { r, c: col }, e: { r, c: col + pdCount - 1 } });
      }
      col += pdCount;
      if (ri < DEFAULT_ROUNDS - 1) {
        roundHeaderRow.push('');
        col++;
      }
    }
    rows.push(roundHeaderRow);
    r++;

    // === Row: Protocol day labels ===
    const protocolRow: any[] = ['', ''];
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      for (const pd of protocolDays) protocolRow.push(`D${pd}`);
      if (ri < DEFAULT_ROUNDS - 1) protocolRow.push('');
    }
    rows.push(protocolRow);
    r++;

    // Mark the start row of the 3 data rows for lot name & gap merges
    const dataStartRow = r;

    // === Row: Dia (weekday) ===
    const diaRow: any[] = [lot.name, 'Dia'];
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      const roundDates = datesByRound.get(ri) || [];
      for (const pd of protocolDays) {
        const hd = roundDates.find((h) => h.protocolDay === pd);
        if (hd) {
          const dayName = getDayOfWeekName(hd.date);
          const conflict = getConflictTypeForCell(hd.date, lot.id, handlingDates);
          diaRow.push(conflict ? `${dayName} *` : dayName);
        } else {
          diaRow.push('');
        }
      }
      if (ri < DEFAULT_ROUNDS - 1) {
        diaRow.push(lot.roundGaps[ri] ?? 22);
      }
    }
    rows.push(diaRow);
    r++;

    // === Row: Data (dates) ===
    const dataRow: any[] = ['', 'Data'];
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      const roundDates = datesByRound.get(ri) || [];
      for (const pd of protocolDays) {
        const hd = roundDates.find((h) => h.protocolDay === pd);
        if (hd) {
          const dateStr = formatDateBR(hd.date);
          const conflict = getConflictTypeForCell(hd.date, lot.id, handlingDates);
          dataRow.push(conflict ? `${dateStr} *` : dateStr);
        } else {
          dataRow.push('');
        }
      }
      if (ri < DEFAULT_ROUNDS - 1) {
        dataRow.push('dias');
      }
    }
    rows.push(dataRow);
    r++;

    // === Row: Dia do ciclo ===
    const cicloRow: any[] = ['', 'Dia do ciclo'];
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      const startOffset = lot.getRoundStartOffset(ri);
      for (const pd of protocolDays) {
        cicloRow.push(startOffset + pd);
      }
      if (ri < DEFAULT_ROUNDS - 1) {
        cicloRow.push('');
      }
    }
    rows.push(cicloRow);
    r++;

    // Merge: lot name cell across 3 data rows (column 0)
    merges.push({
      s: { r: dataStartRow, c: 0 },
      e: { r: dataStartRow + 2, c: 0 },
    });

    // Merge: gap columns across 3 data rows
    col = 2;
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      col += pdCount;
      if (ri < DEFAULT_ROUNDS - 1) {
        merges.push({
          s: { r: dataStartRow, c: col },
          e: { r: dataStartRow + 2, c: col },
        });
        col++;
      }
    }

    // Separator row between lots
    if (lotIdx < lots.length - 1) {
      rows.push([]);
      r++;
    }
  }

  // --- Legend ---
  rows.push([]);
  rows.push(['Legenda:']);
  rows.push(['* = Conflito (Domingo ou Sobreposicao de lotes)']);

  // --- Build worksheet ---
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = merges;

  // Title merge across all columns
  const firstProtocol = lots[0]!.protocol.intervals;
  const totalCols = 2 + firstProtocol.length * DEFAULT_ROUNDS + (DEFAULT_ROUNDS - 1);
  merges.unshift(
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
  );

  // Column widths
  const colWidths: XLSX.ColInfo[] = [
    { wch: 16 }, // Lot name
    { wch: 13 }, // Row label
  ];
  for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
    for (let p = 0; p < firstProtocol.length; p++) {
      colWidths.push({ wch: 12 });
    }
    if (ri < DEFAULT_ROUNDS - 1) {
      colWidths.push({ wch: 6 }); // Gap column (narrow)
    }
  }
  ws['!cols'] = colWidths;

  // --- Create workbook and save ---
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Calendario');

  wb.Props = {
    Title: 'Calendario de Estacao IATF',
    Subject: 'Planejamento de manejos',
    Author: 'Calculadora IATF',
    CreatedDate: new Date(),
  };

  const filename = `estacao-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
}
