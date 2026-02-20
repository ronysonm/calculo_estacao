import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EstacaoStorage } from '../../../src/services/persistence/storage';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';

const STORAGE_KEY = 'estacao-iatf-data';

function createProtocol(id: string = 'protocol-custom'): Protocol {
  return Protocol.create(id, 'D0-D7-D9', [0, 7, 9], 'custom');
}

function createLot(id: string = 'lot-1', name: string = 'Lot 1'): Lot {
  return Lot.create(id, name, DateOnly.create(2026, 1, 10), createProtocol(), [22, 22, 22]);
}

describe('EstacaoStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves and loads lots and custom protocols', () => {
    const service = new EstacaoStorage();
    const lot = createLot();
    const customProtocol = Protocol.create('protocol-2', 'D0-D8-D10', [0, 8, 10], 'custom');

    const saved = service.save([lot], [customProtocol]);
    const loaded = service.load();

    expect(saved).toBe(true);
    expect(loaded).not.toBeNull();
    expect(loaded!.lots).toHaveLength(1);
    expect(loaded!.customProtocols).toHaveLength(1);
    expect(loaded!.lots[0]!.equals(lot)).toBe(true);
    expect(loaded!.customProtocols[0]!.equals(customProtocol)).toBe(true);
  });

  it('returns null when no data is stored', () => {
    const service = new EstacaoStorage();
    expect(service.load()).toBeNull();
  });

  it('returns null when stored version is incompatible', () => {
    const service = new EstacaoStorage();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 999,
        lots: [],
        customProtocols: [],
        savedAt: new Date().toISOString(),
      })
    );

    expect(service.load()).toBeNull();
  });

  it('clear removes saved data', () => {
    const service = new EstacaoStorage();

    service.save([createLot()], []);
    expect(service.hasSavedData()).toBe(true);

    service.clear();
    expect(service.hasSavedData()).toBe(false);
  });

  it('returns false and alerts when quota is exceeded', () => {
    const service = new EstacaoStorage();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const quotaError = new Error('Quota reached');
    Object.defineProperty(quotaError, 'name', { value: 'QuotaExceededError' });

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError;
    });

    expect(service.save([createLot()], [])).toBe(false);
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('warns when payload size exceeds 4MB threshold', () => {
    const service = new EstacaoStorage();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    class LargeBlobMock {
      size = 4097 * 1024;
      constructor(_parts: unknown[]) {}
    }

    vi.stubGlobal('Blob', LargeBlobMock as unknown as typeof Blob);

    expect(service.save([createLot()], [])).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Storage size:'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('reports quota usage and conservative total size', () => {
    const service = new EstacaoStorage();
    localStorage.setItem('k1', 'abc');
    localStorage.setItem('k2', 'defgh');

    const quota = service.getQuotaInfo();

    expect(quota.total).toBe(5 * 1024 * 1024);
    expect(quota.used).toBeGreaterThan(0);
    expect(quota.percentage).toBeGreaterThanOrEqual(0);
  });

  it('detects unavailable storage when setItem throws', () => {
    const service = new EstacaoStorage();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(service.isAvailable()).toBe(false);
  });

  it('returns false on generic save failure', () => {
    const service = new EstacaoStorage();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('generic save fail');
    });

    expect(service.save([createLot()], [])).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to save to localStorage:',
      expect.any(Error)
    );
  });

  it('handles clear errors gracefully', () => {
    const service = new EstacaoStorage();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove blocked');
    });

    service.clear();

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to clear localStorage:',
      expect.any(Error)
    );
  });

  it('returns zeroed quota info when localStorage iteration fails', () => {
    const service = new EstacaoStorage();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const descriptor = Object.getOwnPropertyDescriptor(Storage.prototype, 'hasOwnProperty');
    Object.defineProperty(Storage.prototype, 'hasOwnProperty', {
      configurable: true,
      value: () => {
        throw new Error('quota inspection failed');
      },
    });

    const quota = service.getQuotaInfo();

    expect(quota).toEqual({ used: 0, total: 0, percentage: 0 });
    expect(errorSpy).toHaveBeenCalledWith('Failed to get quota info:', expect.any(Error));

    if (descriptor) {
      Object.defineProperty(Storage.prototype, 'hasOwnProperty', descriptor);
    } else {
      delete (Storage.prototype as { hasOwnProperty?: unknown }).hasOwnProperty;
    }
  });
});
