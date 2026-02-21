import { Lot } from '@/domain/value-objects/Lot';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { expandNationalHolidays, Holiday } from '@/domain/value-objects/Holiday';
import { GeneticScheduler } from '@/core/optimization/genetic-scheduler';
import { GeneticParams, DEFAULT_GA_PARAMS } from '@/core/optimization/types';

interface CustomHolidayJSON {
  year: number;
  month: number;
  day: number;
  name: string;
}

/**
 * Mensagem recebida pelo worker
 */
interface WorkerMessage {
  lots: Parameters<typeof Lot.fromJSON>[0][];
  maxD0Adjustment?: number;
  timeLimitMs?: number;
  customHolidays?: CustomHolidayJSON[];
}

/**
 * Web Worker para otimizacao
 */
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  try {
    const {
      lots: lotsData,
      maxD0Adjustment = 15,
      timeLimitMs = 5000,
      customHolidays = [],
    } = e.data;

    // Deserializar lotes
    const lots = lotsData.map((data) => Lot.fromJSON(data));

    // Reconstruct holidays for the years in this lot set
    const allYears = lots.flatMap((lot) => [lot.d0.year, lot.d0.year + 1]);
    const years = [...new Set(allYears)];
    const nationalHolidays = expandNationalHolidays(years);
    const custom: Holiday[] = customHolidays.map((h) => ({
      date: DateOnly.create(h.year, h.month, h.day),
      name: h.name,
      isCustom: true,
    }));
    const holidays: Holiday[] = [...nationalHolidays, ...custom];

    // Criar scheduler
    const params: GeneticParams = {
      ...DEFAULT_GA_PARAMS,
      maxD0Adjustment,
      timeLimitMs,
    };

    const scheduler = new GeneticScheduler(lots, params, holidays);

    // Otimizar
    const { scenarios, totalCombinations } = await scheduler.optimize();

    // Serializar e enviar resultado
    const serializedScenarios = scenarios.map((scenario) => ({
      name: scenario.name,
      description: scenario.description,
      lots: scenario.lots.map((lot) => lot.toJSON()),
      objectives: scenario.objectives,
      fitness: scenario.fitness,
    }));

    self.postMessage({
      success: true,
      scenarios: serializedScenarios,
      totalCombinations,
    });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
};
