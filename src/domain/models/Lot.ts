/**
 * Lot domain model
 *
 * A Lot represents a group of animals that share:
 * - A protocol (sequence of manejo days)
 * - A D0 start date
 * - A round interval (days between rounds)
 */

export interface Lot {
  readonly id: string;
  readonly name: string;
  readonly protocolId: string;
  readonly d0: Date;
  readonly roundInterval: number;
}

/**
 * Create a new Lot.
 *
 * @param name - Lot name (e.g., "Primiparas")
 * @param protocolId - ID of the protocol this lot uses
 * @param d0 - Start date for this lot
 * @param roundInterval - Days between rounds (default 22)
 * @returns A new Lot instance
 */
export function createLot(
  name: string,
  protocolId: string,
  d0: Date,
  roundInterval: number = 22
): Lot {
  const lot: Lot = {
    id: crypto.randomUUID(),
    name,
    protocolId,
    d0,
    roundInterval,
  };

  return Object.freeze(lot);
}

/**
 * Update a Lot with new values.
 * Returns a new Lot instance (immutable update).
 *
 * @param lot - The lot to update
 * @param updates - Fields to update
 * @returns A new Lot instance with updated values
 */
export function updateLot(
  lot: Lot,
  updates: Partial<Pick<Lot, 'name' | 'protocolId' | 'd0' | 'roundInterval'>>
): Lot {
  const updatedLot: Lot = {
    id: lot.id, // Preserve original ID
    name: updates.name ?? lot.name,
    protocolId: updates.protocolId ?? lot.protocolId,
    d0: updates.d0 ?? lot.d0,
    roundInterval: updates.roundInterval ?? lot.roundInterval,
  };

  return Object.freeze(updatedLot);
}
