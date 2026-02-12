/**
 * Round domain model
 *
 * Rounds represent reproductive cycles (e.g., A1, A2, A3, A4).
 * Round count is global (all lots share the same count).
 * Round interval is per-lot (configured on Lot model).
 */

export interface RoundConfig {
  readonly count: number;          // Number of rounds (1-6)
  readonly defaultInterval: number; // Default interval between rounds in days
}

/**
 * Default round configuration.
 * Used as starting point for new projects.
 */
export const DEFAULT_ROUND_CONFIG: RoundConfig = Object.freeze({
  count: 4,
  defaultInterval: 22,
});

/**
 * Generate round labels for the given count.
 *
 * @param count - Number of rounds (e.g., 4)
 * @returns Array of round labels (e.g., ["A1", "A2", "A3", "A4"])
 */
export function generateRoundLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `A${i + 1}`);
}
