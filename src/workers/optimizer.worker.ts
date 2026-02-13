import { Lot } from '@/domain/value-objects/Lot';
import { GeneticScheduler } from '@/core/optimization/genetic-scheduler';
import { GeneticParams, DEFAULT_GA_PARAMS } from '@/core/optimization/types';

/**
 * Mensagem recebida pelo worker
 */
interface WorkerMessage {
  lots: Parameters<typeof Lot.fromJSON>[0][];
  maxD0Adjustment?: number;
  timeLimitMs?: number;
}

/**
 * Web Worker para otimizacao
 */
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  try {
    const { lots: lotsData, maxD0Adjustment = 15, timeLimitMs = 5000 } = e.data;

    // Deserializar lotes
    const lots = lotsData.map((data) => Lot.fromJSON(data));

    // Criar scheduler
    const params: GeneticParams = {
      ...DEFAULT_GA_PARAMS,
      maxD0Adjustment,
      timeLimitMs,
    };

    const scheduler = new GeneticScheduler(lots, params);

    // Otimizar
    const scenarios = await scheduler.optimize();

    // Serializar e enviar resultado
    const serializedScenarios = scenarios.map((scenario) => ({
      name: scenario.name,
      description: scenario.description,
      lots: scenario.lots.map((lot) => lot.toJSON()),
      objectives: scenario.objectives,
      fitness: scenario.fitness,
    }));

    self.postMessage({
      success: true,
      scenarios: serializedScenarios,
    });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
};
