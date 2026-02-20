import { signal } from '@preact/signals';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';
import type { OptimizationErrorCode } from '@/services/optimization/optimizer-contract';

export interface OptimizationErrorState {
  code: Exclude<OptimizationErrorCode, 'OK'>;
  message: string;
  details?: unknown;
}

/**
 * Estado de otimizacao
 */
export const isOptimizingSignal = signal<boolean>(false);
export const optimizationScenariosSignal = signal<OptimizationScenario[]>([]);
export const optimizationStatsSignal = signal<{ totalCombinations: number } | null>(null);
export const maxD0AdjustmentSignal = signal<number>(15);
export const optimizationErrorSignal = signal<OptimizationErrorState | null>(null);

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
 * Definir erro de otimizacao
 */
export function setOptimizationError(error: OptimizationErrorState): void {
  optimizationErrorSignal.value = error;
}

/**
 * Limpar erro de otimizacao
 */
export function clearOptimizationError(): void {
  optimizationErrorSignal.value = null;
}

/**
 * Definir valor maximo de ajuste
 */
export function setMaxD0Adjustment(value: number): void {
  maxD0AdjustmentSignal.value = Math.max(1, Math.min(30, value));
}
