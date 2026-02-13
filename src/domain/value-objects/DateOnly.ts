/**
 * DateOnly - Immutable date value object that prevents timezone bugs
 *
 * CRITICAL: Stores dates as {year, month, day} instead of Date or ISO string.
 * This prevents JavaScript date pitfalls:
 * - Pitfall #1: Month off-by-one (JS uses 0-11, we use 1-12)
 * - Pitfall #2: Timezone interpretation bugs
 * - Pitfall #3: Month overflow creating bizarre dates
 */
export class DateOnly {
  /**
   * @param year - Full year (e.g., 2026)
   * @param month - Month from 1-12 (1=January, NOT 0-11 like JavaScript Date)
   * @param day - Day of month (1-31)
   */
  constructor(
    public readonly year: number,
    public readonly month: number,
    public readonly day: number
  ) {
    // Validation
    if (month < 1 || month > 12) {
      throw new Error(`Invalid month: ${month}. Must be 1-12.`);
    }
    if (day < 1 || day > 31) {
      throw new Error(`Invalid day: ${day}. Must be 1-31.`);
    }
  }

  /**
   * Create DateOnly from year, month, day
   * @param year - Full year
   * @param month - Month 1-12 (NOT 0-11)
   * @param day - Day 1-31
   */
  static create(year: number, month: number, day: number): DateOnly {
    return new DateOnly(year, month, day);
  }

  /**
   * Create DateOnly from JavaScript Date object
   * CRITICAL: Converts JavaScript's 0-11 month to our 1-12 month
   */
  static fromDate(date: Date): DateOnly {
    return new DateOnly(
      date.getFullYear(),
      date.getMonth() + 1, // Convert JS 0-11 to our 1-12
      date.getDate()
    );
  }

  /**
   * Convert to JavaScript Date object (at midnight local time)
   * CRITICAL: Converts our 1-12 month to JavaScript's 0-11 month
   */
  toDate(): Date {
    return new Date(this.year, this.month - 1, this.day); // Convert our 1-12 to JS 0-11
  }

  /**
   * Format as dd/mm/yyyy
   */
  toString(): string {
    const dd = String(this.day).padStart(2, '0');
    const mm = String(this.month).padStart(2, '0');
    const yyyy = String(this.year);
    return `${dd}/${mm}/${yyyy}`;
  }

  /**
   * Format as yyyy-mm-dd (ISO-like, but timezone-safe)
   */
  toISOString(): string {
    const dd = String(this.day).padStart(2, '0');
    const mm = String(this.month).padStart(2, '0');
    const yyyy = String(this.year);
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Parse from yyyy-mm-dd format
   */
  static fromISOString(str: string): DateOnly {
    const parts = str.split('-');
    if (parts.length !== 3) {
      throw new Error(`Invalid ISO date format: ${str}. Expected yyyy-mm-dd.`);
    }
    const year = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10);
    const day = parseInt(parts[2]!, 10);
    return new DateOnly(year, month, day);
  }

  /**
   * Check equality
   */
  equals(other: DateOnly): boolean {
    return (
      this.year === other.year &&
      this.month === other.month &&
      this.day === other.day
    );
  }

  /**
   * Compare dates (-1 if this < other, 0 if equal, 1 if this > other)
   */
  compareTo(other: DateOnly): number {
    if (this.year !== other.year) {
      return this.year < other.year ? -1 : 1;
    }
    if (this.month !== other.month) {
      return this.month < other.month ? -1 : 1;
    }
    if (this.day !== other.day) {
      return this.day < other.day ? -1 : 1;
    }
    return 0;
  }

  /**
   * Check if this date is before other
   */
  isBefore(other: DateOnly): boolean {
    return this.compareTo(other) < 0;
  }

  /**
   * Add days and return new DateOnly (timezone-safe using UTC)
   */
  addDays(days: number): DateOnly {
    const date = new Date(Date.UTC(this.year, this.month - 1, this.day));
    date.setUTCDate(date.getUTCDate() + days);

    return DateOnly.create(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate()
    );
  }

  /**
   * Calculate days from other to this (this - other)
   * Positive if this is after other, negative if before
   */
  daysSince(other: DateOnly): number {
    const thisMs = Date.UTC(this.year, this.month - 1, this.day);
    const otherMs = Date.UTC(other.year, other.month - 1, other.day);
    return Math.round((thisMs - otherMs) / (1000 * 60 * 60 * 24));
  }

  /**
   * Serialize to JSON
   */
  toJSON(): { year: number; month: number; day: number } {
    return { year: this.year, month: this.month, day: this.day };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: { year: number; month: number; day: number }): DateOnly {
    return new DateOnly(json.year, json.month, json.day);
  }
}
