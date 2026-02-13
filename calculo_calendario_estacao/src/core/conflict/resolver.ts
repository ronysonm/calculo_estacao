/**
 * Conflict Resolver - CSP Solver
 *
 * Uses a greedy heuristic with backtracking to resolve conflicts.
 * Prevents browser freeze with iteration limit and timeout.
 *
 * CRITICAL: This is NOT brute-force to prevent Pitfall #4.
 * Uses greedy heuristic: most constrained first, limited search depth.
 */

import { Lot } from '@/domain/value-objects/Lot';
import { addDaysToDateOnly } from '@/core/date-engine/utils';
import { calculateAllHandlingDates } from '@/core/date-engine/calculator';
import { detectConflicts } from './detector';
import { DEFAULT_ROUNDS } from '@/domain/constants';

export interface ResolutionResult {
  success: boolean;
  lots: Lot[];
  conflictCount: number;
  iterations: number;
  message: string;
  timeMs: number;
}

/**
 * ConflictResolver - CSP solver using greedy heuristic
 */
export class ConflictResolver {
  private iterations = 0;
  private readonly MAX_ITERATIONS = 10000;
  private readonly TIMEOUT_MS = 2000;
  private readonly MAX_SHIFT = 7; // Max days to shift in each direction
  private startTime = 0;

  constructor(
    private readonly originalLots: Lot[],
    private readonly lockedLotIds: Set<string>
  ) {}

  /**
   * Resolve conflicts using greedy heuristic
   *
   * @returns Resolution result
   */
  resolve(): ResolutionResult {
    this.startTime = Date.now();
    this.iterations = 0;

    // Initial state
    let currentLots = [...this.originalLots];
    let currentConflicts = this.countConflicts(currentLots);

    if (currentConflicts === 0) {
      return {
        success: true,
        lots: currentLots,
        conflictCount: 0,
        iterations: 0,
        message: 'Nenhum conflito encontrado',
        timeMs: Date.now() - this.startTime,
      };
    }

    // Best solution found so far
    let bestLots = currentLots;
    let bestConflictCount = currentConflicts;

    // Greedy search
    while (
      this.iterations < this.MAX_ITERATIONS &&
      Date.now() - this.startTime < this.TIMEOUT_MS &&
      currentConflicts > 0
    ) {
      this.iterations++;

      // Find lot with most conflicts (most constrained first)
      const lotWithMostConflicts = this.findMostConstrainedLot(currentLots);

      if (!lotWithMostConflicts) break;

      // Skip if locked
      if (this.lockedLotIds.has(lotWithMostConflicts.id)) {
        // Can't move this lot, try removing from consideration
        currentLots = currentLots.filter((l) => l.id !== lotWithMostConflicts.id);
        continue;
      }

      // Try shifting D0 by ±1, ±2, ..., ±MAX_SHIFT days
      let improved = false;

      for (let shift = 1; shift <= this.MAX_SHIFT; shift++) {
        for (const direction of [1, -1]) {
          const shiftDays = shift * direction;
          const newD0 = addDaysToDateOnly(lotWithMostConflicts.d0, shiftDays);
          const newLot = lotWithMostConflicts.withD0(newD0);

          // Test new configuration
          const testLots = currentLots.map((l) =>
            l.id === newLot.id ? newLot : l
          );

          const testConflicts = this.countConflicts(testLots);

          // Check for improvement
          if (testConflicts < currentConflicts) {
            currentLots = testLots;
            currentConflicts = testConflicts;
            improved = true;

            // Update best solution
            if (testConflicts < bestConflictCount) {
              bestLots = testLots;
              bestConflictCount = testConflicts;
            }

            if (testConflicts === 0) {
              // Perfect solution found!
              return {
                success: true,
                lots: testLots,
                conflictCount: 0,
                iterations: this.iterations,
                message: `Todos os conflitos resolvidos em ${this.iterations} iterações`,
                timeMs: Date.now() - this.startTime,
              };
            }

            break; // Found improvement, move to next lot
          }
        }

        if (improved) break;
      }

      // If no improvement found, this lot is stuck
      // Move to next lot
      if (!improved) {
        // Remove from active consideration
        currentLots = currentLots.filter((l) => l.id !== lotWithMostConflicts.id);

        if (currentLots.length === 0) break;
      }
    }

    // Return best solution found
    const timeMs = Date.now() - this.startTime;

    if (bestConflictCount === 0) {
      return {
        success: true,
        lots: bestLots,
        conflictCount: 0,
        iterations: this.iterations,
        message: `Todos os conflitos resolvidos em ${this.iterations} iterações`,
        timeMs,
      };
    } else if (bestConflictCount < this.countConflicts(this.originalLots)) {
      return {
        success: false,
        lots: bestLots,
        conflictCount: bestConflictCount,
        iterations: this.iterations,
        message: `Melhor solução: ${bestConflictCount} conflito${bestConflictCount > 1 ? 's' : ''} (não foi possível resolver todos)`,
        timeMs,
      };
    } else {
      return {
        success: false,
        lots: this.originalLots,
        conflictCount: this.countConflicts(this.originalLots),
        iterations: this.iterations,
        message: 'Não foi possível melhorar a configuração atual',
        timeMs,
      };
    }
  }

  /**
   * Count total conflicts for a lot configuration
   */
  private countConflicts(lots: Lot[]): number {
    const handlingDates = calculateAllHandlingDates(lots, DEFAULT_ROUNDS);
    const conflicts = detectConflicts(handlingDates);
    return conflicts.length;
  }

  /**
   * Find lot with most conflicts (most constrained first heuristic)
   */
  private findMostConstrainedLot(lots: Lot[]): Lot | null {
    if (lots.length === 0) return null;

    const handlingDates = calculateAllHandlingDates(lots, DEFAULT_ROUNDS);
    const conflicts = detectConflicts(handlingDates);

    // Count conflicts per lot
    const conflictCounts = new Map<string, number>();

    for (const conflict of conflicts) {
      for (const hd of conflict.handlingDates) {
        const count = conflictCounts.get(hd.lotId) || 0;
        conflictCounts.set(hd.lotId, count + 1);
      }
    }

    // Find lot with most conflicts
    let maxConflicts = 0;
    let mostConstrainedLot: Lot | null = null;

    for (const lot of lots) {
      const conflicts = conflictCounts.get(lot.id) || 0;
      if (conflicts > maxConflicts) {
        maxConflicts = conflicts;
        mostConstrainedLot = lot;
      }
    }

    // If no lot has conflicts, return first unlocked lot
    if (!mostConstrainedLot) {
      return lots.find((lot) => !this.lockedLotIds.has(lot.id)) || null;
    }

    return mostConstrainedLot;
  }
}

/**
 * Quick resolve function for simple use cases
 *
 * @param lots - Lots to resolve conflicts for
 * @param lockedLotIds - Locked lot IDs (optional)
 * @returns Resolution result
 */
export function resolveConflicts(
  lots: Lot[],
  lockedLotIds: Set<string> = new Set()
): ResolutionResult {
  const resolver = new ConflictResolver(lots, lockedLotIds);
  return resolver.resolve();
}
