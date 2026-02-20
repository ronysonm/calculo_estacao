import { Lot } from '@/domain/value-objects/Lot';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';
import { CpSatScheduler } from './cp-sat-scheduler';
import { GeneticScheduler } from './genetic-scheduler';
import { GeneticParams } from './types';

export type OptimizationEngine = 'ga' | 'cp-sat';

export interface HybridOptimizationResult {
  scenarios: OptimizationScenario[];
  totalCombinations: number;
  engine: OptimizationEngine;
}

export async function optimizeWithHybridEngine(
  lots: Lot[],
  params: GeneticParams
): Promise<HybridOptimizationResult> {
  const cpSatEnabled = params.enableCpSatForSmallInstances !== false;
  const cpSatThreshold = Math.max(0, Math.floor(params.cpSatLotThreshold));

  if (cpSatEnabled && lots.length <= cpSatThreshold) {
    try {
      const cpSatScheduler = new CpSatScheduler(lots, params);
      const cpSatResult = await cpSatScheduler.optimize();

      return {
        scenarios: cpSatResult.scenarios,
        totalCombinations: cpSatResult.totalCombinations,
        engine: 'cp-sat',
      };
    } catch (error) {
      console.warn('CP-SAT falhou, usando fallback GA.', error);
    }
  }

  const gaScheduler = new GeneticScheduler(lots, params);
  const gaResult = await gaScheduler.optimize();

  return {
    scenarios: gaResult.scenarios,
    totalCombinations: gaResult.totalCombinations,
    engine: 'ga',
  };
}
