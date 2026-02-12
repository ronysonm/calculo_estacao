/**
 * Pre-defined protocol constants
 *
 * These 3 protocols are built into the app and cannot be edited or deleted.
 * They use stable IDs (not random UUIDs) to ensure consistency across sessions.
 */

import type { Protocol } from '../models/Protocol';

/**
 * Pre-defined protocols with stable IDs.
 * These protocols are frozen and immutable.
 */
export const PREDEFINED_PROTOCOLS: readonly Protocol[] = Object.freeze([
  Object.freeze({
    id: 'predefined-d0-d7-d9',
    name: 'D0-D7-D9',
    days: Object.freeze([0, 7, 9]) as readonly [number, number, number],
    isPredefined: true,
  }),
  Object.freeze({
    id: 'predefined-d0-d8-d10',
    name: 'D0-D8-D10',
    days: Object.freeze([0, 8, 10]) as readonly [number, number, number],
    isPredefined: true,
  }),
  Object.freeze({
    id: 'predefined-d0-d9-d11',
    name: 'D0-D9-D11',
    days: Object.freeze([0, 9, 11]) as readonly [number, number, number],
    isPredefined: true,
  }),
]);

/**
 * Default lot names used in the app.
 * These are suggestions; users can create lots with any name.
 */
export const DEFAULT_LOT_NAMES: readonly string[] = Object.freeze([
  'Primiparas',
  'Secundiparas',
  'Multiparas/Solteiras',
  'Novilhas Tradicional',
  'Novilhas Precoce',
]);

/**
 * Get all protocols (pre-defined + custom).
 * Pre-defined protocols always come first.
 *
 * @param customProtocols - User-created custom protocols
 * @returns Combined array of all protocols
 */
export function getAllProtocols(customProtocols: Protocol[]): Protocol[] {
  return [...PREDEFINED_PROTOCOLS, ...customProtocols];
}

/**
 * Find a protocol by ID.
 * Searches pre-defined protocols first, then custom protocols.
 *
 * @param id - Protocol ID to find
 * @param customProtocols - User-created custom protocols
 * @returns The protocol if found, undefined otherwise
 */
export function getProtocolById(
  id: string,
  customProtocols: Protocol[]
): Protocol | undefined {
  // Search pre-defined first
  const predefined = PREDEFINED_PROTOCOLS.find((p) => p.id === id);
  if (predefined) {
    return predefined;
  }

  // Then search custom
  return customProtocols.find((p) => p.id === id);
}
