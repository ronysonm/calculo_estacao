/**
 * LotForm Component
 *
 * Form for adding and managing breeding lots.
 * Displays current lots with ability to remove them.
 */

import { useState } from 'preact/hooks';
import { lotsSignal, addLot } from '@/state/signals/lots';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { addDaysToDateOnly } from '@/core/date-engine/utils';
import { PREDEFINED_PROTOCOLS } from '@/domain/constants';
import { ExportDialog } from '@/components/Export/ExportDialog';

function getNextDefaultD0(): string {
  const lots = lotsSignal.value;
  if (lots.length > 0) {
    const lastD0 = lots[lots.length - 1]!.d0;
    return addDaysToDateOnly(lastD0, 1).toISOString();
  }
  return new Date().toISOString().split('T')[0]!;
}

export function LotForm() {
  const lots = lotsSignal.value;

  const [lotName, setLotName] = useState('');
  const [d0Date, setD0Date] = useState(getNextDefaultD0);
  const [selectedProtocolId, setSelectedProtocolId] = useState(PREDEFINED_PROTOCOLS[0]!.id);

  const handleSubmit = (e: Event) => {
    e.preventDefault();

    if (!lotName.trim()) {
      alert('Por favor, insira um nome para o lote.');
      return;
    }

    // Parse date from input (yyyy-mm-dd)
    const parts = d0Date.split('-');
    const year = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10);
    const day = parseInt(parts[2]!, 10);
    const d0 = DateOnly.create(year, month, day);

    const protocol = PREDEFINED_PROTOCOLS.find((p) => p.id === selectedProtocolId)!;

    addLot(lotName, d0, protocol);

    // Reset form - advance D0 by 1 day for next lot
    setLotName('');
    setD0Date(addDaysToDateOnly(d0, 1).toISOString());
  };

  return (
    <div class="card">
      <h2>Gerenciar Lotes</h2>

      {/* Add lot form */}
      <form onSubmit={handleSubmit} class="flex flex-col gap-md mb-lg">
        <div>
          <label htmlFor="lotName">Nome do Lote</label>
          <input
            id="lotName"
            type="text"
            value={lotName}
            onInput={(e) => setLotName((e.target as HTMLInputElement).value)}
            placeholder="Ex: Primíparas"
          />
        </div>

        <div>
          <label htmlFor="d0Date">Data D0</label>
          <input
            id="d0Date"
            type="date"
            value={d0Date}
            onInput={(e) => setD0Date((e.target as HTMLInputElement).value)}
          />
        </div>

        <div>
          <label htmlFor="protocol">Protocolo</label>
          <select
            id="protocol"
            value={selectedProtocolId}
            onChange={(e) => setSelectedProtocolId((e.target as HTMLSelectElement).value)}
          >
            {PREDEFINED_PROTOCOLS.map((protocol) => (
              <option key={protocol.id} value={protocol.id}>
                {protocol.name}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" class="btn-primary">
          Adicionar Lote
        </button>
      </form>

      {/* Tools */}
      {lots.length > 0 && (
        <div class="flex flex-col gap-sm mb-lg">
          <ExportDialog />
        </div>
      )}

    </div>
  );
}
