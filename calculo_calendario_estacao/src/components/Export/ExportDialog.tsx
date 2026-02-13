/**
 * ExportDialog Component
 *
 * Provides buttons for PDF, Excel, and Print export
 */

import { useState } from 'preact/hooks';
import { lotsSignal } from '@/state/signals/lots';
import { handlingDatesSignal, cycleStartSignal } from '@/state/signals/conflicts';
import { generatePDF } from '@/services/export/pdf-generator';
import { generateExcel } from '@/services/export/excel-generator';

export function ExportDialog() {
  const [isExporting, setIsExporting] = useState(false);

  const lots = lotsSignal.value;
  const handlingDates = handlingDatesSignal.value;
  const cycleStart = cycleStartSignal.value;

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      generatePDF(lots, handlingDates, cycleStart);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Erro ao gerar PDF. Verifique o console para detalhes.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await generateExcel(lots, handlingDates);
    } catch (error) {
      console.error('Excel export error:', error);
      alert('Erro ao gerar Excel. Verifique o console para detalhes.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div class="flex flex-col gap-sm">
      <h3>Exportar</h3>

      <button
        type="button"
        class="btn-primary"
        onClick={handleExportPDF}
        disabled={isExporting || lots.length === 0}
      >
        {isExporting ? '⏳ Gerando...' : '📄 Exportar PDF'}
      </button>

      <button
        type="button"
        class="btn-primary"
        onClick={handleExportExcel}
        disabled={isExporting || lots.length === 0}
      >
        {isExporting ? '⏳ Gerando...' : '📊 Exportar Excel'}
      </button>

      <button
        type="button"
        class="btn-secondary"
        onClick={handlePrint}
        disabled={lots.length === 0}
      >
        🖨️ Imprimir
      </button>
    </div>
  );
}
