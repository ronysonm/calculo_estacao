import { describe, it, expect } from 'vitest';
import {
  PREDEFINED_PROTOCOLS,
  DEFAULT_LOT_NAMES,
  getAllProtocols,
  getProtocolById,
} from './protocols';
import { createProtocol } from '../models/Protocol';

describe('protocols constants', () => {
  describe('PREDEFINED_PROTOCOLS', () => {
    it('contains exactly 3 pre-defined protocols', () => {
      expect(PREDEFINED_PROTOCOLS).toHaveLength(3);
    });

    it('has D0-D7-D9 protocol with stable ID', () => {
      const protocol = PREDEFINED_PROTOCOLS[0];

      expect(protocol.id).toBe('predefined-d0-d7-d9');
      expect(protocol.name).toBe('D0-D7-D9');
      expect(protocol.days).toEqual([0, 7, 9]);
      expect(protocol.isPredefined).toBe(true);
    });

    it('has D0-D8-D10 protocol with stable ID', () => {
      const protocol = PREDEFINED_PROTOCOLS[1];

      expect(protocol.id).toBe('predefined-d0-d8-d10');
      expect(protocol.name).toBe('D0-D8-D10');
      expect(protocol.days).toEqual([0, 8, 10]);
      expect(protocol.isPredefined).toBe(true);
    });

    it('has D0-D9-D11 protocol with stable ID', () => {
      const protocol = PREDEFINED_PROTOCOLS[2];

      expect(protocol.id).toBe('predefined-d0-d9-d11');
      expect(protocol.name).toBe('D0-D9-D11');
      expect(protocol.days).toEqual([0, 9, 11]);
      expect(protocol.isPredefined).toBe(true);
    });

    it('is frozen', () => {
      expect(Object.isFrozen(PREDEFINED_PROTOCOLS)).toBe(true);
    });

    it('has frozen protocol objects', () => {
      PREDEFINED_PROTOCOLS.forEach((protocol) => {
        expect(Object.isFrozen(protocol)).toBe(true);
        expect(Object.isFrozen(protocol.days)).toBe(true);
      });
    });
  });

  describe('DEFAULT_LOT_NAMES', () => {
    it('contains 5 standard lot names', () => {
      expect(DEFAULT_LOT_NAMES).toHaveLength(5);
      expect(DEFAULT_LOT_NAMES).toEqual([
        'Primiparas',
        'Secundiparas',
        'Multiparas/Solteiras',
        'Novilhas Tradicional',
        'Novilhas Precoce',
      ]);
    });

    it('is frozen', () => {
      expect(Object.isFrozen(DEFAULT_LOT_NAMES)).toBe(true);
    });
  });

  describe('getAllProtocols', () => {
    it('returns only pre-defined protocols when no custom protocols', () => {
      const all = getAllProtocols([]);

      expect(all).toHaveLength(3);
      expect(all[0].id).toBe('predefined-d0-d7-d9');
      expect(all[1].id).toBe('predefined-d0-d8-d10');
      expect(all[2].id).toBe('predefined-d0-d9-d11');
    });

    it('returns pre-defined + custom protocols', () => {
      const custom = createProtocol([0, 6, 8]);
      const all = getAllProtocols([custom]);

      expect(all).toHaveLength(4);
      expect(all[0].id).toBe('predefined-d0-d7-d9');
      expect(all[1].id).toBe('predefined-d0-d8-d10');
      expect(all[2].id).toBe('predefined-d0-d9-d11');
      expect(all[3].id).toBe(custom.id);
    });

    it('pre-defined protocols always come first', () => {
      const custom1 = createProtocol([0, 5, 7]);
      const custom2 = createProtocol([0, 10, 12]);
      const all = getAllProtocols([custom1, custom2]);

      expect(all).toHaveLength(5);
      expect(all[0].isPredefined).toBe(true);
      expect(all[1].isPredefined).toBe(true);
      expect(all[2].isPredefined).toBe(true);
      expect(all[3].isPredefined).toBe(false);
      expect(all[4].isPredefined).toBe(false);
    });
  });

  describe('getProtocolById', () => {
    it('finds pre-defined protocol by stable ID', () => {
      const protocol = getProtocolById('predefined-d0-d7-d9', []);

      expect(protocol).toBeDefined();
      expect(protocol?.id).toBe('predefined-d0-d7-d9');
      expect(protocol?.days).toEqual([0, 7, 9]);
    });

    it('finds custom protocol by ID', () => {
      const custom = createProtocol([0, 6, 8]);
      const protocol = getProtocolById(custom.id, [custom]);

      expect(protocol).toBeDefined();
      expect(protocol?.id).toBe(custom.id);
    });

    it('returns undefined for non-existent ID', () => {
      const protocol = getProtocolById('non-existent', []);

      expect(protocol).toBeUndefined();
    });

    it('searches pre-defined before custom', () => {
      const custom = createProtocol([0, 6, 8]);
      const protocol = getProtocolById('predefined-d0-d8-d10', [custom]);

      expect(protocol).toBeDefined();
      expect(protocol?.id).toBe('predefined-d0-d8-d10');
      expect(protocol?.isPredefined).toBe(true);
    });
  });
});
