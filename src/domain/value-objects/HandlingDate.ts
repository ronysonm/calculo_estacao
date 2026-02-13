import { DateOnly } from './DateOnly';

/**
 * HandlingDate - Single handling date with metadata
 *
 * Represents a specific handling date for a lot in a round.
 */
export class HandlingDate {
  constructor(
    public readonly lotId: string,
    public readonly lotName: string,
    public readonly roundId: number,
    public readonly roundName: string,
    public readonly protocolDay: number,
    public readonly date: DateOnly
  ) {}

  /**
   * Create a new handling date
   */
  static create(
    lotId: string,
    lotName: string,
    roundId: number,
    roundName: string,
    protocolDay: number,
    date: DateOnly
  ): HandlingDate {
    return new HandlingDate(lotId, lotName, roundId, roundName, protocolDay, date);
  }

  /**
   * Check equality
   */
  equals(other: HandlingDate): boolean {
    return (
      this.lotId === other.lotId &&
      this.lotName === other.lotName &&
      this.roundId === other.roundId &&
      this.protocolDay === other.protocolDay &&
      this.date.equals(other.date)
    );
  }

  /**
   * Serialize to JSON
   */
  toJSON(): {
    lotId: string;
    lotName: string;
    roundId: number;
    roundName: string;
    protocolDay: number;
    date: { year: number; month: number; day: number };
  } {
    return {
      lotId: this.lotId,
      lotName: this.lotName,
      roundId: this.roundId,
      roundName: this.roundName,
      protocolDay: this.protocolDay,
      date: this.date.toJSON(),
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: {
    lotId: string;
    lotName: string;
    roundId: number;
    roundName: string;
    protocolDay: number;
    date: { year: number; month: number; day: number };
  }): HandlingDate {
    return new HandlingDate(
      json.lotId,
      json.lotName,
      json.roundId,
      json.roundName,
      json.protocolDay,
      DateOnly.fromJSON(json.date)
    );
  }
}
