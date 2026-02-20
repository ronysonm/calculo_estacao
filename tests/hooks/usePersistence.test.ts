import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'preact';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { usePersistence } from '../../src/hooks/usePersistence';
import { storage } from '../../src/services/persistence/storage';
import { lotsSignal } from '../../src/state/signals/lots';
import { DateOnly } from '../../src/domain/value-objects/DateOnly';
import { Lot } from '../../src/domain/value-objects/Lot';
import { Protocol } from '../../src/domain/value-objects/Protocol';

function createLot(id: string = 'lot-1'): Lot {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  return Lot.create(id, id.toUpperCase(), DateOnly.create(2026, 1, 10), protocol, [22, 22, 22]);
}

describe('usePersistence', () => {
  let container: HTMLDivElement;
  let latestApi: ReturnType<typeof usePersistence> | null;

  beforeEach(() => {
    vi.useFakeTimers();
    latestApi = null;
    lotsSignal.value = [];
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    lotsSignal.value = [];
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function mountHook() {
    function Harness() {
      latestApi = usePersistence();
      return null;
    }

    act(() => {
      render(h(Harness, {}), container);
    });
  }

  it('loads lots on mount and saves after debounce', () => {
    const loadedLot = createLot('loaded-lot');

    vi.spyOn(storage, 'isAvailable').mockReturnValue(true);
    vi.spyOn(storage, 'load').mockReturnValue({ lots: [loadedLot], customProtocols: [] });
    const saveSpy = vi.spyOn(storage, 'save').mockReturnValue(true);
    vi.spyOn(storage, 'getQuotaInfo').mockReturnValue({ used: 10, total: 1000, percentage: 10 });

    mountHook();

    expect(lotsSignal.value).toHaveLength(1);
    expect(lotsSignal.value[0]!.equals(loadedLot)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(saveSpy).toHaveBeenCalledWith(lotsSignal.value, []);
  });

  it('warns and skips load when storage is unavailable', () => {
    vi.spyOn(storage, 'isAvailable').mockReturnValue(false);
    const loadSpy = vi.spyOn(storage, 'load');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    mountHook();

    expect(warnSpy).toHaveBeenCalledWith('localStorage not available (incognito mode?)');
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('shows warning alert when quota reaches 80-94%', () => {
    lotsSignal.value = [createLot('lot-1')];
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.spyOn(storage, 'isAvailable').mockReturnValue(true);
    vi.spyOn(storage, 'load').mockReturnValue(null);
    vi.spyOn(storage, 'save').mockReturnValue(true);
    vi.spyOn(storage, 'getQuotaInfo').mockReturnValue({ used: 800, total: 1000, percentage: 80 });

    mountHook();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(warnSpy).toHaveBeenCalledWith('Storage at 80%');
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('shows critical alert when quota reaches 95% or more', () => {
    lotsSignal.value = [createLot('lot-1')];
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.spyOn(storage, 'isAvailable').mockReturnValue(true);
    vi.spyOn(storage, 'load').mockReturnValue(null);
    vi.spyOn(storage, 'save').mockReturnValue(true);
    vi.spyOn(storage, 'getQuotaInfo').mockReturnValue({ used: 950, total: 1000, percentage: 95 });

    mountHook();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(errorSpy).toHaveBeenCalledWith('Storage critical: 95%');
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('returns helpers that delegate to storage service', () => {
    vi.spyOn(storage, 'isAvailable').mockReturnValue(true);
    vi.spyOn(storage, 'load').mockReturnValue(null);
    const clearSpy = vi.spyOn(storage, 'clear').mockImplementation(() => undefined);
    vi.spyOn(storage, 'save').mockReturnValue(true);
    vi.spyOn(storage, 'getQuotaInfo').mockReturnValue({ used: 123, total: 456, percentage: 27 });

    mountHook();

    expect(latestApi).not.toBeNull();
    latestApi!.clear();
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(latestApi!.getQuota()).toEqual({ used: 123, total: 456, percentage: 27 });
  });
});
