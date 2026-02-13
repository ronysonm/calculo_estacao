import { signal } from '@preact/signals';
import { OptimizationScenario } from '@/domain/value-objects/OptimizationScenario';

/**
 * Estado de otimizacao
 */
export const isOptimizingSignal = signal<boolean>(false);
export const optimizationScenariosSignal = signal<OptimizationScenario[]>([]);
export const maxD0AdjustmentSignal = signal<number>(15);

/**
 * Resetar cenarios
 */
export function clearOptimizationScenarios(): void {
  optimizationScenariosSignal.value = [];
}

/**
 * Definir cenarios otimizados
 */
export function setOptimizationScenarios(scenarios: OptimizationScenario[]): void {
  optimizationScenariosSignal.value = scenarios;
}

/**
 * Definir valor maximo de ajuste
 */
export function setMaxD0Adjustment(value: number): void {
  maxD0AdjustmentSignal.value = Math.max(1, Math.min(30, value));
}
