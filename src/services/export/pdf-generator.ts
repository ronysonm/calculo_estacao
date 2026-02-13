/**
 * PDF Generator
 *
 * Generates PDF schedule matching the on-screen/print layout:
 * - Title header with cycle info
 * - Per lot: round headers, protocol day headers, 3 data rows
 *   (Dia/Data/Dia do ciclo) with lot name merged vertically
 * - Gap columns between rounds
 * - Conflict colors matching on-screen display
 * - Legend at bottom
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Lot } from '@/domain/value-objects/Lot';
import { HandlingDate } from '@/domain/value-objects/HandlingDate';
import { getDayOfWeekName, formatDateBR, daysBetween } from '@/core/date-engine/utils';
import { getConflictTypeForCell } from '@/core/conflict/detector';
import { DEFAULT_ROUNDS, ROUND_NAMES } from '@/domain/constants';
import { DateOnly } from '@/domain/value-objects/DateOnly';

// --- Color constants (matching table.css) ---
const GRAY_BG: [number, number, number] = [243, 244, 246];
const LOT_NAME_BG: [number, number, number] = [250, 250, 250];
const LABEL_BG: [number, number, number] = [250, 250, 250];
const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

// Conflict colors (light tint backgrounds like on-screen)
const SUNDAY_BG: [number, number, number] = [255, 230, 230];
const SUNDAY_TEXT: [number, number, number] = [204, 0, 0];
const OVERLAP_BG: [number, number, number] = [255, 240, 220];
const OVERLAP_TEXT: [number, number, number] = [204, 102, 0];
const MULTIPLE_BG: [number, number, number] = [255, 210, 210];
const MULTIPLE_TEXT: [number, number, number] = [204, 0, 0];

// Gap column style (no borders)
const GAP_STYLE = {
  fillColor: WHITE,
  lineWidth: 0,
  halign: 'center' as const,
  valign: 'middle' as const,
  fontStyle: 'bold' as const,
  fontSize: 8,
  textColor: BLACK,
};

/**
 * Apply conflict styling to a cell definition
 */
function applyConflictStyle(
  cellStyles: Record<string, any>,
  conflict: 'sunday' | 'overlap' | 'multiple'
): void {
  switch (conflict) {
    case 'sunday':
      cellStyles.fillColor = SUNDAY_BG;
      cellStyles.textColor = SUNDAY_TEXT;
      break;
    case 'overlap':
      cellStyles.fillColor = OVERLAP_BG;
      cellStyles.textColor = OVERLAP_TEXT;
      break;
    case 'multiple':
      cellStyles.fillColor = MULTIPLE_BG;
      cellStyles.textColor = MULTIPLE_TEXT;
      break;
  }
}

/**
 * Get finalY from the last autoTable drawn on doc
 */
function getLastTableY(doc: jsPDF, fallback: number): number {
  const lastTable = (doc as any).lastAutoTable;
  return lastTable?.finalY ?? fallback;
}

/**
 * Generate PDF schedule matching the print layout
 */
export function generatePDF(
  lots: Lot[],
  handlingDates: HandlingDate[],
  cycleStart?: DateOnly | null
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  if (lots.length === 0) {
    doc.setFontSize(16);
    doc.text('Nenhum lote para exportar', 148, 40, { align: 'center' });
    doc.save(`estacao-${new Date().toISOString().split('T')[0]}.pdf`);
    return;
  }

  const effectiveCycleStart = cycleStart ?? lots[0]!.d0;

  // --- Title ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Calendário de Estação IATF', 148, 12, { align: 'center' });

  // --- Subtitle with cycle info ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const parts: string[] = [];
  if (cycleStart) {
    parts.push(`Início do ciclo: ${formatDateBR(cycleStart)}`);
  }
  parts.push(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`);
  doc.text(parts.join('  |  '), 148, 18, { align: 'center' });

  let startY = 23;

  // --- Process each lot ---
  for (let lotIdx = 0; lotIdx < lots.length; lotIdx++) {
    const lot = lots[lotIdx]!;
    const protocolDays = lot.protocol.intervals;
    const pdCount = protocolDays.length;
    const lotHDs = handlingDates.filter((hd) => hd.lotId === lot.id);
    const lotOffset = daysBetween(effectiveCycleStart, lot.d0);

    // Group handling dates by round
    const datesByRound = new Map<number, HandlingDate[]>();
    for (const hd of lotHDs) {
      const arr = datesByRound.get(hd.roundId) || [];
      arr.push(hd);
      datesByRound.set(hd.roundId, arr);
    }

    // Check if we need a new page (if not enough space for 5 rows ~30mm)
    const pageHeight = doc.internal.pageSize.getHeight();
    if (startY > pageHeight - 35) {
      doc.addPage();
      startY = 15;
    }

    // === Build head rows ===

    // Row 1: Round headers
    const roundHeaderRow: any[] = [
      { content: '', styles: { fillColor: GRAY_BG } },
      { content: '', styles: { fillColor: GRAY_BG } },
    ];
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      roundHeaderRow.push({
        content: ROUND_NAMES[ri],
        colSpan: pdCount,
        styles: {
          fillColor: GRAY_BG,
          textColor: BLACK,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 9,
        },
      });
      if (ri < DEFAULT_ROUNDS - 1) {
        roundHeaderRow.push({
          content: '',
          styles: { ...GAP_STYLE },
        });
      }
    }

    // Row 2: Protocol day labels (D0, D7, D9)
    const protocolHeaderRow: any[] = [
      { content: '', styles: { fillColor: GRAY_BG } },
      { content: '', styles: { fillColor: GRAY_BG } },
    ];
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      for (const pd of protocolDays) {
        protocolHeaderRow.push({
          content: `D${pd}`,
          styles: {
            fillColor: GRAY_BG,
            textColor: BLACK,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8,
          },
        });
      }
      if (ri < DEFAULT_ROUNDS - 1) {
        protocolHeaderRow.push({
          content: '',
          styles: { ...GAP_STYLE },
        });
      }
    }

    // === Build body rows ===

    // Row 1: Dia (weekday)
    const diaRow: any[] = [
      {
        content: lot.name,
        rowSpan: 3,
        styles: {
          fontStyle: 'bold',
          fillColor: LOT_NAME_BG,
          halign: 'center',
          valign: 'middle',
          fontSize: 9,
          textColor: BLACK,
        },
      },
      {
        content: 'Dia',
        styles: {
          fillColor: LABEL_BG,
          fontSize: 7,
          halign: 'center',
          textColor: [100, 100, 100] as [number, number, number],
        },
      },
    ];
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      const roundDates = datesByRound.get(ri) || [];
      for (const pd of protocolDays) {
        const hd = roundDates.find((h) => h.protocolDay === pd);
        const cellStyles: Record<string, any> = {
          halign: 'center',
          fontSize: 7,
          textColor: [100, 100, 100],
        };
        if (hd) {
          const conflict = getConflictTypeForCell(hd.date, lot.id, handlingDates);
          if (conflict) applyConflictStyle(cellStyles, conflict);
          diaRow.push({ content: getDayOfWeekName(hd.date), styles: cellStyles });
        } else {
          diaRow.push({ content: '', styles: cellStyles });
        }
      }
      if (ri < DEFAULT_ROUNDS - 1) {
        diaRow.push({
          content: `${lot.roundGaps[ri] ?? 22}\ndias`,
          rowSpan: 3,
          styles: { ...GAP_STYLE },
        });
      }
    }

    // Row 2: Data (date)
    const dataRow: any[] = [
      {
        content: 'Data',
        styles: {
          fillColor: LABEL_BG,
          fontSize: 7,
          halign: 'center',
          fontStyle: 'bold',
          textColor: BLACK,
        },
      },
    ];
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      const roundDates = datesByRound.get(ri) || [];
      for (const pd of protocolDays) {
        const hd = roundDates.find((h) => h.protocolDay === pd);
        const cellStyles: Record<string, any> = {
          halign: 'center',
          fontSize: 8,
          textColor: BLACK,
        };
        if (hd) {
          const conflict = getConflictTypeForCell(hd.date, lot.id, handlingDates);
          if (conflict) applyConflictStyle(cellStyles, conflict);
          dataRow.push({ content: formatDateBR(hd.date), styles: cellStyles });
        } else {
          dataRow.push({ content: '', styles: cellStyles });
        }
      }
      // Gap columns handled by rowSpan from diaRow
    }

    // Row 3: Dia do ciclo
    const cicloRow: any[] = [
      {
        content: 'Dia do ciclo',
        styles: {
          fillColor: LABEL_BG,
          fontSize: 7,
          halign: 'center',
          textColor: [100, 100, 100] as [number, number, number],
        },
      },
    ];
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      const startOffset = lot.getRoundStartOffset(ri);
      for (const pd of protocolDays) {
        cicloRow.push({
          content: String(lotOffset + startOffset + pd),
          styles: {
            halign: 'center',
            fontSize: 7,
            textColor: [100, 100, 100] as [number, number, number],
          },
        });
      }
      // Gap columns handled by rowSpan from diaRow
    }

    // === Column widths ===
    const columnStyles: Record<number, any> = {
      0: { cellWidth: 22 }, // Lot name
      1: { cellWidth: 16 }, // Row label
    };
    let colIdx = 2;
    for (let ri = 0; ri < DEFAULT_ROUNDS; ri++) {
      for (let p = 0; p < pdCount; p++) {
        columnStyles[colIdx] = { cellWidth: 'auto' };
        colIdx++;
      }
      if (ri < DEFAULT_ROUNDS - 1) {
        columnStyles[colIdx] = { cellWidth: 10 }; // Gap column
        colIdx++;
      }
    }

    // === Render the lot table ===
    autoTable(doc, {
      head: [roundHeaderRow, protocolHeaderRow],
      body: [diaRow, dataRow, cicloRow],
      startY,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 1.5,
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: GRAY_BG,
        textColor: BLACK,
        fontStyle: 'bold',
        lineColor: [150, 150, 150],
        lineWidth: 0.3,
      },
      columnStyles,
      margin: { left: 10, right: 10 },
      tableWidth: 'auto',
      pageBreak: 'avoid',
    });

    startY = getLastTableY(doc, startY + 30) + 3;
  }

  // --- Legend ---
  const pageHeight = doc.internal.pageSize.getHeight();
  if (startY > pageHeight - 20) {
    doc.addPage();
    startY = 15;
  }

  const legendY = startY + 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Legenda:', 10, legendY);

  doc.setFont('helvetica', 'normal');

  // Sunday
  doc.setFillColor(...SUNDAY_BG);
  doc.rect(10, legendY + 2, 8, 4, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(10, legendY + 2, 8, 4, 'S');
  doc.setTextColor(...SUNDAY_TEXT);
  doc.text('Domingo', 20, legendY + 5);

  // Overlap
  doc.setFillColor(...OVERLAP_BG);
  doc.rect(50, legendY + 2, 8, 4, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(50, legendY + 2, 8, 4, 'S');
  doc.setTextColor(...OVERLAP_TEXT);
  doc.text('Sobreposição de lotes', 60, legendY + 5);

  // Multiple
  doc.setFillColor(...MULTIPLE_BG);
  doc.rect(110, legendY + 2, 8, 4, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(110, legendY + 2, 8, 4, 'S');
  doc.setTextColor(...MULTIPLE_TEXT);
  doc.text('Domingo + Sobreposição', 120, legendY + 5);

  // Save
  const filename = `estacao-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
