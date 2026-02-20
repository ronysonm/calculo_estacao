import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateOnly } from '../../src/domain/value-objects/DateOnly';
import { Lot } from '../../src/domain/value-objects/Lot';
import { OptimizationScenario } from '../../src/domain/value-objects/OptimizationScenario';
import { Protocol } from '../../src/domain/value-objects/Protocol';

function createLot(id: string = 'lot-1'): Lot {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  return Lot.create(id, id.toUpperCase(), DateOnly.create(2026, 1, 5), protocol, [22, 22, 22]);
}

async function loadWorkerWith(
  optimizeImpl: ReturnType<typeof vi.fn>
): Promise<{ selfMock: { postMessage: ReturnType<typeof vi.fn>; onmessage: ((event: MessageEvent<unknown>) => Promise<void>) | null } }> {
  vi.resetModules();

  const selfMock = {
    postMessage: vi.fn(),
    onmessage: null as ((event: MessageEvent<unknown>) => Promise<void>) | null,
  };

  vi.stubGlobal('self', selfMock as unknown as typeof self);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);

  vi.doMock('../../src/core/optimization/hybrid-scheduler', () => ({
    optimizeWithHybridEngine: optimizeImpl,
  }));

  await import('../../src/workers/optimizer.worker');

  return { selfMock };
}

describe('optimizer.worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts validation error for invalid payload', async () => {
    const optimizeMock = vi.fn();
    const { selfMock } = await loadWorkerWith(optimizeMock);

    await selfMock.onmessage!({ data: null } as MessageEvent<unknown>);

    expect(optimizeMock).not.toHaveBeenCalled();
    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        requestId: 'unknown-request',
        code: 'OPTIMIZATION_VALIDATION_ERROR',
      })
    );
  });

  it('posts validation error for invalid lot schema', async () => {
    const optimizeMock = vi.fn();
    const { selfMock } = await loadWorkerWith(optimizeMock);

    await selfMock.onmessage!(
      {
        data: {
          requestId: 'req-1',
          lots: [
            {
              id: 'lot-1',
              name: 'Lot 1',
              d0: { year: 2026, month: 1, day: 5 },
              protocol: {
                id: 'p1',
                name: 'Broken',
                intervals: [0, 7, 9],
                type: 'invalid-type',
              },
              roundGaps: [22, 22, 22],
            },
          ],
          maxD0Adjustment: 10,
          timeLimitMs: 5000,
        },
      } as MessageEvent<unknown>
    );

    expect(optimizeMock).not.toHaveBeenCalled();
    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        requestId: 'req-1',
        code: 'OPTIMIZATION_VALIDATION_ERROR',
      })
    );
  });

  it('posts validation error when maxD0Adjustment is invalid', async () => {
    const optimizeMock = vi.fn();
    const { selfMock } = await loadWorkerWith(optimizeMock);
    const lot = createLot('lot-1').toJSON();

    await selfMock.onmessage!(
      {
        data: {
          requestId: 'req-max',
          lots: [lot],
          maxD0Adjustment: 0,
          timeLimitMs: 5000,
        },
      } as MessageEvent<unknown>
    );

    expect(optimizeMock).not.toHaveBeenCalled();
    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        requestId: 'req-max',
        code: 'OPTIMIZATION_VALIDATION_ERROR',
        message: 'maxD0Adjustment deve ser um numero positivo.',
      })
    );
  });

  it('posts validation error when timeLimitMs is invalid', async () => {
    const optimizeMock = vi.fn();
    const { selfMock } = await loadWorkerWith(optimizeMock);
    const lot = createLot('lot-1').toJSON();

    await selfMock.onmessage!(
      {
        data: {
          requestId: 'req-time',
          lots: [lot],
          maxD0Adjustment: 5,
          timeLimitMs: 0,
        },
      } as MessageEvent<unknown>
    );

    expect(optimizeMock).not.toHaveBeenCalled();
    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        requestId: 'req-time',
        code: 'OPTIMIZATION_VALIDATION_ERROR',
        message: 'timeLimitMs deve ser um numero positivo.',
      })
    );
  });

  it('posts validation error for invalid roundGaps schema', async () => {
    const optimizeMock = vi.fn();
    const { selfMock } = await loadWorkerWith(optimizeMock);
    const lot = createLot('lot-1').toJSON();

    await selfMock.onmessage!(
      {
        data: {
          requestId: 'req-gaps',
          lots: [{ ...lot, roundGaps: [22, 'x', 22] }],
          maxD0Adjustment: 5,
          timeLimitMs: 5000,
        },
      } as MessageEvent<unknown>
    );

    expect(optimizeMock).not.toHaveBeenCalled();
    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        requestId: 'req-gaps',
        code: 'OPTIMIZATION_VALIDATION_ERROR',
      })
    );
  });

  it('uses fallback requestId and validates empty lots array', async () => {
    const optimizeMock = vi.fn();
    const { selfMock } = await loadWorkerWith(optimizeMock);

    await selfMock.onmessage!(
      {
        data: {
          lots: [],
          maxD0Adjustment: 5,
          timeLimitMs: 5000,
        },
      } as MessageEvent<unknown>
    );

    expect(optimizeMock).not.toHaveBeenCalled();
    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        requestId: 'unknown-request',
        code: 'OPTIMIZATION_VALIDATION_ERROR',
        message: 'A lista de lotes eh obrigatoria para otimizacao.',
      })
    );
  });

  it('posts validation error for missing protocol object', async () => {
    const optimizeMock = vi.fn();
    const { selfMock } = await loadWorkerWith(optimizeMock);
    const lot = createLot('lot-1').toJSON() as Record<string, unknown>;
    delete lot.protocol;

    await selfMock.onmessage!(
      {
        data: {
          requestId: 'req-no-protocol',
          lots: [lot],
          maxD0Adjustment: 5,
          timeLimitMs: 5000,
        },
      } as MessageEvent<unknown>
    );

    expect(optimizeMock).not.toHaveBeenCalled();
    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        requestId: 'req-no-protocol',
        code: 'OPTIMIZATION_VALIDATION_ERROR',
      })
    );
  });

  it('posts validation error for invalid protocol intervals type', async () => {
    const optimizeMock = vi.fn();
    const { selfMock } = await loadWorkerWith(optimizeMock);
    const lot = createLot('lot-1').toJSON();

    await selfMock.onmessage!(
      {
        data: {
          requestId: 'req-intervals',
          lots: [{ ...lot, protocol: { ...lot.protocol, intervals: 'bad' } }],
          maxD0Adjustment: 5,
          timeLimitMs: 5000,
        },
      } as MessageEvent<unknown>
    );

    expect(optimizeMock).not.toHaveBeenCalled();
    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        requestId: 'req-intervals',
        code: 'OPTIMIZATION_VALIDATION_ERROR',
      })
    );
  });

  it('posts validation error when lot deserialization fails', async () => {
    const optimizeMock = vi.fn();
    const { selfMock } = await loadWorkerWith(optimizeMock);
    const lot = createLot('lot-1').toJSON();

    await selfMock.onmessage!(
      {
        data: {
          requestId: 'req-2',
          lots: [{ ...lot, roundGaps: [0, 0, 0] }],
          maxD0Adjustment: 5,
          timeLimitMs: 4000,
        },
      } as MessageEvent<unknown>
    );

    expect(optimizeMock).not.toHaveBeenCalled();
    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        requestId: 'req-2',
        code: 'OPTIMIZATION_VALIDATION_ERROR',
        message: 'Falha ao desserializar lotes para otimizacao.',
      })
    );
  });

  it('posts success response when optimization succeeds', async () => {
    const lot = createLot('lot-1');
    const scenario = OptimizationScenario.create(
      'Balanceado',
      [lot],
      {
        sundaysRounds12: 0,
        sundaysRounds34: 0,
        overlapsRounds12: 0,
        overlapsRounds34: 0,
        totalCycleDays: 100,
        intervalViolations: 0,
      },
      0.9,
      'cenario teste'
    );

    const optimizeMock = vi.fn().mockResolvedValue({
      scenarios: [scenario],
      totalCombinations: 77,
      engine: 'ga',
    });
    const { selfMock } = await loadWorkerWith(optimizeMock);

    await selfMock.onmessage!(
      {
        data: {
          requestId: 'req-3',
          lots: [lot.toJSON()],
          maxD0Adjustment: 8,
          timeLimitMs: 9000,
        },
      } as MessageEvent<unknown>
    );

    expect(optimizeMock).toHaveBeenCalledTimes(1);
    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        requestId: 'req-3',
        code: 'OK',
        totalCombinations: 77,
      })
    );
  });

  it('posts runtime error when optimizer throws', async () => {
    const optimizeMock = vi.fn().mockRejectedValue(new Error('worker boom'));
    const { selfMock } = await loadWorkerWith(optimizeMock);
    const lot = createLot('lot-1').toJSON();

    await selfMock.onmessage!(
      {
        data: {
          requestId: 'req-4',
          lots: [lot],
          maxD0Adjustment: 8,
          timeLimitMs: 9000,
        },
      } as MessageEvent<unknown>
    );

    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        requestId: 'req-4',
        code: 'OPTIMIZATION_RUNTIME_ERROR',
        message: 'worker boom',
      })
    );
  });
});
