import { Lot } from '@/domain/value-objects/Lot';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';

/**
 * Servico de otimizacao usando Web Worker
 */
export class OptimizerService {
  private worker: Worker | null = null;

  /**
   * Otimiza lotes usando Web Worker
   */
  async optimizeSchedule(
    lots: Lot[],
    maxD0Adjustment: number = 15,
    timeLimitMs: number = 5000
  ): Promise<OptimizationScenario[]> {
    return new Promise((resolve, reject) => {
      // Criar worker
      this.worker = new Worker(
        new URL('@/workers/optimizer.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Timeout de seguranca (worker + 1s)
      const timeout = setTimeout(() => {
        this.worker?.terminate();
        reject(new Error('Timeout de otimizacao'));
      }, timeLimitMs + 1000);

      // Receber resultado
      this.worker.onmessage = (e: MessageEvent) => {
        clearTimeout(timeout);

        if (e.data.success) {
          // Deserializar cenarios
          const scenarios = (e.data.scenarios as Array<{
            name: string;
            description: string;
            lots: Parameters<typeof Lot.fromJSON>[0][];
            objectives: OptimizationScenario['objectives'];
            fitness: number;
          }>).map((data) =>
            OptimizationScenario.create(
              data.name,
              data.lots.map((lotData) => Lot.fromJSON(lotData)),
              data.objectives,
              data.fitness,
              data.description
            )
          );

          resolve(scenarios);
        } else {
          reject(new Error(e.data.error || 'Erro na otimizacao'));
        }

        this.worker?.terminate();
        this.worker = null;
      };

      // Erro no worker
      this.worker.onerror = (error) => {
        clearTimeout(timeout);
        this.worker?.terminate();
        this.worker = null;
        reject(error);
      };

      // Enviar mensagem
      this.worker.postMessage({
        lots: lots.map((lot) => lot.toJSON()),
        maxD0Adjustment,
        timeLimitMs,
      });
    });
  }

  /**
   * Cancela otimizacao em andamento
   */
  cancel(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * Instancia singleton
 */
export const optimizerService = new OptimizerService();
