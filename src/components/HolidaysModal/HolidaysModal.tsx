import { useState } from 'preact/hooks';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { NATIONAL_HOLIDAYS } from '@/domain/value-objects/Holiday';
import { customHolidaysSignal, setCustomHolidays } from '@/state/signals/conflicts';

interface HolidaysModalProps {
  onClose: () => void;
}

export function HolidaysModal({ onClose }: HolidaysModalProps) {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const customHolidays = customHolidaysSignal.value;

  const handleAdd = () => {
    if (!newDate || !newName.trim()) return;
    const parts = newDate.split('-');
    if (parts.length !== 3) return;
    const [yearStr, monthStr, dayStr] = parts;
    const year = parseInt(yearStr!, 10);
    const month = parseInt(monthStr!, 10);
    const day = parseInt(dayStr!, 10);
    if (!year || !month || !day) return;
    try {
      const date = DateOnly.create(year, month, day);
      if (customHolidays.some((h) => h.date.equals(date))) return;
      setCustomHolidays([...customHolidays, { date, name: newName.trim() }]);
      setNewDate('');
      setNewName('');
    } catch (e) {
      console.error('Data invalida', e);
    }
  };

  const handleRemove = (index: number) => {
    setCustomHolidays(customHolidays.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div
        class="modal"
        style={{ maxWidth: '480px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.125rem' }}>Feriados</h2>

        <h3 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
          Feriados Nacionais (Brasil)
        </h3>
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: 'var(--spacing-md)' }}>
          {NATIONAL_HOLIDAYS.map((h) => (
            <li
              key={h.name}
              style={{
                padding: '4px 0',
                borderBottom: '1px solid var(--color-border)',
                fontSize: '0.875rem',
              }}
            >
              <span style={{ color: 'var(--color-conflict-holiday)', fontWeight: 600 }}>
                {String(h.day).padStart(2, '0')}/{String(h.month).padStart(2, '0')}
              </span>
              {' \u00b7 '}{h.name}
            </li>
          ))}
        </ul>

        <h3 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
          Feriados Personalizados
        </h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-sm)' }}>
          <input
            type="date"
            value={newDate}
            onInput={(e) => setNewDate((e.target as HTMLInputElement).value)}
            style={{ flex: '0 0 auto', width: 'auto' }}
          />
          <input
            type="text"
            placeholder="Nome do feriado"
            value={newName}
            onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="button" class="btn-primary" onClick={handleAdd}>
            +
          </button>
        </div>

        {customHolidays.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Nenhum feriado personalizado adicionado.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {customHolidays.map((h, i) => (
              <li
                key={h.date.toISOString()}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                }}
              >
                <span>
                  <span style={{ color: 'var(--color-conflict-holiday)', fontWeight: 600 }}>
                    {String(h.date.day).padStart(2, '0')}/{String(h.date.month).padStart(2, '0')}/{h.date.year}
                  </span>
                  {' \u00b7 '}{h.name}
                </span>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-danger)',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    fontSize: '0.75rem',
                  }}
                  onClick={() => handleRemove(i)}
                >
                  {'\u2715'}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'right' }}>
          <button type="button" class="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
