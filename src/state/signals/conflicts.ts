/**
 * Conflicts State - Derived reactive state for conflict detection
 */

import { signal, computed } from '@preact/signals';
import { lotsSignal } from './lots';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { HandlingDate } from '@/domain/value-objects/HandlingDate';
import { Conflict } from '@/domain/value-objects/Conflict';
import {
  CustomHoliday,
  Holiday,
  expandNationalHolidays,
} from '@/domain/value-objects/Holiday';
import { calculateAllHandlingDates } from '@/core/date-engine/calculator';
import { detectConflicts } from '@/core/conflict/detector';
import { DEFAULT_ROUNDS } from '@/domain/constants';

/**
 * Mutable signal: user-defined custom holidays (persisted per-estação)
 */
export const customHolidaysSignal = signal<CustomHoliday[]>([]);

export function setCustomHolidays(holidays: CustomHoliday[]): void {
  customHolidaysSignal.value = holidays;
}

/**
 * Computed: all handling dates for all lots
 */
export const handlingDatesSignal = computed<HandlingDate[]>(() => {
  return calculateAllHandlingDates(lotsSignal.value, DEFAULT_ROUNDS);
});

/**
 * Computed: expanded national + custom holidays for years in the current cycle
 */
export const allHolidaysSignal = computed<Holiday[]>(() => {
  const handlingDates = handlingDatesSignal.value;
  const years = [...new Set(handlingDates.map((hd) => hd.date.year))];
  if (years.length === 0) {
    years.push(new Date().getFullYear());
  }
  const national = expandNationalHolidays(years);
  const custom: Holiday[] = customHolidaysSignal.value.map((ch) => ({
    date: ch.date,
    name: ch.name,
    isCustom: true,
  }));
  return [...national, ...custom];
});

/**
 * Computed: all conflicts (Sunday + Overlap + Holiday)
 */
export const conflictsSignal = computed<Conflict[]>(() => {
  return detectConflicts(handlingDatesSignal.value, allHolidaysSignal.value);
});

/**
 * Computed: conflict summary including holiday count
 */
export const conflictSummarySignal = computed<{
  total: number;
  sundays: number;
  overlaps: number;
  holidays: number;
}>(() => {
  const conflicts = conflictsSignal.value;
  const sundays = conflicts.filter((c) => c.type === 'sunday').length;
  const overlaps = conflicts.filter((c) => c.type === 'overlap').length;
  const holidays = conflicts.filter((c) => c.type === 'holiday').length;
  return { total: conflicts.length, sundays, overlaps, holidays };
});

/**
 * Computed: global cycle start = earliest D0 among all lots
 */
export const cycleStartSignal = computed<DateOnly | null>(() => {
  const lots = lotsSignal.value;
  if (lots.length === 0) return null;
  return lots.reduce<DateOnly>(
    (min, lot) => (lot.d0.isBefore(min) ? lot.d0 : min),
    lots[0]!.d0
  );
});
