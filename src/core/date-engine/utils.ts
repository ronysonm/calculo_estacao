/**
 * Date Engine Utils - date-fns wrappers
 *
 * CRITICAL: ALL date arithmetic must go through date-fns to prevent pitfalls:
 * - Pitfall #1: Month off-by-one errors
 * - Pitfall #2: Timezone interpretation bugs
 * - Pitfall #3: Month overflow creating bizarre dates
 *
 * NEVER use native Date arithmetic (Date.setDate, Date.setMonth, etc.)
 */

import { addDays, getDay } from 'date-fns';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { DAY_NAMES_SHORT } from '@/domain/constants';

/**
 * Add days to a DateOnly
 * Uses date-fns addDays to prevent month overflow bugs
 *
 * @param date - Starting date
 * @param days - Number of days to add (can be negative)
 * @returns New DateOnly with days added
 */
export function addDaysToDateOnly(date: DateOnly, days: number): DateOnly {
  const jsDate = date.toDate();
  const newDate = addDays(jsDate, days);
  return DateOnly.fromDate(newDate);
}

/**
 * Check if a date is Sunday (day 0)
 *
 * @param date - Date to check
 * @returns true if Sunday, false otherwise
 */
export function isSunday(date: DateOnly): boolean {
  const jsDate = date.toDate();
  return getDay(jsDate) === 0;
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeek(date: DateOnly): number {
  const jsDate = date.toDate();
  return getDay(jsDate);
}

/**
 * Get day of week name in Portuguese (short form)
 *
 * @param date - Date to check
 * @returns Day name ("Dom", "Seg", "Ter", etc.)
 */
export function getDayOfWeekName(date: DateOnly): string {
  const dayIndex = getDayOfWeek(date);
  return DAY_NAMES_SHORT[dayIndex]!;
}

/**
 * Format date as dd/mm/yyyy
 *
 * @param date - Date to format
 * @returns Formatted string
 */
export function formatDateBR(date: DateOnly): string {
  return date.toString();
}

/**
 * Get difference in days between two dates
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days (date2 - date1)
 */
export function daysBetween(date1: DateOnly, date2: DateOnly): number {
  const jsDate1 = date1.toDate();
  const jsDate2 = date2.toDate();
  const diffMs = jsDate2.getTime() - jsDate1.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

