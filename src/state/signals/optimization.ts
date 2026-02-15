import { signal } from '@preact/signals';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';

/**
 * Estado de otimizacao
 */
export const isOptimizingSignal = signal<boolean>(false);
export const optimizationScenariosSignal = signal<OptimizationScenario[]>([]);
export const optimizationStatsSignal = signal<{ totalCombinations: number } | null>(null);
export const maxD0AdjustmentSignal = signal<number>(15);

/**
 * Resetar cenarios
 */
export function clearOptimizationScenarios(): void {
  optimizationScenariosSignal.value = [];
  optimizationStatsSignal.value = null;
}

/**
 * Definir cenarios otimizados
 */
export function setOptimizationScenarios(
  scenarios: OptimizationScenario[],
  stats: { totalCombinations: number } | null = null
): void {
  optimizationScenariosSignal.value = scenarios;
  optimizationStatsSignal.value = stats;
}

/**
 * Definir valor maximo de ajuste
 */
export function setMaxD0Adjustment(value: number): void {
  maxD0AdjustmentSignal.value = Math.max(1, Math.min(30, value));
}
