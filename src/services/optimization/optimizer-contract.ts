import type { Lot } from '@/domain/value-objects/Lot';
import type { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';

export type OptimizationErrorCode =
  | 'OK'
  | 'OPTIMIZATION_TIMEOUT'
  | 'OPTIMIZATION_IN_PROGRESS'
  | 'OPTIMIZATION_CANCELED'
  | 'OPTIMIZATION_VALIDATION_ERROR'
  | 'OPTIMIZATION_RUNTIME_ERROR'
  | 'OPTIMIZATION_WORKER_ERROR';

export type OptimizerSerializedLot = ReturnType<Lot['toJSON']>;

export interface OptimizerSerializedScenario {
  name: string;
  description: string;
  lots: OptimizerSerializedLot[];
  objectives: OptimizationScenario['objectives'];
  fitness: number;
}

export interface OptimizerWorkerRequest {
  requestId: string;
  lots: OptimizerSerializedLot[];
  maxD0Adjustment: number;
  timeLimitMs: number;
}

export interface OptimizerWorkerSuccessResponse {
  success: true;
  requestId: string;
  code: 'OK';
  elapsedMs: number;
  scenarios: OptimizerSerializedScenario[];
  totalCombinations: number;
}

export interface OptimizerWorkerErrorResponse {
  success: false;
  requestId: string;
  code: Exclude<OptimizationErrorCode, 'OK'>;
  message: string;
  details?: unknown;
  elapsedMs: number;
}

export type OptimizerWorkerResponse =
  | OptimizerWorkerSuccessResponse
  | OptimizerWorkerErrorResponse;

export class OptimizationServiceError extends Error {
  constructor(
    public readonly code: Exclude<OptimizationErrorCode, 'OK'>,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'OptimizationServiceError';
  }
}
