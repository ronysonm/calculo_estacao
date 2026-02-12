import { describe, it, expect } from 'vitest';
import { DEFAULT_ROUND_CONFIG, generateRoundLabels } from './Round';

describe('Round', () => {
  describe('DEFAULT_ROUND_CONFIG', () => {
    it('has count of 4 and defaultInterval of 22', () => {
      expect(DEFAULT_ROUND_CONFIG.count).toBe(4);
      expect(DEFAULT_ROUND_CONFIG.defaultInterval).toBe(22);
    });

    it('is frozen', () => {
      expect(Object.isFrozen(DEFAULT_ROUND_CONFIG)).toBe(true);
    });
  });

  describe('generateRoundLabels', () => {
    it('generates labels for 4 rounds', () => {
      const labels = generateRoundLabels(4);

      expect(labels).toEqual(['A1', 'A2', 'A3', 'A4']);
    });

    it('generates labels for 6 rounds', () => {
      const labels = generateRoundLabels(6);

      expect(labels).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
    });

    it('generates labels for 1 round', () => {
      const labels = generateRoundLabels(1);

      expect(labels).toEqual(['A1']);
    });
  });
});
