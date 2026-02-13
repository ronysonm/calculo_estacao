import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';
import { Lot } from '@/domain/value-objects/Lot';

interface Props {
  scenarios: OptimizationScenario[];
  originalLots: Lot[];
  onApply: (scenario: OptimizationScenario) => void;
  onClose: () => void;
}

export function OptimizationModal({ scenarios, originalLots, onApply, onClose }: Props) {
  if (scenarios.length === 0) return null;

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div
        class="modal optimization-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Cenarios Otimizados</h2>
        <p class="text-muted mb-lg">
          Foram gerados {scenarios.length} cenario(s) otimizado(s). Escolha um para aplicar.
        </p>

        <div class="scenarios-grid">
          {scenarios.map((scenario, idx) => {
            const changes = scenario.getChanges(originalLots);

            return (
              <div key={idx} class="scenario-card">
                <h3 class="scenario-title">
                  Cenario {idx + 1}: {scenario.name}
                </h3>
                {scenario.description && (
                  <p class="scenario-description text-muted">
                    {scenario.description}
                  </p>
                )}

                <div class="scenario-metrics">
                  <div class="metric">
                    <span class="metric-label">Ciclo Total:</span>
                    <span class="metric-value">
                      {scenario.objectives.totalCycleDays} dias
                    </span>
                  </div>

                  <div class="metric">
                    <span class="metric-label">Domingos (R1-R2):</span>
                    <span
                      class={`metric-value ${
                        scenario.objectives.sundaysRounds12 === 0
                          ? 'text-success'
                          : 'text-warning'
                      }`}
                    >
                      {scenario.objectives.sundaysRounds12}
                    </span>
                  </div>

                  <div class="metric">
                    <span class="metric-label">Domingos (R3-R4):</span>
                    <span class="metric-value">
                      {scenario.objectives.sundaysRounds34}
                    </span>
                  </div>

                  <div class="metric">
                    <span class="metric-label">Sobreposicoes (R1-R2):</span>
                    <span
                      class={`metric-value ${
                        scenario.objectives.overlapsRounds12 === 0
                          ? 'text-success'
                          : 'text-error'
                      }`}
                    >
                      {scenario.objectives.overlapsRounds12}
                    </span>
                  </div>

                  <div class="metric">
                    <span class="metric-label">Sobreposicoes (R3-R4):</span>
                    <span
                      class={`metric-value ${
                        scenario.objectives.overlapsRounds34 === 0
                          ? 'text-success'
                          : 'text-warning'
                      }`}
                    >
                      {scenario.objectives.overlapsRounds34}
                    </span>
                  </div>
                </div>

                {changes.length > 0 && (
                  <div class="scenario-changes">
                    <h4>Mudancas:</h4>
                    <ul>
                      {changes.map((change) => (
                        <li key={change.lotId}>
                          <strong>{change.lotName}:</strong>{' '}
                          {change.oldD0} &rarr; {change.newD0}
                          <span
                            class={
                              change.daysDiff > 0 ? 'text-success' : 'text-warning'
                            }
                          >
                            {change.daysDiff > 0 ? ` (+${change.daysDiff})` : ` (${change.daysDiff})`} dias
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  class="btn-primary w-full mt-md"
                  onClick={() => onApply(scenario)}
                >
                  Aplicar Cenario
                </button>
              </div>
            );
          })}
        </div>

        <button class="btn-secondary w-full mt-lg" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
