import { DateOnly } from './DateOnly';

export interface NationalHolidayDef {
  readonly month: number; // 1-12
  readonly day: number;
  readonly name: string;
}

export interface Holiday {
  readonly date: DateOnly;
  readonly name: string;
  readonly isCustom: boolean;
}

export interface CustomHoliday {
  readonly date: DateOnly;
  readonly name: string;
}

export const NATIONAL_HOLIDAYS: readonly NationalHolidayDef[] = [
  { month: 1,  day: 1,  name: 'Confraternização Universal' },
  { month: 4,  day: 21, name: 'Tiradentes' },
  { month: 5,  day: 1,  name: 'Dia do Trabalho' },
  { month: 9,  day: 7,  name: 'Independência do Brasil' },
  { month: 10, day: 12, name: 'N. Sra. Aparecida' },
  { month: 11, day: 2,  name: 'Finados' },
  { month: 11, day: 15, name: 'Proclamação da República' },
  { month: 12, day: 25, name: 'Natal' },
];

/**
 * Expand national holiday definitions to full Holiday objects for given years.
 */
export function expandNationalHolidays(years: readonly number[]): Holiday[] {
  const result: Holiday[] = [];
  for (const year of years) {
    for (const def of NATIONAL_HOLIDAYS) {
      result.push({
        date: DateOnly.create(year, def.month, def.day),
        name: def.name,
        isCustom: false,
      });
    }
  }
  return result;
}

/**
 * Find the first holiday matching the given date, or null.
 */
export function findHoliday(
  date: DateOnly,
  holidays: readonly Holiday[]
): Holiday | null {
  return holidays.find((h) => h.date.equals(date)) ?? null;
}
