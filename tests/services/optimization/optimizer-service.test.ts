import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OptimizerService } from '../../../src/services/optimization/optimizer-service';
import {
  OptimizerWorkerErrorResponse,
  OptimizerWorkerRequest,
  OptimizerWorkerSuccessResponse,
} from '../../../src/services/optimization/optimizer-contract';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';

class MockWorker {
  static instances: MockWorker[] = [];

  onmessage: ((this: Worker, ev: MessageEvent<unknown>) => unknown) | null = null;
  onerror: ((this: Worker, ev: ErrorEvent) => unknown) | null = null;
  terminated = false;
  terminateCalls = 0;
  postedMessages: unknown[] = [];

  constructor(_scriptURL: URL, _options?: WorkerOptions) {
    MockWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.postedMessages.push(message);
  }

  terminate(): void {
    this.terminated = true;
    this.terminateCalls += 1;
  }

  emitMessage(data: unknown): void {
    this.onmessage?.call(this as unknown as Worker, { data } as MessageEvent<unknown>);
  }

  emitError(message: string): void {
    this.onerror?.call(this as unknown as Worker, {
      message,
      filename: 'optimizer.worker.ts',
      lineno: 1,
      colno: 1,
    } as ErrorEvent);
  }
}

function createLots(): Lot[] {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  return [
    Lot.create('lot-1', 'Lote 1', DateOnly.create(2026, 1, 1), protocol, [22, 22, 22]),
    Lot.create('lot-2', 'Lote 2', DateOnly.create(2026, 1, 2), protocol, [22, 22, 22]),
  ];
}

function buildSuccessResponse(
  requestId: string,
  lots: Lot[],
  totalCombinations: number = 7
): OptimizerWorkerSuccessResponse {
  return {
    success: true,
    requestId,
    code: 'OK',
    elapsedMs: 10,
    scenarios: [
      {
        name: 'Balanceado',
        description: 'Cenario de teste',
        lots: lots.map((lot) => lot.toJSON()),
        objectives: {
          sundaysRounds12: 0,
          sundaysRounds34: 0,
          overlapsRounds12: 0,
          overlapsRounds34: 0,
          totalCycleDays: 100,
          intervalViolations: 0,
        },
        fitness: 0.9,
      },
    ],
    totalCombinations,
  };
}

function readRequestId(worker: MockWorker): string {
  const request = worker.postedMessages[0] as OptimizerWorkerRequest;
  return request.requestId;
}

function buildErrorResponse(
  requestId: string,
  code: OptimizerWorkerErrorResponse['code'] = 'OPTIMIZATION_RUNTIME_ERROR',
  message: string = 'worker error'
): OptimizerWorkerErrorResponse {
  return {
    success: false,
    requestId,
    code,
    message,
    elapsedMs: 12,
  };
}

describe('OptimizerService', () => {
  let service: OptimizerService;

  beforeEach(() => {
    MockWorker.instances = [];
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
    service = new OptimizerService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rejects concurrent optimization with OPTIMIZATION_IN_PROGRESS', async () => {
    const lots = createLots();
    const firstRun = service.optimizeSchedule(lots, 15, 30000);
    const firstWorker = MockWorker.instances[0]!;

    await expect(service.optimizeSchedule(lots, 15, 30000)).rejects.toMatchObject({
      code: 'OPTIMIZATION_IN_PROGRESS',
    });

    firstWorker.emitMessage(buildSuccessResponse(readRequestId(firstWorker), lots));
    await expect(firstRun).resolves.toMatchObject({ totalCombinations: 7 });
  });

  it('maps timeout to OPTIMIZATION_TIMEOUT', async () => {
    vi.useFakeTimers();
    const lots = createLots();

    const run = service.optimizeSchedule(lots, 15, 1000);
    const worker = MockWorker.instances[0]!;
    const assertion = expect(run).rejects.toMatchObject({ code: 'OPTIMIZATION_TIMEOUT' });

    await vi.advanceTimersByTimeAsync(6001);

    await assertion;
    expect(worker.terminated).toBe(true);
  });

  it('maps worker onerror to OPTIMIZATION_WORKER_ERROR', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    worker.emitError('worker crash');

    await expect(run).rejects.toMatchObject({ code: 'OPTIMIZATION_WORKER_ERROR' });
  });

  it('uses default worker error message when event message is empty', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    worker.emitError('');

    await expect(run).rejects.toMatchObject({
      code: 'OPTIMIZATION_WORKER_ERROR',
      message: 'Erro inesperado no worker de otimizacao.',
    });
  });

  it('cancel rejects pending promise with OPTIMIZATION_CANCELED', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    service.cancel();

    await expect(run).rejects.toMatchObject({ code: 'OPTIMIZATION_CANCELED' });
    expect(worker.terminated).toBe(true);
  });

  it('settles once and cleans up active request state', async () => {
    const lots = createLots();

    const firstRun = service.optimizeSchedule(lots, 15, 30000);
    const firstWorker = MockWorker.instances[0]!;
    const firstRequestId = readRequestId(firstWorker);

    firstWorker.emitMessage(buildSuccessResponse(firstRequestId, lots, 11));
    firstWorker.emitError('late error');

    await expect(firstRun).resolves.toMatchObject({ totalCombinations: 11 });
    expect(firstWorker.terminateCalls).toBe(1);

    const secondRun = service.optimizeSchedule(lots, 15, 30000);
    const secondWorker = MockWorker.instances[1]!;
    secondWorker.emitMessage(buildSuccessResponse(readRequestId(secondWorker), lots, 13));

    await expect(secondRun).resolves.toMatchObject({ totalCombinations: 13 });
  });

  it('normalizes invalid maxD0Adjustment and timeLimit values', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, -10, 0);
    const worker = MockWorker.instances[0]!;
    const request = worker.postedMessages[0] as OptimizerWorkerRequest;

    expect(request.maxD0Adjustment).toBe(15);
    expect(request.timeLimitMs).toBe(30000);

    worker.emitMessage(buildSuccessResponse(request.requestId, lots, 5));
    await expect(run).resolves.toMatchObject({ totalCombinations: 5 });
  });

  it('rejects invalid payload returned by worker parser', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    worker.emitMessage({ foo: 'bar' });

    await expect(run).rejects.toMatchObject({ code: 'OPTIMIZATION_WORKER_ERROR' });
  });

  it('ignores stale responses with another requestId', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;
    const requestId = readRequestId(worker);

    worker.emitMessage(buildSuccessResponse('other-request', lots, 99));
    expect(worker.terminateCalls).toBe(0);

    worker.emitMessage(buildSuccessResponse(requestId, lots, 17));

    await expect(run).resolves.toMatchObject({ totalCombinations: 17 });
  });

  it('maps worker error response payload to OptimizationServiceError', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    worker.emitMessage(buildErrorResponse(readRequestId(worker), 'OPTIMIZATION_RUNTIME_ERROR', 'boom'));

    await expect(run).rejects.toMatchObject({
      code: 'OPTIMIZATION_RUNTIME_ERROR',
      message: 'boom',
    });
  });

  it('maps postMessage throw to OPTIMIZATION_RUNTIME_ERROR', async () => {
    const lots = createLots();
    vi.spyOn(MockWorker.prototype, 'postMessage').mockImplementation(() => {
      throw new Error('post failed');
    });

    await expect(service.optimizeSchedule(lots, 15, 30000)).rejects.toMatchObject({
      code: 'OPTIMIZATION_RUNTIME_ERROR',
      message: 'Falha ao iniciar otimizacao no worker.',
    });
  });

  it('rejects invalid worker response when success=false and code=OK', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    worker.emitMessage({
      success: false,
      requestId: readRequestId(worker),
      code: 'OK',
      message: 'invalid',
      elapsedMs: 10,
    });

    await expect(run).rejects.toMatchObject({ code: 'OPTIMIZATION_WORKER_ERROR' });
  });

  it('rejects invalid worker response when error message is missing', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    worker.emitMessage({
      success: false,
      requestId: readRequestId(worker),
      code: 'OPTIMIZATION_RUNTIME_ERROR',
      elapsedMs: 10,
    });

    await expect(run).rejects.toMatchObject({ code: 'OPTIMIZATION_WORKER_ERROR' });
  });

  it('rejects invalid worker response when success=true has non-OK code', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    worker.emitMessage({
      success: true,
      requestId: readRequestId(worker),
      code: 'OPTIMIZATION_RUNTIME_ERROR',
      elapsedMs: 10,
      scenarios: [],
      totalCombinations: 1,
    });

    await expect(run).rejects.toMatchObject({ code: 'OPTIMIZATION_WORKER_ERROR' });
  });

  it('rejects invalid success payload when scenarios is not an array', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    worker.emitMessage({
      success: true,
      requestId: readRequestId(worker),
      code: 'OK',
      elapsedMs: 10,
      scenarios: 'invalid',
      totalCombinations: 1,
    });

    await expect(run).rejects.toMatchObject({ code: 'OPTIMIZATION_WORKER_ERROR' });
  });

  it('rejects invalid success payload when totalCombinations is not number', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    worker.emitMessage({
      success: true,
      requestId: readRequestId(worker),
      code: 'OK',
      elapsedMs: 10,
      scenarios: [],
      totalCombinations: 'invalid',
    });

    await expect(run).rejects.toMatchObject({ code: 'OPTIMIZATION_WORKER_ERROR' });
  });

  it('rejects payload when worker code is unknown', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    worker.emitMessage({
      success: false,
      requestId: readRequestId(worker),
      code: 'UNKNOWN_CODE',
      message: 'invalid code',
      elapsedMs: 10,
    });

    await expect(run).rejects.toMatchObject({ code: 'OPTIMIZATION_WORKER_ERROR' });
  });

  it('rejects payload when elapsedMs is NaN', async () => {
    const lots = createLots();
    const run = service.optimizeSchedule(lots, 15, 30000);
    const worker = MockWorker.instances[0]!;

    worker.emitMessage({
      success: true,
      requestId: readRequestId(worker),
      code: 'OK',
      elapsedMs: Number.NaN,
      scenarios: [],
      totalCombinations: 1,
    });

    await expect(run).rejects.toMatchObject({ code: 'OPTIMIZATION_WORKER_ERROR' });
  });
});
