import { DateOnly } from './DateOnly';
import { Protocol } from './Protocol';
import { ROUND_NAMES } from '../constants';

/**
 * Lot - Immutable lot value object
 *
 * Represents a breeding lot with a name, starting date (D0), protocol, and round gaps.
 * roundGaps[i] = number of days between the LAST protocol day of round i and D0 of round i+1.
 */
export class Lot {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly d0: DateOnly,
    public readonly protocol: Protocol,
    public readonly roundGaps: readonly number[] = [22, 22, 22],
    public readonly animalCount: number = 100
  ) {
    // Validation
    if (name.trim().length === 0) {
      throw new Error('Lot name cannot be empty');
    }
    for (const gap of roundGaps) {
      if (gap < 1) {
        throw new Error('Round gap must be at least 1 day');
      }
    }
    if (animalCount < 1) {
      throw new Error('Animal count must be at least 1');
    }
  }

  /**
   * Create a new lot
   */
  static create(
    id: string,
    name: string,
    d0: DateOnly,
    protocol: Protocol,
    roundGaps: readonly number[] = [22, 22, 22],
    animalCount: number = 100
  ): Lot {
    return new Lot(id, name, d0, protocol, roundGaps, animalCount);
  }

  /**
   * Create a new lot with updated D0 (immutable update)
   */
  withD0(newD0: DateOnly): Lot {
    return new Lot(this.id, this.name, newD0, this.protocol, this.roundGaps, this.animalCount);
  }

  /**
   * Create a new lot with updated protocol (immutable update)
   */
  withProtocol(newProtocol: Protocol): Lot {
    return new Lot(this.id, this.name, this.d0, newProtocol, this.roundGaps, this.animalCount);
  }

  /**
   * Create a new lot with updated name (immutable update)
   */
  withName(newName: string): Lot {
    return new Lot(this.id, newName, this.d0, this.protocol, this.roundGaps, this.animalCount);
  }

  /**
   * Create a new lot with a single round gap changed (immutable update)
   * @param index - Gap index (0 = between R1→R2, 1 = between R2→R3, etc.)
   * @param newGap - New gap value in days
   */
  withRoundGap(index: number, newGap: number): Lot {
    const newGaps = [...this.roundGaps];
    newGaps[index] = newGap;
    return new Lot(this.id, this.name, this.d0, this.protocol, newGaps, this.animalCount);
  }

  /**
   * Create a new lot with updated animal count (immutable update)
   */
  withAnimalCount(newCount: number): Lot {
    return new Lot(this.id, this.name, this.d0, this.protocol, this.roundGaps, newCount);
  }

  /**
   * Calculate the number of animals in each round based on success rates.
   *
   * Each round's remaining animals = previous round animals - floor(previous * rate/100).
   *
   * @param successRates - Success rate (%) for each round [R1, R2, R3, R4]
   * @param rounds - Number of rounds (default 4)
   * @returns Array with animal count per round
   */
  getAnimalsPerRound(successRates: readonly number[], rounds: number = 4): number[] {
    const result: number[] = [this.animalCount];
    for (let i = 1; i < rounds; i++) {
      const prev = result[i - 1]!;
      const rate = successRates[i - 1] ?? 0;
      const successful = Math.floor(prev * rate / 100);
      result.push(prev - successful);
    }
    return result;
  }

  /**
   * Get all protocol intervals for all rounds
   *
   * Uses cumulative offsets where each round's D0 starts at:
   *   previous round last protocol day + gap[round-1]
   *
   * Example with protocol [0,7,9] and gaps [22,21,22]:
   *   R1: offsets 0, 7, 9
   *   R2: offsets 31 (9+22), 38, 40
   *   R3: offsets 61 (40+21), 68, 70
   *   R4: offsets 92 (70+22), 99, 101
   *
   * @param rounds - Number of rounds (default 4)
   */
  getIntervals(rounds: number = 4): Array<{
    roundId: number;
    roundName: string;
    protocolDay: number;
    dayOffset: number;
  }> {
    const result: Array<{
      roundId: number;
      roundName: string;
      protocolDay: number;
      dayOffset: number;
    }> = [];

    const lastProtocolDay = this.protocol.intervals[this.protocol.intervals.length - 1] ?? 0;
    let roundStartOffset = 0;

    for (let round = 0; round < rounds; round++) {
      if (round > 0) {
        const gap = this.roundGaps[round - 1] ?? 22;
        roundStartOffset += lastProtocolDay + gap;
      }

      const roundName = ROUND_NAMES[round] ?? `Rodada ${round + 1}`;

      for (const protocolDay of this.protocol.intervals) {
        result.push({
          roundId: round,
          roundName,
          protocolDay,
          dayOffset: roundStartOffset + protocolDay,
        });
      }
    }

    return result;
  }

  /**
   * Get the start offset for a specific round
   */
  getRoundStartOffset(roundIndex: number): number {
    const lastProtocolDay = this.protocol.intervals[this.protocol.intervals.length - 1] ?? 0;
    let offset = 0;

    for (let i = 0; i < roundIndex; i++) {
      const gap = this.roundGaps[i] ?? 22;
      offset += lastProtocolDay + gap;
    }

    return offset;
  }

  /**
   * Check equality
   */
  equals(other: Lot): boolean {
    return (
      this.id === other.id &&
      this.name === other.name &&
      this.d0.equals(other.d0) &&
      this.protocol.equals(other.protocol) &&
      this.roundGaps.length === other.roundGaps.length &&
      this.roundGaps.every((g, i) => g === other.roundGaps[i]) &&
      this.animalCount === other.animalCount
    );
  }

  /**
   * Serialize to JSON
   */
  toJSON(): {
    id: string;
    name: string;
    d0: { year: number; month: number; day: number };
    protocol: {
      id: string;
      name: string;
      intervals: readonly number[];
      type: string;
    };
    roundGaps: readonly number[];
    animalCount: number;
  } {
    return {
      id: this.id,
      name: this.name,
      d0: this.d0.toJSON(),
      protocol: this.protocol.toJSON(),
      roundGaps: this.roundGaps,
      animalCount: this.animalCount,
    };
  }

  /**
   * Deserialize from JSON (handles both old roundInterval and new roundGaps format)
   */
  static fromJSON(json: {
    id: string;
    name: string;
    d0: { year: number; month: number; day: number };
    protocol: {
      id: string;
      name: string;
      intervals: readonly number[];
      type: 'D0-D7-D9' | 'D0-D8-D10' | 'D0-D9-D11' | 'custom';
    };
    roundGaps?: readonly number[];
    roundInterval?: number;
    animalCount?: number;
  }): Lot {
    // Handle migration from old roundInterval to new roundGaps
    let gaps: readonly number[];
    if (json.roundGaps) {
      gaps = json.roundGaps;
    } else if (json.roundInterval !== undefined) {
      gaps = [json.roundInterval, json.roundInterval, json.roundInterval];
    } else {
      gaps = [22, 22, 22];
    }

    return new Lot(
      json.id,
      json.name,
      DateOnly.fromJSON(json.d0),
      Protocol.fromJSON(json.protocol),
      gaps,
      json.animalCount ?? 100
    );
  }
}
