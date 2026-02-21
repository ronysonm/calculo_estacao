import { describe, it, expect, beforeEach } from 'vitest';
import { EstacaoStorage } from '../../../src/services/persistence/storage';

// Mock localStorage for tests
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage });

describe('EstacaoStorage — v1 to v2 migration', () => {
  let storage: EstacaoStorage;

  beforeEach(() => {
    mockLocalStorage.clear();
    storage = new EstacaoStorage();
  });

  it('loads v2 data with customHolidays', () => {
    const v2Data = {
      version: 2,
      lots: [],
      customProtocols: [],
      customHolidays: [{ year: 2026, month: 3, day: 15, name: 'Feriado Municipal' }],
      savedAt: new Date().toISOString(),
    };
    mockLocalStorage.setItem('estacao-iatf-data', JSON.stringify(v2Data));
    const result = storage.load();
    expect(result).not.toBeNull();
    expect(result!.customHolidays).toHaveLength(1);
    expect(result!.customHolidays[0]!.name).toBe('Feriado Municipal');
  });

  it('migrates v1 data — returns empty customHolidays', () => {
    const v1Data = {
      version: 1,
      lots: [],
      customProtocols: [],
      savedAt: new Date().toISOString(),
    };
    mockLocalStorage.setItem('estacao-iatf-data', JSON.stringify(v1Data));
    const result = storage.load();
    expect(result).not.toBeNull();
    expect(result!.customHolidays).toEqual([]);
  });

  it('save includes customHolidays', () => {
    const holidays = [{ year: 2026, month: 6, day: 20, name: 'Festa Junina' }];
    storage.save([], [], undefined, holidays);
    const raw = JSON.parse(mockLocalStorage.getItem('estacao-iatf-data')!);
    expect(raw.version).toBe(2);
    expect(raw.customHolidays).toHaveLength(1);
    expect(raw.customHolidays[0].name).toBe('Festa Junina');
  });

  it('save without holidays defaults to empty array', () => {
    storage.save([], []);
    const raw = JSON.parse(mockLocalStorage.getItem('estacao-iatf-data')!);
    expect(raw.customHolidays).toEqual([]);
  });
});
