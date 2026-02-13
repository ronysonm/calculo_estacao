/**
 * Conflicts State - Derived reactive state for conflict detection
 *
 * Automatically recalculates handling dates and conflicts whenever lots change.
 * Uses computed signals for efficient reactivity.
 */

import { computed } from '@preact/signals';
import { lotsSignal } from './lots';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { HandlingDate } from '@/domain/value-objects/HandlingDate';
import { Conflict } from '@/domain/value-objects/Conflict';
import { calculateAllHandlingDates } from '@/core/date-engine/calculator';
import { detectConflicts } from '@/core/conflict/detector';
import { DEFAULT_ROUNDS } from '@/domain/constants';

/**
 * Computed signal: all handling dates for all lots
 * Auto-updates whenever lotsSignal changes
 */
export const handlingDatesSignal = computed<HandlingDate[]>(() => {
  return calculateAllHandlingDates(lotsSignal.value, DEFAULT_ROUNDS);
});

/**
 * Computed signal: all conflicts (Sundays + Overlaps)
 * Auto-updates whenever handlingDatesSignal changes
 */
export const conflictsSignal = computed<Conflict[]>(() => {
  return detectConflicts(handlingDatesSignal.value);
});

/**
 * Computed signal: conflict summary
 * Auto-updates whenever conflictsSignal changes
 */
export const conflictSummarySignal = computed<{
  total: number;
  sundays: number;
  overlaps: number;
}>(() => {
  const conflicts = conflictsSignal.value;
  const sundays = conflicts.filter((c) => c.type === 'sunday').length;
  const overlaps = conflicts.filter((c) => c.type === 'overlap').length;

  return {
    total: conflicts.length,
    sundays,
    overlaps,
  };
});

/**
 * Computed signal: global cycle start = earliest D0 among all lots
 * Returns null when there are no lots
 */
export const cycleStartSignal = computed<DateOnly | null>(() => {
  const lots = lotsSignal.value;
  if (lots.length === 0) return null;
  return lots.reduce<DateOnly>(
    (min, lot) => (lot.d0.isBefore(min) ? lot.d0 : min),
    lots[0]!.d0
  );
});
