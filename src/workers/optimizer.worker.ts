import { Lot } from '@/domain/value-objects/Lot';
import { optimizeWithHybridEngine } from '@/core/optimization/hybrid-scheduler';
import { GeneticParams, DEFAULT_GA_PARAMS } from '@/core/optimization/types';
import {
  OptimizationErrorCode,
  OptimizerWorkerErrorResponse,
  OptimizerWorkerRequest,
  OptimizerWorkerSuccessResponse,
} from '@/services/optimization/optimizer-contract';

/**
 * Tipos validos de protocolo
 */
const PROTOCOL_TYPES = new Set(['D0-D7-D9', 'D0-D8-D10', 'D0-D9-D11', 'custom']);

const ERROR_CODES = new Set<Exclude<OptimizationErrorCode, 'OK'>>([
  'OPTIMIZATION_TIMEOUT',
  'OPTIMIZATION_IN_PROGRESS',
  'OPTIMIZATION_CANCELED',
  'OPTIMIZATION_VALIDATION_ERROR',
  'OPTIMIZATION_RUNTIME_ERROR',
  'OPTIMIZATION_WORKER_ERROR',
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSerializedLot(value: unknown): value is OptimizerWorkerRequest['lots'][number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const lot = value as Record<string, unknown>;
  const d0 = lot.d0 as Record<string, unknown> | undefined;
  const protocol = lot.protocol as Record<string, unknown> | undefined;

  if (typeof lot.id !== 'string' || lot.id.length === 0) {
    return false;
  }

  if (typeof lot.name !== 'string' || lot.name.length === 0) {
    return false;
  }

  if (!d0 || !isFiniteNumber(d0.year) || !isFiniteNumber(d0.month) || !isFiniteNumber(d0.day)) {
    return false;
  }

  if (!protocol) {
    return false;
  }

  if (typeof protocol.id !== 'string' || typeof protocol.name !== 'string') {
    return false;
  }

  if (!Array.isArray(protocol.intervals) || !protocol.intervals.every(isFiniteNumber)) {
    return false;
  }

  if (typeof protocol.type !== 'string' || !PROTOCOL_TYPES.has(protocol.type)) {
    return false;
  }

  if (!Array.isArray(lot.roundGaps) || !lot.roundGaps.every(isFiniteNumber)) {
    return false;
  }

  return true;
}

function resolveRequestId(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const requestId = (payload as { requestId?: unknown }).requestId;
    if (typeof requestId === 'string' && requestId.length > 0) {
      return requestId;
    }
  }

  return 'unknown-request';
}

function postError(
  requestId: string,
  code: Exclude<OptimizationErrorCode, 'OK'>,
  message: string,
  elapsedMs: number,
  details?: unknown
): void {
  const safeCode = ERROR_CODES.has(code) ? code : 'OPTIMIZATION_RUNTIME_ERROR';

  const response: OptimizerWorkerErrorResponse = {
    success: false,
    requestId,
    code: safeCode,
    message,
    details,
    elapsedMs,
  };

  self.postMessage(response);
}

/**
 * Web Worker para otimizacao
 */
self.onmessage = async (event: MessageEvent<unknown>) => {
  const startedAt = Date.now();
  const fallbackRequestId = resolveRequestId(event.data);

  const elapsed = () => Date.now() - startedAt;

  try {
    if (!event.data || typeof event.data !== 'object') {
      postError(
        fallbackRequestId,
        'OPTIMIZATION_VALIDATION_ERROR',
        'Payload de otimizacao invalido.',
        elapsed()
      );
      return;
    }

    const payload = event.data as Partial<OptimizerWorkerRequest>;
    const requestId =
      typeof payload.requestId === 'string' && payload.requestId.length > 0
        ? payload.requestId
        : fallbackRequestId;

    if (!Array.isArray(payload.lots) || payload.lots.length === 0) {
      postError(
        requestId,
        'OPTIMIZATION_VALIDATION_ERROR',
        'A lista de lotes eh obrigatoria para otimizacao.',
        elapsed()
      );
      return;
    }

    for (let i = 0; i < payload.lots.length; i++) {
      if (!isSerializedLot(payload.lots[i])) {
        postError(
          requestId,
          'OPTIMIZATION_VALIDATION_ERROR',
          'Lote invalido no payload de otimizacao.',
          elapsed(),
          { index: i }
        );
        return;
      }
    }

    if (!isFiniteNumber(payload.maxD0Adjustment) || payload.maxD0Adjustment <= 0) {
      postError(
        requestId,
        'OPTIMIZATION_VALIDATION_ERROR',
        'maxD0Adjustment deve ser um numero positivo.',
        elapsed(),
        { maxD0Adjustment: payload.maxD0Adjustment }
      );
      return;
    }

    if (!isFiniteNumber(payload.timeLimitMs) || payload.timeLimitMs <= 0) {
      postError(
        requestId,
        'OPTIMIZATION_VALIDATION_ERROR',
        'timeLimitMs deve ser um numero positivo.',
        elapsed(),
        { timeLimitMs: payload.timeLimitMs }
      );
      return;
    }

    let lots: Lot[];

    try {
      lots = payload.lots.map((lotData) =>
        Lot.fromJSON(lotData as Parameters<typeof Lot.fromJSON>[0])
      );
    } catch (error) {
      postError(
        requestId,
        'OPTIMIZATION_VALIDATION_ERROR',
        'Falha ao desserializar lotes para otimizacao.',
        elapsed(),
        {
          cause: error instanceof Error ? error.message : String(error),
        }
      );
      return;
    }

    const maxD0Adjustment = Math.floor(payload.maxD0Adjustment);
    const timeLimitMs = Math.floor(payload.timeLimitMs);

    // Criar parametros
    const params: GeneticParams = {
      ...DEFAULT_GA_PARAMS,
      maxD0Adjustment,
      timeLimitMs,
    };

    // Otimizar
    const { scenarios, totalCombinations, engine } = await optimizeWithHybridEngine(lots, params);
    console.log(`[optimizer.worker] engine=${engine} lots=${lots.length}`);

    // Serializar e enviar resultado
    const serializedScenarios = scenarios.map((scenario) => ({
      name: scenario.name,
      description: scenario.description,
      lots: scenario.lots.map((lot) => lot.toJSON()),
      objectives: scenario.objectives,
      fitness: scenario.fitness,
    }));

    const response: OptimizerWorkerSuccessResponse = {
      success: true,
      requestId,
      code: 'OK',
      elapsedMs: elapsed(),
      scenarios: serializedScenarios,
      totalCombinations,
    };

    self.postMessage(response);
  } catch (error) {
    postError(
      fallbackRequestId,
      'OPTIMIZATION_RUNTIME_ERROR',
      error instanceof Error ? error.message : 'Erro desconhecido de execucao.',
      elapsed(),
      {
        cause: error instanceof Error ? error.stack : String(error),
      }
    );
  }
};
