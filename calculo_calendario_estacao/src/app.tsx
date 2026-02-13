/**
 * Main App Component
 */

import { useEffect } from 'preact/hooks';
import { LotForm } from '@/components/Forms/LotForm';
import { CalculationTable } from '@/components/Table/CalculationTable';
import { initializeDefaultLots, lotsSignal } from '@/state/signals/lots';
import { storage } from '@/services/persistence/storage';
import { cycleStartSignal } from '@/state/signals/conflicts';
import { formatDateBR, daysBetween } from '@/core/date-engine/utils';
import { DEFAULT_ROUNDS } from '@/domain/constants';
import { useConflictSummary } from '@/hooks/useConflicts';
import { usePersistence } from '@/hooks/usePersistence';
import '@/styles/global.css';
import '@/styles/conflicts.css';
import '@/styles/print.css';

export function App() {
  // Enable auto-save/load
  usePersistence();

  // Initialize default lots only on first visit (no saved data at all)
  useEffect(() => {
    setTimeout(() => {
      if (!storage.hasSavedData()) {
        initializeDefaultLots();
      }
    }, 100);
  }, []);

  const conflictSummary = useConflictSummary();
  const cycleStart = cycleStartSignal.value;
  const lots = lotsSignal.value;

  // Total de dias do ciclo = maior dia do ciclo entre todos os lotes
  let totalCycleDays = 0;
  if (cycleStart && lots.length > 0) {
    for (const lot of lots) {
      const lotOffset = daysBetween(cycleStart, lot.d0);
      const lastProtocolDay = lot.protocol.intervals[lot.protocol.intervals.length - 1] ?? 0;
      const lastRoundOffset = lot.getRoundStartOffset(DEFAULT_ROUNDS - 1);
      const lotMaxDay = lotOffset + lastRoundOffset + lastProtocolDay;
      if (lotMaxDay > totalCycleDays) totalCycleDays = lotMaxDay;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Print-only header */}
      <div class="print-header" style={{ display: 'none' }}>
        <div class="print-header-title">Calendário de Estação IATF</div>
        {cycleStart && (
          <div class="print-header-cycle">
            Início do ciclo: {formatDateBR(cycleStart)} | Total de dias: {totalCycleDays}
          </div>
        )}
      </div>

      {/* Header */}
      <header
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid var(--color-border)',
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div class="container" style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ marginBottom: '0.125rem', fontSize: '1.25rem', lineHeight: '1.5rem' }}>Calculadora de Estação IATF</h1>
              <p class="text-secondary" style={{ fontSize: '0.75rem' }}>
                Planejamento automático de manejos para pecuária de corte
              </p>
              {cycleStart && (
                <div class="cycle-start-bar" style={{ marginTop: 'var(--spacing-sm)' }}>
                  <span class="cycle-start-label">Inicio do ciclo:</span>
                  <span class="cycle-start-date">{formatDateBR(cycleStart)}</span>
                  {totalCycleDays > 0 && (
                    <>
                      <span class="cycle-start-label" style={{ marginLeft: 'var(--spacing-md)' }}>Total de dias:</span>
                      <span class="cycle-start-date">{totalCycleDays}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Conflict summary */}
            <div class="conflict-summary">
              {conflictSummary.total === 0 ? (
                <span class="conflict-badge conflict-badge-none">✓ Sem conflitos</span>
              ) : (
                <>
                  <span style={{ fontWeight: 500 }}>
                    {conflictSummary.total} conflito{conflictSummary.total > 1 ? 's' : ''}
                  </span>
                  {conflictSummary.sundays > 0 && (
                    <span class="conflict-badge conflict-badge-sunday">
                      {conflictSummary.sundays} domingo{conflictSummary.sundays > 1 ? 's' : ''}
                    </span>
                  )}
                  {conflictSummary.overlaps > 0 && (
                    <span class="conflict-badge conflict-badge-overlap">
                      {conflictSummary.overlaps} sobreposiç{conflictSummary.overlaps > 1 ? 'ões' : 'ão'}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: '350px',
            borderRight: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg)',
            overflowY: 'auto',
            padding: 'var(--spacing-lg)',
          }}
        >
          <LotForm />
        </aside>

        {/* Table area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--spacing-lg)',
          }}
        >
          <CalculationTable />
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          backgroundColor: 'white',
          borderTop: '1px solid var(--color-border)',
          padding: 'var(--spacing-md) var(--spacing-lg)',
          textAlign: 'center',
        }}
      >
        <div class="conflict-legend">
          <div class="conflict-legend-item conflict-legend-sunday">
            <span class="conflict-legend-color"></span>
            <span>Domingo</span>
          </div>
          <div class="conflict-legend-item conflict-legend-overlap">
            <span class="conflict-legend-color"></span>
            <span>Sobreposição de lotes</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
