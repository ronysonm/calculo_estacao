/**
 * CalculationTable Component
 *
 * Custom HTML table matching the Excel model layout.
 * Each lot gets 3 rows: Dia (weekday), Data (date), Dia do ciclo (cycle day).
 * Between rounds, gap controls with +/- buttons allow adjusting intervals.
 */

import { useState, useRef, useEffect } from 'preact/hooks';
import { lotsSignal, changeLotRoundGap, changeLotD0, renameLot, changeLotProtocol, removeLot, changeLotAnimalCount } from '@/state/signals/lots';
import { roundSuccessRatesSignal, setRoundSuccessRate } from '@/state/signals/success-rates';
import { handlingDatesSignal, cycleStartSignal, allHolidaysSignal } from '@/state/signals/conflicts';
import { getDayOfWeekName, formatDateBR, addDaysToDateOnly, daysBetween } from '@/core/date-engine/utils';
import { getConflictTypeForCell } from '@/core/conflict/detector';
import { DEFAULT_ROUNDS, ROUND_NAMES, PREDEFINED_PROTOCOLS, GESTACAO_DIAS, MIN_ROUND_GAP, MAX_ROUND_GAP } from '@/domain/constants';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { Lot } from '@/domain/value-objects/Lot';
import { HandlingDate } from '@/domain/value-objects/HandlingDate';
import '@/styles/table.css';

function SuccessRateDisplay({ roundIdx, rate, totalAnimals }: { roundIdx: number; rate: number; totalAnimals: number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const val = parseInt(editValue) || 0;
    setRoundSuccessRate(roundIdx, val);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div class="success-rate-control">
        <label class="success-rate-label">Taxa:</label>
        <input
          ref={inputRef}
          type="number"
          class="success-rate-input"
          min="0"
          max="100"
          value={editValue}
          onInput={(e) => setEditValue((e.target as HTMLInputElement).value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
        />
        <span class="success-rate-percent">%</span>
      </div>
    );
  }

  return (
    <div
      class="success-rate-display"
      onDblClick={() => {
        setEditValue(String(rate));
        setIsEditing(true);
      }}
      title="Duplo clique para editar"
    >
      <span class="success-rate-text">Taxa {rate}% | {totalAnimals} Animais</span>
    </div>
  );
}

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editD0, setEditD0] = useState('');
  const [editProtocolId, setEditProtocolId] = useState('');
  const [editAnimalCount, setEditAnimalCount] = useState(100);

  const openEditModal = () => {
    setEditName(lot.name);
    setEditD0(lot.d0.toISOString());
    setEditProtocolId(lot.protocol.id);
    setEditAnimalCount(lot.animalCount);
    setIsEditModalOpen(true);
  };

  const handleSave = () => {
    if (editName !== lot.name) {
      renameLot(lot.id, editName);
    }
    const currentD0Iso = lot.d0.toISOString();
    if (editD0 !== currentD0Iso) {
      const newD0 = DateOnly.fromISOString(editD0);
      changeLotD0(lot.id, newD0);
    }
    if (editProtocolId !== lot.protocol.id) {
      const newProtocol = PREDEFINED_PROTOCOLS.find((p) => p.id === editProtocolId);
      if (newProtocol) {
        changeLotProtocol(lot.id, newProtocol);
      }
    }
    if (editAnimalCount !== lot.animalCount) {
      changeLotAnimalCount(lot.id, editAnimalCount);
    }
    setIsEditModalOpen(false);
  };

  const protocolDays = lot.protocol.intervals;

  // Group handling dates by round
  const datesByRound: Map<number, HandlingDate[]> = new Map();
  for (const hd of handlingDates) {
    const existing = datesByRound.get(hd.roundId) || [];
    existing.push(hd);
    datesByRound.set(hd.roundId, existing);
  }

  const handleGapChange = (gapIndex: number, delta: number) => {
    const currentGap = lot.roundGaps[gapIndex] ?? 22;
    const newGap = Math.min(MAX_ROUND_GAP, Math.max(MIN_ROUND_GAP, currentGap + delta));
    changeLotRoundGap(lot.id, gapIndex, newGap);
  };

  const handleD0Change = (delta: number) => {
    const newD0 = addDaysToDateOnly(lot.d0, delta);
    changeLotD0(lot.id, newD0);
  };

  // Calculate "Dia do ciclo" values relative to the global cycle start date
  const lotOffset = daysBetween(cycleStart, lot.d0);
  const getCycleDays = (roundIdx: number): number[] => {
    const startOffset = lot.getRoundStartOffset(roundIdx);
    return protocolDays.map((pd) => lotOffset + startOffset + pd);
  };

  const animalsPerRound = lot.getAnimalsPerRound(successRates, DEFAULT_ROUNDS);

  return (
    <div class="lot-block">
      {/* Header row with protocol day labels for each round */}
      <table class="lot-table">
        <thead>
          {/* Round headers */}
          <tr class="round-header-row">
            <th class="lot-label-header"></th>
            <th class="row-label-header"></th>
            {Array.from({ length: DEFAULT_ROUNDS }).map((_, roundIdx) => (
              <>
                {protocolDays.map((pd) => (
                  <th key={`rh-${roundIdx}-${pd}`} class="round-header-cell">
                    {roundIdx === 0 && pd === protocolDays[0] ? '' : ''}
                  </th>
                ))}
                {roundIdx < DEFAULT_ROUNDS - 1 && (
                  <th class="gap-header-cell"></th>
                )}
              </>
            ))}
          </tr>
          {/* Protocol day headers */}
          <tr class="protocol-header-row">
            <th class="lot-label-header"></th>
            <th class="row-label-header"></th>
            {Array.from({ length: DEFAULT_ROUNDS }).map((_, roundIdx) => (
              <>
                {protocolDays.map((pd) => (
                  <th key={`ph-${roundIdx}-${pd}`} class="protocol-header-cell">
                    D{pd}
                  </th>
                ))}
                {roundIdx < DEFAULT_ROUNDS - 1 && (
                  <th class="gap-header-cell"></th>
                )}
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Row 1: Dia (weekday) */}
          <tr class="dia-row">
            <td class="lot-name-cell" rowSpan={4}>
              <span class="lot-name-text" onDblClick={openEditModal} title="Duplo clique para editar">{lot.name}</span>
              <div class="d0-controls">
                <button
                  type="button"
                  class="d0-btn d0-btn-minus"
                  onClick={() => handleD0Change(-1)}
                  title="Recuar 1 dia"
                >
                  -1
                </button>
                <span class="d0-value">{formatDateBR(lot.d0)}</span>
                <button
                  type="button"
                  class="d0-btn d0-btn-plus"
                  onClick={() => handleD0Change(1)}
                  title="Avançar 1 dia"
                >
                  +1
                </button>
              </div>
            </td>
            <td class="row-label-cell">Dia</td>
            {Array.from({ length: DEFAULT_ROUNDS }).map((_, roundIdx) => {
              const roundDates = datesByRound.get(roundIdx) || [];
              return (
                <>
                  {protocolDays.map((pd) => {
                    const hd = roundDates.find((h) => h.protocolDay === pd);
                    const dayName = hd ? getDayOfWeekName(hd.date) : '';
                    const conflictType = hd
                      ? getConflictTypeForCell(hd.date, lot.id, allHandlingDates, allHolidaysSignal.value)
                      : null;
                    return (
                      <td
                        key={`dia-${roundIdx}-${pd}`}
                        class={`data-cell dia-cell ${conflictType ? `conflict-${conflictType}` : ''}`}
                      >
                        {dayName}
                      </td>
                    );
                  })}
                  {roundIdx < DEFAULT_ROUNDS - 1 && (
                    <td class="gap-cell gap-buttons-cell" rowSpan={4}>
                      <div class="gap-controls">
                        <button
                          type="button"
                          class="gap-btn gap-btn-minus"
                          onClick={() => handleGapChange(roundIdx, -1)}
                          title="Menos 1 dia"
                          disabled={(lot.roundGaps[roundIdx] ?? 22) <= MIN_ROUND_GAP}
                        >
                          -1
                        </button>
                        <span class="gap-value">{lot.roundGaps[roundIdx] ?? 22}</span>
                        <button
                          type="button"
                          class="gap-btn gap-btn-plus"
                          onClick={() => handleGapChange(roundIdx, 1)}
                          title="Mais 1 dia"
                          disabled={(lot.roundGaps[roundIdx] ?? 22) >= MAX_ROUND_GAP}
                        >
                          +1
                        </button>
                        <span class="gap-unit">dias</span>
                      </div>
                    </td>
                  )}
                </>
              );
            })}
          </tr>

          {/* Row 2: Data (date) */}
          <tr class="data-row">
            <td class="row-label-cell">Data</td>
            {Array.from({ length: DEFAULT_ROUNDS }).map((_, roundIdx) => {
              const roundDates = datesByRound.get(roundIdx) || [];
              return (
                <>
                  {protocolDays.map((pd) => {
                    const hd = roundDates.find((h) => h.protocolDay === pd);
                    const dateStr = hd ? formatDateBR(hd.date) : '';
                    const conflictType = hd
                      ? getConflictTypeForCell(hd.date, lot.id, allHandlingDates, allHolidaysSignal.value)
                      : null;
                    return (
                      <td
                        key={`data-${roundIdx}-${pd}`}
                        class={`data-cell date-value-cell ${conflictType ? `conflict-${conflictType}` : ''}`}
                      >
                        {dateStr}
                      </td>
                    );
                  })}
                </>
              );
            })}
          </tr>

          {/* Row 3: Dia do ciclo (cycle day) */}
          <tr class="ciclo-row">
            <td class="row-label-cell">Dia do ciclo</td>
            {Array.from({ length: DEFAULT_ROUNDS }).map((_, roundIdx) => {
              const cycleDays = getCycleDays(roundIdx);
              return (
                <>
                  {cycleDays.map((cd, pdIdx) => (
                    <td
                      key={`ciclo-${roundIdx}-${pdIdx}`}
                      class="data-cell ciclo-cell"
                    >
                      {cd}
                    </td>
                  ))}
                </>
              );
            })}
          </tr>

          {/* Row 4: Qtd. Animais + Prov. Parição (merged) */}
          <tr class="animais-paricao-row">
            <td class="row-label-cell row-label-bottom"></td>
            {Array.from({ length: DEFAULT_ROUNDS }).map((_, roundIdx) => {
              const count = animalsPerRound[roundIdx] ?? 0;
              const lastPd = protocolDays[protocolDays.length - 1] ?? 0;
              const startOffset = lot.getRoundStartOffset(roundIdx);
              const paricaoDate = addDaysToDateOnly(lot.d0, startOffset + lastPd + GESTACAO_DIAS);
              return (
                <>
                  {protocolDays.map((_pd, pdIdx) => {
                    const isFirst = pdIdx === 0;
                    const isMiddle = pdIdx > 0 && pdIdx < protocolDays.length - 1;
                    const isLast = pdIdx === protocolDays.length - 1;
                    return (
                      <td
                        key={`ap-${roundIdx}-${pdIdx}`}
                        class={`data-cell animais-paricao-cell${isFirst ? ' animais-count-cell' : ''}${isLast ? ' paricao-date-cell' : ''}${isMiddle ? ' paricao-label-cell' : ''}`}
                        title={isLast ? `Min ${formatDateBR(addDaysToDateOnly(paricaoDate, -15))} - Max ${formatDateBR(addDaysToDateOnly(paricaoDate, 15))}` : undefined}
                      >
                        {isFirst ? `${count} Anim.` : isMiddle ? 'Prov. Parição' : isLast ? formatDateBR(paricaoDate) : ''}
                      </td>
                    );
                  })}
                </>
              );
            })}
          </tr>
        </tbody>
      </table>

      {isEditModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            class="card"
            style={{ maxWidth: '400px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Editar Lote</h3>
            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600, fontSize: '0.875rem' }}>
                Nome do lote
              </label>
              <input
                type="text"
                style={{ width: '100%', padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                value={editName}
                onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
              />
            </div>
            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600, fontSize: '0.875rem' }}>
                Data de inicio (D0)
              </label>
              <input
                type="date"
                style={{ width: '100%', padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                value={editD0}
                onInput={(e) => setEditD0((e.target as HTMLInputElement).value)}
              />
            </div>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600, fontSize: '0.875rem' }}>
                Protocolo
              </label>
              <select
                style={{ width: '100%', padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                value={editProtocolId}
                onChange={(e) => setEditProtocolId((e.target as HTMLSelectElement).value)}
              >
                {PREDEFINED_PROTOCOLS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-danger, #dc3545)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                }}
                onClick={() => setIsConfirmRemoveOpen(true)}
              >
                Remover lote
              </button>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <button type="button" class="btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                  Cancelar
                </button>
                <button type="button" class="btn-primary" onClick={handleSave}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isConfirmRemoveOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
          onClick={() => setIsConfirmRemoveOpen(false)}
        >
          <div
            class="card"
            style={{ maxWidth: '360px', width: '90%', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>Remover lote</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-md)', color: 'var(--color-text-secondary, #555)' }}>
              Tem certeza que deseja remover o lote <strong>{lot.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-sm)' }}>
              <button type="button" class="btn-secondary" onClick={() => setIsConfirmRemoveOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: 'var(--color-danger, #dc3545)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  removeLot(lot.id);
                  setIsConfirmRemoveOpen(false);
                  setIsEditModalOpen(false);
                }}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CalculationTable() {
  const lots = lotsSignal.value;
  const allHandlingDates = handlingDatesSignal.value;
  const successRates = roundSuccessRatesSignal.value;

  if (lots.length === 0) {
    return (
      <div class="calculation-table-container">
        <div class="table-empty">
          <div class="table-empty-text">Nenhum lote adicionado</div>
          <div class="table-empty-hint">
            Adicione lotes usando o formulario ao lado para comecar a calcular as datas de manejo.
          </div>
        </div>
      </div>
    );
  }

  const cycleStart = cycleStartSignal.value ?? lots[0]!.d0;

  // Compute total animals per round across all lots
  const totalAnimalsPerRound = Array.from({ length: DEFAULT_ROUNDS }, () => 0);
  for (const lot of lots) {
    const perRound = lot.getAnimalsPerRound(successRates);
    for (let i = 0; i < DEFAULT_ROUNDS; i++) {
      totalAnimalsPerRound[i] = (totalAnimalsPerRound[i] ?? 0) + (perRound[i] ?? 0);
    }
  }

  return (
    <div class="calculation-table-container">
      {/* Round headers at the top */}
      <div class="round-headers-bar">
        <div class="round-headers-spacer"></div>
        {Array.from({ length: DEFAULT_ROUNDS }).map((_, roundIdx) => (
          <>
            <div key={`rnd-${roundIdx}`} class="round-header-label">
              <span>{ROUND_NAMES[roundIdx]}</span>
              <SuccessRateDisplay roundIdx={roundIdx} rate={successRates[roundIdx] ?? 0} totalAnimals={totalAnimalsPerRound[roundIdx]!} />
            </div>
            {roundIdx < DEFAULT_ROUNDS - 1 && (
              <div class="round-header-gap-spacer"></div>
            )}
          </>
        ))}
      </div>

      {/* One block per lot */}
      <div class="lots-container">
        {lots.map((lot) => {
          const lotHandlingDates = allHandlingDates.filter(
            (hd) => hd.lotId === lot.id
          );
          return (
            <LotBlock
              key={lot.id}
              lot={lot}
              handlingDates={lotHandlingDates}
              allHandlingDates={allHandlingDates}
              cycleStart={cycleStart}
              successRates={successRates}
            />
          );
        })}
      </div>
    </div>
  );
}
