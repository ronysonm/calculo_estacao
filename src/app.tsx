/**
 * Main App Component
 */

import { useEffect, useState } from 'preact/hooks';
import { LotForm } from '@/components/Forms/LotForm';
import { CalculationTable } from '@/components/Table/CalculationTable';
import { initializeDefaultLots, lotsSignal } from '@/state/signals/lots';
import { storage } from '@/services/persistence/storage';
import { cycleStartSignal } from '@/state/signals/conflicts';
import { formatDateBR, daysBetween } from '@/core/date-engine/utils';
import { DEFAULT_ROUNDS } from '@/domain/constants';
import { useConflictSummary } from '@/hooks/useConflicts';
import { usePersistence } from '@/hooks/usePersistence';
import { HolidaysModal } from '@/components/HolidaysModal/HolidaysModal';
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

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showHolidaysModal, setShowHolidaysModal] = useState(false);

  const handleReset = () => {
    initializeDefaultLots();
    setShowResetConfirm(false);
  };

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

            {/* Conflict summary + Feriados button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <div class="conflict-summary">
                {conflictSummary.total === 0 ? (
                  <span class="conflict-badge conflict-badge-none">{'\u2713'} Sem conflitos</span>
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
                        {conflictSummary.overlaps} sobreposic{conflictSummary.overlaps > 1 ? '\u00f5es' : '\u00e3o'}
                      </span>
                    )}
                    {conflictSummary.holidays > 0 && (
                      <span class="conflict-badge conflict-badge-holiday">
                        {conflictSummary.holidays} feriado{conflictSummary.holidays > 1 ? 's' : ''}
                      </span>
                    )}
                  </>
                )}
              </div>
              <button
                type="button"
                class="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={() => setShowHolidaysModal(true)}
              >
                Feriados
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: '250px',
            borderRight: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg)',
            overflowY: 'auto',
            padding: 'var(--spacing-sm)',
          }}
        >
          <LotForm />

          <div class="card" style={{ marginTop: 'var(--spacing-md)' }}>
            <button
              type="button"
              class="btn-secondary w-full"
              onClick={() => setShowResetConfirm(true)}
            >
              Resetar Lotes
            </button>
          </div>

          {showResetConfirm && (
            <div class="modal-overlay" onClick={() => setShowResetConfirm(false)}>
              <div class="modal" onClick={(e) => e.stopPropagation()}>
                <p class="modal-message">
                  Tem certeza que deseja resetar todos os lotes para o estado inicial?
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-sm)' }}>
                  <button
                    type="button"
                    class="btn-secondary"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    style={{ backgroundColor: 'var(--color-danger)', color: 'white', border: 'none', padding: 'var(--spacing-sm) var(--spacing-md)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                    onClick={handleReset}
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}
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
          padding: 'var(--spacing-xs) var(--spacing-md)',
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
            <span>Sobreposicao de lotes</span>
          </div>
          <div class="conflict-legend-item conflict-legend-holiday">
            <span class="conflict-legend-color"></span>
            <span>Feriado</span>
          </div>
        </div>
      </footer>

      {showHolidaysModal && (
        <HolidaysModal onClose={() => setShowHolidaysModal(false)} />
      )}
    </div>
  );
}
