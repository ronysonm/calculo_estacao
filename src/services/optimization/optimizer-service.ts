import { Lot } from '@/domain/value-objects/Lot';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';
import {
  OptimizationErrorCode,
  OptimizationServiceError,
  OptimizerWorkerErrorResponse,
  OptimizerWorkerRequest,
  OptimizerWorkerResponse,
  OptimizerWorkerSuccessResponse,
} from './optimizer-contract';

interface ActiveOptimizationRequest {
  requestId: string;
  worker: Worker;
  timeoutId: ReturnType<typeof setTimeout>;
  settled: boolean;
  reject: (error: OptimizationServiceError) => void;
}

const OPTIMIZATION_CODES = new Set<OptimizationErrorCode>([
  'OK',
  'OPTIMIZATION_TIMEOUT',
  'OPTIMIZATION_IN_PROGRESS',
  'OPTIMIZATION_CANCELED',
  'OPTIMIZATION_VALIDATION_ERROR',
  'OPTIMIZATION_RUNTIME_ERROR',
  'OPTIMIZATION_WORKER_ERROR',
]);

/**
 * Servico de otimizacao usando Web Worker
 */
export class OptimizerService {
  private activeRequest: ActiveOptimizationRequest | null = null;
  private requestSequence = 0;

  /**
   * Otimiza lotes usando Web Worker
   */
  async optimizeSchedule(
    lots: Lot[],
    maxD0Adjustment: number = 15,
    timeLimitMs: number = 30000
  ): Promise<{ scenarios: OptimizationScenario[]; totalCombinations: number }> {
    this.rejectIfBusy();

    const requestId = this.nextRequestId();
    const normalizedTimeLimitMs =
      Number.isFinite(timeLimitMs) && timeLimitMs > 0 ? Math.floor(timeLimitMs) : 30000;
    const normalizedMaxD0Adjustment =
      Number.isFinite(maxD0Adjustment) && maxD0Adjustment > 0
        ? Math.floor(maxD0Adjustment)
        : 15;
    const hardTimeoutMs = this.computeHardTimeoutMs(normalizedTimeLimitMs);
    const worker = new Worker(new URL('@/workers/optimizer.worker.ts', import.meta.url), {
      type: 'module',
    });

    return new Promise((resolve, reject) => {
      const context: ActiveOptimizationRequest = {
        requestId,
        worker,
        timeoutId: setTimeout(() => undefined, 0),
        settled: false,
        reject: () => undefined,
      };

      const settle = this.settleOnce(context, resolve, reject);
      context.reject = settle.reject;
      context.timeoutId = setTimeout(() => {
        settle.reject(
          this.createOptimizationError(
            'OPTIMIZATION_TIMEOUT',
            `Tempo limite excedido (${hardTimeoutMs}ms).`,
            {
              requestId,
              timeLimitMs: normalizedTimeLimitMs,
              hardTimeoutMs,
            }
          )
        );
      }, hardTimeoutMs);

      this.activeRequest = context;

      worker.onmessage = (event: MessageEvent<unknown>) => {
        const response = this.parseWorkerResponse(event.data);
        if (!response) {
          settle.reject(
            this.createOptimizationError(
              'OPTIMIZATION_WORKER_ERROR',
              'Resposta invalida recebida do worker.',
              { requestId }
            )
          );
          return;
        }

        if (response.requestId !== requestId) {
          return;
        }

        if (response.success) {
          try {
            const scenarios = response.scenarios.map((scenario) =>
              OptimizationScenario.create(
                scenario.name,
                scenario.lots.map((lotData) =>
                  Lot.fromJSON(lotData as Parameters<typeof Lot.fromJSON>[0])
                ),
                scenario.objectives,
                scenario.fitness,
                scenario.description
              )
            );

            settle.resolve({
              scenarios,
              totalCombinations: Math.max(0, Math.floor(response.totalCombinations)),
            });
          } catch (error) {
            settle.reject(
              this.createOptimizationError(
                'OPTIMIZATION_RUNTIME_ERROR',
                'Falha ao processar cenarios otimizados.',
                {
                  requestId,
                  cause: error instanceof Error ? error.message : String(error),
                }
              )
            );
          }

          return;
        }

        settle.reject(
          this.createOptimizationError(
            response.code,
            response.message,
            response.details
          )
        );
      };

      worker.onerror = (event: ErrorEvent) => {
        settle.reject(
          this.createOptimizationError(
            'OPTIMIZATION_WORKER_ERROR',
            event.message || 'Erro inesperado no worker de otimizacao.',
            {
              requestId,
              filename: event.filename,
              line: event.lineno,
              column: event.colno,
            }
          )
        );
      };

      try {
        const request: OptimizerWorkerRequest = {
          requestId,
          lots: lots.map((lot) => lot.toJSON()),
          maxD0Adjustment: normalizedMaxD0Adjustment,
          timeLimitMs: normalizedTimeLimitMs,
        };
        worker.postMessage(request);
      } catch (error) {
        settle.reject(
          this.createOptimizationError(
            'OPTIMIZATION_RUNTIME_ERROR',
            'Falha ao iniciar otimizacao no worker.',
            {
              requestId,
              cause: error instanceof Error ? error.message : String(error),
            }
          )
        );
      }
    });
  }

  /**
   * Cancela otimizacao em andamento
   */
  cancel(): void {
    const activeRequest = this.activeRequest;
    if (!activeRequest) {
      return;
    }

    activeRequest.worker.terminate();
    activeRequest.reject(
      this.createOptimizationError('OPTIMIZATION_CANCELED', 'Otimizacao cancelada pelo usuario.', {
        requestId: activeRequest.requestId,
      })
    );
  }

  private nextRequestId(): string {
    this.requestSequence += 1;
    return `optimization-${Date.now()}-${this.requestSequence}`;
  }

  private computeHardTimeoutMs(timeLimitMs: number): number {
    return Math.max(Math.floor(timeLimitMs * 1.25), timeLimitMs + 5000);
  }

  private rejectIfBusy(): void {
    if (this.activeRequest && !this.activeRequest.settled) {
      throw this.createOptimizationError(
        'OPTIMIZATION_IN_PROGRESS',
        'Ja existe uma otimizacao em andamento.'
      );
    }
  }

  private settleOnce<T>(
    context: ActiveOptimizationRequest,
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void
  ): {
    resolve: (value: T) => void;
    reject: (error: OptimizationServiceError) => void;
  } {
    const cleanup = () => {
      clearTimeout(context.timeoutId);
      context.worker.onmessage = null;
      context.worker.onerror = null;
      context.worker.terminate();

      if (this.activeRequest?.requestId === context.requestId) {
        this.activeRequest = null;
      }
    };

    return {
      resolve: (value: T) => {
        if (context.settled) {
          return;
        }

        context.settled = true;
        cleanup();
        resolve(value);
      },
      reject: (error: OptimizationServiceError) => {
        if (context.settled) {
          return;
        }

        context.settled = true;
        cleanup();
        reject(error);
      },
    };
  }

  private createOptimizationError(
    code: Exclude<OptimizationErrorCode, 'OK'>,
    message: string,
    details?: unknown
  ): OptimizationServiceError {
    return new OptimizationServiceError(code, message, details);
  }

  private parseWorkerResponse(payload: unknown): OptimizerWorkerResponse | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const response = payload as Record<string, unknown>;

    if (typeof response.success !== 'boolean') {
      return null;
    }

    if (typeof response.requestId !== 'string') {
      return null;
    }

    if (
      typeof response.code !== 'string' ||
      !OPTIMIZATION_CODES.has(response.code as OptimizationErrorCode)
    ) {
      return null;
    }

    if (typeof response.elapsedMs !== 'number' || Number.isNaN(response.elapsedMs)) {
      return null;
    }

    if (response.success) {
      if (response.code !== 'OK') {
        return null;
      }

      if (!Array.isArray(response.scenarios)) {
        return null;
      }

      if (typeof response.totalCombinations !== 'number') {
        return null;
      }

      const parsed: OptimizerWorkerSuccessResponse = {
        success: true,
        requestId: response.requestId,
        code: 'OK',
        elapsedMs: response.elapsedMs,
        scenarios: response.scenarios as OptimizerWorkerSuccessResponse['scenarios'],
        totalCombinations: response.totalCombinations,
      };

      return parsed;
    }

    if (response.code === 'OK') {
      return null;
    }

    if (typeof response.message !== 'string') {
      return null;
    }

    const parsed: OptimizerWorkerErrorResponse = {
      success: false,
      requestId: response.requestId,
      code: response.code as Exclude<OptimizationErrorCode, 'OK'>,
      message: response.message,
      details: response.details,
      elapsedMs: response.elapsedMs,
    };

    return parsed;
  }
}

/**
 * Instancia singleton
 */
export const optimizerService = new OptimizerService();
