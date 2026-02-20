import { describe, it, expect, beforeEach } from 'vitest';
import {
  roundSuccessRatesSignal,
  setRoundSuccessRate,
  setAllRoundSuccessRates,
  resetRoundSuccessRates,
} from '../../../src/state/signals/success-rates';
import { DEFAULT_ROUND_SUCCESS_RATES } from '../../../src/domain/constants';

describe('roundSuccessRatesSignal', () => {
  beforeEach(() => {
    resetRoundSuccessRates();
  });

  it('should start with default rates', () => {
    expect(roundSuccessRatesSignal.value).toEqual([...DEFAULT_ROUND_SUCCESS_RATES]);
  });

  it('setRoundSuccessRate should update a single rate', () => {
    setRoundSuccessRate(0, 60);
    expect(roundSuccessRatesSignal.value[0]).toBe(60);
    // Others unchanged
    expect(roundSuccessRatesSignal.value[1]).toBe(DEFAULT_ROUND_SUCCESS_RATES[1]);
  });

  it('setRoundSuccessRate should clamp to 0-100', () => {
    setRoundSuccessRate(0, -10);
    expect(roundSuccessRatesSignal.value[0]).toBe(0);

    setRoundSuccessRate(0, 150);
    expect(roundSuccessRatesSignal.value[0]).toBe(100);
  });

  it('setRoundSuccessRate should round to integer', () => {
    setRoundSuccessRate(0, 33.7);
    expect(roundSuccessRatesSignal.value[0]).toBe(34);
  });

  it('setAllRoundSuccessRates should replace all rates', () => {
    setAllRoundSuccessRates([10, 20, 30, 40]);
    expect(roundSuccessRatesSignal.value).toEqual([10, 20, 30, 40]);
  });

  it('resetRoundSuccessRates should restore defaults', () => {
    setAllRoundSuccessRates([10, 20, 30, 40]);
    resetRoundSuccessRates();
    expect(roundSuccessRatesSignal.value).toEqual([...DEFAULT_ROUND_SUCCESS_RATES]);
  });
});
