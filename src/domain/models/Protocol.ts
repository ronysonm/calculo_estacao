/**
 * Protocol domain model
 *
 * A Protocol represents a sequence of exactly 3 manejos (handling days).
 * Protocols can be pre-defined (immutable) or custom (user-created).
 */

export interface Protocol {
  readonly id: string;
  readonly name: string;
  readonly days: readonly [number, number, number];
  readonly isPredefined: boolean;
}

export interface CreateProtocolOptions {
  id?: string;
  isPredefined?: boolean;
}

/**
 * Create a new Protocol with the given days.
 *
 * @param days - Exactly 3 manejo days (e.g., [0, 7, 9])
 * @param options - Optional id and isPredefined flag
 * @returns A frozen Protocol instance
 */
export function createProtocol(
  days: [number, number, number],
  options: CreateProtocolOptions = {}
): Protocol {
  const { id = crypto.randomUUID(), isPredefined = false } = options;

  const name = `D${days[0]}-D${days[1]}-D${days[2]}`;
  const frozenDays = Object.freeze([...days]) as readonly [number, number, number];

  const protocol: Protocol = {
    id,
    name,
    days: frozenDays,
    isPredefined,
  };

  return Object.freeze(protocol);
}

/**
 * Update a Protocol with new values.
 * Returns a new Protocol instance (immutable update).
 *
 * @param protocol - The protocol to update
 * @param updates - Fields to update (only days is supported)
 * @returns A new Protocol instance with updated values
 * @throws Error if protocol is pre-defined (pre-defined protocols cannot be edited)
 */
export function updateProtocol(
  protocol: Protocol,
  updates: { days?: [number, number, number] }
): Protocol {
  if (protocol.isPredefined) {
    throw new Error('Cannot update pre-defined protocol');
  }

  const days = updates.days ?? (protocol.days as [number, number, number]);

  return createProtocol(days, {
    id: protocol.id,
    isPredefined: protocol.isPredefined,
  });
}

/**
 * Check if a protocol can be deleted.
 * Pre-defined protocols cannot be deleted.
 *
 * @param protocol - The protocol to check
 * @returns true if the protocol can be deleted
 */
export function canDeleteProtocol(protocol: Protocol): boolean {
  return !protocol.isPredefined;
}
