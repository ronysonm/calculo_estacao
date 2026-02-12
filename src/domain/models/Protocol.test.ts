import { describe, it, expect } from 'vitest';
import { createProtocol, updateProtocol, canDeleteProtocol } from './Protocol';

describe('Protocol', () => {
  describe('createProtocol', () => {
    it('creates a protocol with auto-generated name from days', () => {
      const protocol = createProtocol([0, 7, 9]);

      expect(protocol.name).toBe('D0-D7-D9');
      expect(protocol.days).toEqual([0, 7, 9]);
      expect(protocol.isPredefined).toBe(false);
    });

    it('creates a protocol with custom id', () => {
      const protocol = createProtocol([0, 8, 10], { id: 'custom-id' });

      expect(protocol.id).toBe('custom-id');
    });

    it('creates a pre-defined protocol', () => {
      const protocol = createProtocol([0, 7, 9], { isPredefined: true });

      expect(protocol.isPredefined).toBe(true);
    });

    it('freezes the days array', () => {
      const protocol = createProtocol([0, 7, 9]);

      expect(Object.isFrozen(protocol.days)).toBe(true);
    });

    it('enforces days as readonly tuple type', () => {
      const protocol = createProtocol([0, 7, 9]);

      // This test verifies the type is readonly [number, number, number]
      // TypeScript will error if days is treated as number[]
      const _days: readonly [number, number, number] = protocol.days;
      expect(_days).toEqual([0, 7, 9]);
    });
  });

  describe('updateProtocol', () => {
    it('returns a new protocol with updated days', () => {
      const protocol = createProtocol([0, 7, 9]);
      const updated = updateProtocol(protocol, { days: [0, 8, 10] });

      expect(updated.id).toBe(protocol.id);
      expect(updated.days).toEqual([0, 8, 10]);
      expect(updated.name).toBe('D0-D8-D10');
    });

    it('throws error when updating pre-defined protocol', () => {
      const protocol = createProtocol([0, 7, 9], { isPredefined: true });

      expect(() => {
        updateProtocol(protocol, { days: [0, 8, 10] });
      }).toThrow('Cannot update pre-defined protocol');
    });

    it('returns new instance (immutability)', () => {
      const protocol = createProtocol([0, 7, 9]);
      const updated = updateProtocol(protocol, { days: [0, 8, 10] });

      expect(updated).not.toBe(protocol);
      expect(protocol.days).toEqual([0, 7, 9]);
    });
  });

  describe('canDeleteProtocol', () => {
    it('returns true for custom protocol', () => {
      const protocol = createProtocol([0, 7, 9]);

      expect(canDeleteProtocol(protocol)).toBe(true);
    });

    it('returns false for pre-defined protocol', () => {
      const protocol = createProtocol([0, 7, 9], { isPredefined: true });

      expect(canDeleteProtocol(protocol)).toBe(false);
    });
  });
});
