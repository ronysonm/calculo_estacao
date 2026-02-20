/**
 * Success Rates State - Global round success rates
 *
 * Shared across all lots. Controls how many animals proceed to the next round.
 * Rate[i] = percentage of animals that succeed in round i+1 (don't need another round).
 */

import { signal } from '@preact/signals';
import { DEFAULT_ROUND_SUCCESS_RATES } from '@/domain/constants';

/**
 * Global success rates signal (one array for all lots)
 */
export const roundSuccessRatesSignal = signal<readonly number[]>([...DEFAULT_ROUND_SUCCESS_RATES]);

/**
 * Update a single round's success rate
 * @param roundIndex - Round index (0-3)
 * @param rate - New rate (0-100)
 */
export function setRoundSuccessRate(roundIndex: number, rate: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(rate)));
  const newRates = [...roundSuccessRatesSignal.value];
  newRates[roundIndex] = clamped;
  roundSuccessRatesSignal.value = newRates;
}

/**
 * Replace all success rates (for loading from storage)
 */
export function setAllRoundSuccessRates(rates: readonly number[]): void {
  roundSuccessRatesSignal.value = rates.map((r) => Math.max(0, Math.min(100, Math.round(r))));
}

/**
 * Reset to default rates
 */
export function resetRoundSuccessRates(): void {
  roundSuccessRatesSignal.value = [...DEFAULT_ROUND_SUCCESS_RATES];
}
