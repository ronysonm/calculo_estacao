import { describe, it, expect } from 'vitest';
import { createLot, updateLot } from './Lot';

describe('Lot', () => {
  describe('createLot', () => {
    it('creates a lot with all required fields', () => {
      const d0 = new Date('2024-01-15');
      const lot = createLot('Primiparas', 'protocol-123', d0);

      expect(lot.name).toBe('Primiparas');
      expect(lot.protocolId).toBe('protocol-123');
      expect(lot.d0).toBe(d0);
      expect(lot.roundInterval).toBe(22);
    });

    it('creates a lot with custom round interval', () => {
      const d0 = new Date('2024-01-15');
      const lot = createLot('Novilhas', 'protocol-456', d0, 28);

      expect(lot.roundInterval).toBe(28);
    });

    it('generates unique id', () => {
      const d0 = new Date('2024-01-15');
      const lot1 = createLot('Lot 1', 'protocol-123', d0);
      const lot2 = createLot('Lot 2', 'protocol-123', d0);

      expect(lot1.id).not.toBe(lot2.id);
    });

    it('is frozen', () => {
      const d0 = new Date('2024-01-15');
      const lot = createLot('Primiparas', 'protocol-123', d0);

      expect(Object.isFrozen(lot)).toBe(true);
    });
  });

  describe('updateLot', () => {
    it('returns new lot with updated name', () => {
      const d0 = new Date('2024-01-15');
      const lot = createLot('Primiparas', 'protocol-123', d0);
      const updated = updateLot(lot, { name: 'Secundiparas' });

      expect(updated.id).toBe(lot.id);
      expect(updated.name).toBe('Secundiparas');
      expect(updated.protocolId).toBe(lot.protocolId);
      expect(updated.d0).toBe(lot.d0);
    });

    it('returns new lot with updated protocol', () => {
      const d0 = new Date('2024-01-15');
      const lot = createLot('Primiparas', 'protocol-123', d0);
      const updated = updateLot(lot, { protocolId: 'protocol-456' });

      expect(updated.protocolId).toBe('protocol-456');
    });

    it('returns new lot with updated d0', () => {
      const d0 = new Date('2024-01-15');
      const newD0 = new Date('2024-02-01');
      const lot = createLot('Primiparas', 'protocol-123', d0);
      const updated = updateLot(lot, { d0: newD0 });

      expect(updated.d0).toBe(newD0);
    });

    it('returns new lot with updated round interval', () => {
      const d0 = new Date('2024-01-15');
      const lot = createLot('Primiparas', 'protocol-123', d0);
      const updated = updateLot(lot, { roundInterval: 28 });

      expect(updated.roundInterval).toBe(28);
    });

    it('returns new instance (immutability)', () => {
      const d0 = new Date('2024-01-15');
      const lot = createLot('Primiparas', 'protocol-123', d0);
      const updated = updateLot(lot, { name: 'Secundiparas' });

      expect(updated).not.toBe(lot);
      expect(lot.name).toBe('Primiparas');
    });
  });
});
