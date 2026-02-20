/**
 * LotForm Component
 *
 * Form for adding and managing breeding lots.
 * Displays current lots with ability to remove them.
 */

import { useState, useEffect } from 'preact/hooks';
import { lotsSignal, addLot, setLots } from '@/state/signals/lots';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { addDaysToDateOnly } from '@/core/date-engine/utils';
import { PREDEFINED_PROTOCOLS } from '@/domain/constants';
import { ExportDialog } from '@/components/Export/ExportDialog';
import { optimizerService } from '@/services/optimization/optimizer-service';
import {
  OptimizationErrorCode,
  OptimizationServiceError,
} from '@/services/optimization/optimizer-contract';
import {
  isOptimizingSignal,
  optimizationScenariosSignal,
  maxD0AdjustmentSignal,
  optimizationErrorSignal,
  setMaxD0Adjustment,
  setOptimizationScenarios,
  setOptimizationError,
  clearOptimizationError,
  clearOptimizationScenarios,
} from '@/state/signals/optimization';
import { OptimizationModal } from '@/components/Optimization/OptimizationModal';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';

const OPTIMIZATION_TIME_LIMIT_MS = 30000;
const OPTIMIZATION_HARD_TIMEOUT_MS = Math.max(
  Math.floor(OPTIMIZATION_TIME_LIMIT_MS * 1.25),
  OPTIMIZATION_TIME_LIMIT_MS + 5000
);
const OPTIMIZATION_HARD_TIMEOUT_SECONDS = Math.ceil(OPTIMIZATION_HARD_TIMEOUT_MS / 1000);

function getOptimizationErrorMessage(
  code: Exclude<OptimizationErrorCode, 'OK'>,
  fallbackMessage: string
): string {
  switch (code) {
    case 'OPTIMIZATION_TIMEOUT':
      return 'A otimizacao excedeu o tempo limite. Tente reduzir o numero de lotes ou execute novamente.';
    case 'OPTIMIZATION_IN_PROGRESS':
      return 'Ja existe uma otimizacao em andamento. Aguarde a execucao atual terminar.';
    case 'OPTIMIZATION_CANCELED':
      return 'A otimizacao foi cancelada antes da conclusao.';
    case 'OPTIMIZATION_VALIDATION_ERROR':
      return 'Nao foi possivel validar os dados de entrada para a otimizacao.';
    case 'OPTIMIZATION_WORKER_ERROR':
      return 'Falha no motor de otimizacao em segundo plano. Tente novamente.';
    case 'OPTIMIZATION_RUNTIME_ERROR':
    default:
      return fallbackMessage || 'Erro inesperado durante a otimizacao.';
  }
}

function getNextDefaultD0(): string {
  const lots = lotsSignal.value;
  if (lots.length > 0) {
    const lastD0 = lots[lots.length - 1]!.d0;
    return addDaysToDateOnly(lastD0, 1).toISOString();
  }
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0]!;
}

export function LotForm() {
  const lots = lotsSignal.value;
  const isOptimizing = isOptimizingSignal.value;
  const scenarios = optimizationScenariosSignal.value;
  const optimizationError = optimizationErrorSignal.value;
  const maxD0Adjustment = maxD0AdjustmentSignal.value;

  const [lotName, setLotName] = useState('');
  const [d0Date, setD0Date] = useState(getNextDefaultD0);
  const [selectedProtocolId, setSelectedProtocolId] = useState(PREDEFINED_PROTOCOLS[0]!.id);
  const [showValidationModal, setShowValidationModal] = useState(false);
  
  // Estados para UI de otimizacao
  const [timeLeft, setTimeLeft] = useState(OPTIMIZATION_HARD_TIMEOUT_SECONDS);
  const [optimizeMessage, setOptimizeMessage] = useState('Iniciando otimização...');

  // Efeito do timer
  useEffect(() => {
    let interval: number | undefined;
    if (isOptimizing) {
      setTimeLeft(OPTIMIZATION_HARD_TIMEOUT_SECONDS);
      interval = window.setInterval(() => {
        setTimeLeft((prev) => {
          const newState = prev > 0 ? prev - 1 : 0;
          const progressRatio =
            OPTIMIZATION_HARD_TIMEOUT_SECONDS > 0
              ? newState / OPTIMIZATION_HARD_TIMEOUT_SECONDS
              : 0;
          
          // Atualizar mensagem baseado no tempo restante
          if (progressRatio > 0.66) {
            setOptimizeMessage('Inicializando algoritmo genético...');
          } else if (progressRatio > 0.33) {
            setOptimizeMessage('Simulando milhares de combinações de datas...');
          } else if (newState > 0) {
            setOptimizeMessage('Refinando os 4 melhores cenários para você...');
          } else {
            setOptimizeMessage('Finalizando cálculos...');
          }
          
          return newState;
        });
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isOptimizing]);

  const handleSubmit = (e: Event) => {
    e.preventDefault();

    if (!lotName.trim()) {
      setShowValidationModal(true);
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

  /**
   * Handler de otimizacao
   */
  const handleOptimize = async () => {
    if (lots.length < 2) {
      setOptimizationError({
        code: 'OPTIMIZATION_VALIDATION_ERROR',
        message: 'Adicione pelo menos 2 lotes para otimizar.',
      });
      return;
    }

    try {
      isOptimizingSignal.value = true;
      clearOptimizationError();

      const { scenarios, totalCombinations } = await optimizerService.optimizeSchedule(
        lots,
        maxD0Adjustment,
        OPTIMIZATION_TIME_LIMIT_MS
      );

      setOptimizationScenarios(scenarios, { totalCombinations });
      clearOptimizationError();
    } catch (error) {
      console.error('Erro na otimizacao:', error);

      const serviceError =
        error instanceof OptimizationServiceError
          ? error
          : new OptimizationServiceError(
              'OPTIMIZATION_RUNTIME_ERROR',
              error instanceof Error ? error.message : 'Erro desconhecido durante a otimizacao.',
              { cause: error }
            );

      setOptimizationError({
        code: serviceError.code,
        message: getOptimizationErrorMessage(serviceError.code, serviceError.message),
        details: serviceError.details,
      });
    } finally {
      isOptimizingSignal.value = false;
    }
  };

  /**
   * Handler de aplicacao de cenario
   */
  const handleApplyScenario = (scenario: OptimizationScenario) => {
    setLots(scenario.lots);
    clearOptimizationScenarios();
  };

  /**
   * Handler de fechamento do modal
   */
  const handleCloseModal = () => {
    clearOptimizationScenarios();
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
            placeholder="Ex: Primiparas"
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
          <div class="flex flex-col gap-sm">
            <h3>Otimizar</h3>

            {/* Controle de ajuste maximo */}
            <div>
              <label htmlFor="maxAdjustment">
                Ajuste maximo de D0 ({maxD0Adjustment} dias)
              </label>
              <input
                id="maxAdjustment"
                type="range"
                min="1"
                max="30"
                value={maxD0Adjustment}
                onInput={(e) =>
                  setMaxD0Adjustment(Number((e.target as HTMLInputElement).value))
                }
              />
            </div>

            <button
              type="button"
              class="btn-primary"
              onClick={handleOptimize}
              disabled={lots.length < 2 || isOptimizing}
            >
              {isOptimizing ? (
                <span class="flex items-center gap-sm justify-center">
                  <span class="animate-spin">⏳</span> {timeLeft}s - {optimizeMessage}
                </span>
              ) : (
                'Otimizar Calendario'
              )}
            </button>

            {optimizationError && (
              <p class="text-error" role="alert">
                {optimizationError.message}
              </p>
            )}
          </div>

          <ExportDialog />
        </div>
      )}

      {/* Modal de cenarios otimizados */}
      {scenarios.length > 0 && (
        <OptimizationModal
          scenarios={scenarios}
          originalLots={lots}
          onApply={handleApplyScenario}
          onClose={handleCloseModal}
        />
      )}

      {showValidationModal && (
        <div class="modal-overlay" onClick={() => setShowValidationModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <p class="modal-message">Por favor, insira um nome para o lote.</p>
            <button type="button" class="btn-primary" onClick={() => setShowValidationModal(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
