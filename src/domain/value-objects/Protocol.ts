/**
 * Protocol - Immutable protocol value object
 *
 * Represents a breeding protocol with specific handling intervals.
 * Example: [0, 7, 9] means D0, D7, D9 handling days.
 */
export type ProtocolType = 'D0-D7-D9' | 'D0-D8-D10' | 'D0-D9-D11' | 'custom';

export class Protocol {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly intervals: readonly number[],
    public readonly type: ProtocolType
  ) {
    // Validation
    if (intervals.length === 0) {
      throw new Error('Protocol must have at least one interval');
    }
    if (intervals[0] !== 0) {
      throw new Error('Protocol must start with D0 (interval 0)');
    }
    // Check intervals are sorted ascending
    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i]! <= intervals[i - 1]!) {
        throw new Error('Protocol intervals must be ascending');
      }
    }
  }

  /**
   * Create a new protocol
   */
  static create(
    id: string,
    name: string,
    intervals: readonly number[],
    type: ProtocolType = 'custom'
  ): Protocol {
    return new Protocol(id, name, intervals, type);
  }

  /**
   * Check equality
   */
  equals(other: Protocol): boolean {
    return (
      this.id === other.id &&
      this.name === other.name &&
      this.intervals.length === other.intervals.length &&
      this.intervals.every((val, idx) => val === other.intervals[idx])
    );
  }

  /**
   * Serialize to JSON
   */
  toJSON(): {
    id: string;
    name: string;
    intervals: readonly number[];
    type: ProtocolType;
  } {
    return {
      id: this.id,
      name: this.name,
      intervals: this.intervals,
      type: this.type,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: {
    id: string;
    name: string;
    intervals: readonly number[];
    type: ProtocolType;
  }): Protocol {
    return new Protocol(json.id, json.name, json.intervals, json.type);
  }
}
