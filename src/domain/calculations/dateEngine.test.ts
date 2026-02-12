import { describe, it, expect } from 'vitest';
import { calculateManejoDate, calculateProtocolDates, calculateLotSchedule } from '@/domain/calculations/dateEngine';
import type { Protocol, Lot } from '@/domain/models';

describe('dateEngine', () => {
  describe('calculateManejoDate', () => {
    it('calculates basic date with day offset in first round', () => {
      const d0 = new Date(2024, 0, 15); // Jan 15 2024
      const result = calculateManejoDate(d0, 7, 0, 22);
      expect(result).toEqual(new Date(2024, 0, 22)); // Jan 22 2024
    });

    it('calculates basic date with different day offset in first round', () => {
      const d0 = new Date(2024, 0, 15); // Jan 15 2024
      const result = calculateManejoDate(d0, 9, 0, 22);
      expect(result).toEqual(new Date(2024, 0, 24)); // Jan 24 2024
    });

    it('calculates second round with zero offset', () => {
      const d0 = new Date(2024, 0, 15); // Jan 15 2024
      const result = calculateManejoDate(d0, 0, 1, 22);
      expect(result).toEqual(new Date(2024, 1, 6)); // Feb 6 2024
    });

    it('calculates second round with day offset', () => {
      const d0 = new Date(2024, 0, 15); // Jan 15 2024
      const result = calculateManejoDate(d0, 7, 1, 22);
      expect(result).toEqual(new Date(2024, 1, 13)); // Feb 13 2024
    });

    it('calculates fourth round with day offset', () => {
      const d0 = new Date(2024, 0, 15); // Jan 15 2024
      const result = calculateManejoDate(d0, 9, 3, 22);
      expect(result).toEqual(new Date(2024, 2, 30)); // Mar 30 2024 (Jan 15 + 3*22 + 9 = 75 days)
    });

    it('handles year crossing correctly', () => {
      const d0 = new Date(2024, 11, 25); // Dec 25 2024
      const result = calculateManejoDate(d0, 9, 0, 22);
      expect(result).toEqual(new Date(2025, 0, 3)); // Jan 3 2025
    });

    it('handles leap year February correctly', () => {
      const d0 = new Date(2024, 1, 20); // Feb 20 2024
      const result = calculateManejoDate(d0, 9, 0, 22);
      expect(result).toEqual(new Date(2024, 1, 29)); // Feb 29 2024 (leap year)
    });

    it('handles non-leap year February correctly', () => {
      const d0 = new Date(2023, 1, 20); // Feb 20 2023
      const result = calculateManejoDate(d0, 9, 0, 22);
      expect(result).toEqual(new Date(2023, 2, 1)); // Mar 1 2023 (no Feb 29)
    });

    it('handles month boundary crossing', () => {
      const d0 = new Date(2024, 0, 31); // Jan 31 2024
      const result = calculateManejoDate(d0, 0, 1, 22);
      expect(result).toEqual(new Date(2024, 1, 22)); // Feb 22 2024
    });

    it('handles year boundary exactly', () => {
      const d0 = new Date(2024, 11, 31); // Dec 31 2024
      const result = calculateManejoDate(d0, 1, 0, 22);
      expect(result).toEqual(new Date(2025, 0, 1)); // Jan 1 2025
    });

    it('handles D0 offset (day 0 itself)', () => {
      const d0 = new Date(2024, 0, 15); // Jan 15 2024
      const result = calculateManejoDate(d0, 0, 0, 22);
      expect(result).toEqual(new Date(2024, 0, 15)); // Jan 15 2024 (same day)
    });
  });

  describe('calculateProtocolDates', () => {
    const protocolD0D7D9: Protocol = {
      id: 'test-1',
      name: 'D0-D7-D9',
      days: [0, 7, 9] as const,
      isPredefined: true
    };

    const protocolD0D8D10: Protocol = {
      id: 'test-2',
      name: 'D0-D8-D10',
      days: [0, 8, 10] as const,
      isPredefined: true
    };

    it('calculates dates for 2 rounds with D0-D7-D9 protocol', () => {
      const d0 = new Date(2024, 0, 1); // Jan 1 2024
      const result = calculateProtocolDates(d0, protocolD0D7D9, 2, 22);

      expect(result).toHaveLength(6); // 3 days * 2 rounds

      // Round 1
      expect(result[0]).toEqual({ day: 0, date: new Date(2024, 0, 1), roundLabel: 'A1' }); // D0 Jan 1
      expect(result[1]).toEqual({ day: 7, date: new Date(2024, 0, 8), roundLabel: 'A1' }); // D7 Jan 8
      expect(result[2]).toEqual({ day: 9, date: new Date(2024, 0, 10), roundLabel: 'A1' }); // D9 Jan 10

      // Round 2
      expect(result[3]).toEqual({ day: 0, date: new Date(2024, 0, 23), roundLabel: 'A2' }); // D0 Jan 23
      expect(result[4]).toEqual({ day: 7, date: new Date(2024, 0, 30), roundLabel: 'A2' }); // D7 Jan 30
      expect(result[5]).toEqual({ day: 9, date: new Date(2024, 1, 1), roundLabel: 'A2' }); // D9 Feb 1
    });

    it('calculates dates for 1 round with D0-D8-D10 protocol', () => {
      const d0 = new Date(2024, 0, 1); // Jan 1 2024
      const result = calculateProtocolDates(d0, protocolD0D8D10, 1, 22);

      expect(result).toHaveLength(3); // 3 days * 1 round
      expect(result[0]).toEqual({ day: 0, date: new Date(2024, 0, 1), roundLabel: 'A1' }); // D0 Jan 1
      expect(result[1]).toEqual({ day: 8, date: new Date(2024, 0, 9), roundLabel: 'A1' }); // D8 Jan 9
      expect(result[2]).toEqual({ day: 10, date: new Date(2024, 0, 11), roundLabel: 'A1' }); // D10 Jan 11
    });

    it('calculates dates for 4 rounds with D0-D7-D9 protocol', () => {
      const d0 = new Date(2024, 0, 1); // Jan 1 2024
      const result = calculateProtocolDates(d0, protocolD0D7D9, 4, 22);

      expect(result).toHaveLength(12); // 3 days * 4 rounds

      // Verify last D9 (round 4): addDays(Jan 1, 3*22+9) = Jan 1 + 75 days = Mar 16 2024
      const lastD9 = result[11];
      expect(lastD9.day).toBe(9);
      expect(lastD9.date).toEqual(new Date(2024, 2, 16)); // Mar 16 2024
      expect(lastD9.roundLabel).toBe('A4');
    });

    it('returns exactly 3 ManejoDate objects for single round', () => {
      const d0 = new Date(2024, 0, 1);
      const result = calculateProtocolDates(d0, protocolD0D7D9, 1, 22);

      expect(result).toHaveLength(3);
      expect(result.every(r => r.roundLabel === 'A1')).toBe(true);
    });

    it('returns exactly 18 ManejoDate objects for 6 rounds', () => {
      const d0 = new Date(2024, 0, 1);
      const result = calculateProtocolDates(d0, protocolD0D7D9, 6, 22);

      expect(result).toHaveLength(18); // 3 days * 6 rounds
    });

    it('orders results by round then by day within round', () => {
      const d0 = new Date(2024, 0, 1);
      const result = calculateProtocolDates(d0, protocolD0D7D9, 3, 22);

      // First 3 should all be A1
      expect(result.slice(0, 3).every(r => r.roundLabel === 'A1')).toBe(true);
      // Next 3 should all be A2
      expect(result.slice(3, 6).every(r => r.roundLabel === 'A2')).toBe(true);
      // Last 3 should all be A3
      expect(result.slice(6, 9).every(r => r.roundLabel === 'A3')).toBe(true);

      // Within each round, days should be ordered
      expect(result[0].day).toBe(0);
      expect(result[1].day).toBe(7);
      expect(result[2].day).toBe(9);
    });

    it('generates correct round labels for 4 rounds', () => {
      const d0 = new Date(2024, 0, 1);
      const result = calculateProtocolDates(d0, protocolD0D7D9, 4, 22);

      const labels = [...new Set(result.map(r => r.roundLabel))];
      expect(labels).toEqual(['A1', 'A2', 'A3', 'A4']);
    });
  });

  describe('calculateLotSchedule', () => {
    const protocolD0D7D9: Protocol = {
      id: 'test-1',
      name: 'D0-D7-D9',
      days: [0, 7, 9] as const,
      isPredefined: true
    };

    const protocolD0D8D10: Protocol = {
      id: 'test-2',
      name: 'D0-D8-D10',
      days: [0, 8, 10] as const,
      isPredefined: true
    };

    it('uses per-lot interval from Lot object', () => {
      const lot: Lot = {
        id: 'lot-1',
        name: 'Lote A',
        protocolId: 'test-1',
        d0: new Date(2024, 0, 15), // Jan 15 2024
        roundInterval: 25 // NOT default 22
      };

      const result = calculateLotSchedule(lot, protocolD0D7D9, 4);

      expect(result).toHaveLength(12); // 3 days * 4 rounds

      // Verify second round D0 uses 25-day interval
      const secondRoundD0 = result[3];
      expect(secondRoundD0.day).toBe(0);
      expect(secondRoundD0.date).toEqual(new Date(2024, 1, 9)); // Jan 15 + 25 = Feb 9
      expect(secondRoundD0.roundLabel).toBe('A2');
    });

    it('calculates schedule with D0-D8-D10 protocol for 2 rounds', () => {
      const lot: Lot = {
        id: 'lot-2',
        name: 'Lote B',
        protocolId: 'test-2',
        d0: new Date(2024, 0, 15), // Jan 15 2024
        roundInterval: 22
      };

      const result = calculateLotSchedule(lot, protocolD0D8D10, 2);

      expect(result).toHaveLength(6); // 3 days * 2 rounds

      // Verify D8 and D10 offsets
      expect(result[1].day).toBe(8);
      expect(result[1].date).toEqual(new Date(2024, 0, 23)); // Jan 15 + 8
      expect(result[2].day).toBe(10);
      expect(result[2].date).toEqual(new Date(2024, 0, 25)); // Jan 15 + 10
    });

    it('handles extreme interval (1 day) without error', () => {
      const lot: Lot = {
        id: 'lot-3',
        name: 'Lote C',
        protocolId: 'test-1',
        d0: new Date(2024, 0, 1),
        roundInterval: 1 // Extreme case
      };

      const result = calculateLotSchedule(lot, protocolD0D7D9, 3);

      expect(result).toHaveLength(9); // 3 days * 3 rounds

      // Round 2 D0 should be just 1 day after round 1 D0
      expect(result[3].date).toEqual(new Date(2024, 0, 2)); // Jan 1 + 1 = Jan 2
    });

    it('handles large interval (30 days) with 6 rounds spanning many months', () => {
      const lot: Lot = {
        id: 'lot-4',
        name: 'Lote D',
        protocolId: 'test-1',
        d0: new Date(2024, 0, 1), // Jan 1 2024
        roundInterval: 30
      };

      const result = calculateLotSchedule(lot, protocolD0D7D9, 6);

      expect(result).toHaveLength(18); // 3 days * 6 rounds

      // Round 6 D0: Jan 1 + (5 * 30) = Jan 1 + 150 days
      const lastRoundD0 = result[15];
      expect(lastRoundD0.day).toBe(0);
      expect(lastRoundD0.roundLabel).toBe('A6');
      // Jan 1 + 150 days = May 30 2024
      expect(lastRoundD0.date).toEqual(new Date(2024, 4, 30));
    });
  });
});
