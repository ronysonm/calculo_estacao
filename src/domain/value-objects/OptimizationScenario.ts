import { Lot } from './Lot';

/**
 * Representa os objetivos mensuraveis de um cronograma
 */
export interface ScheduleObjectives {
  sundaysRounds12: number;
  sundaysRounds34: number;
  overlapsRounds12: number;
  overlapsRounds34: number;
  totalCycleDays: number;
  intervalViolations: number;
}

/**
 * Representa uma mudanca de intervalo entre rodadas
 */
export interface GapChange {
  gapIndex: number;
  roundLabel: string;
  oldGap: number;
  newGap: number;
}

/**
 * Representa uma mudanca em um lote
 */
export interface LotChange {
  lotId: string;
  lotName: string;
  oldD0: string;
  newD0: string;
  daysDiff: number;
  gapChanges: GapChange[];
}

/**
 * OptimizationScenario - Cenario otimizado imutavel
 */
export class OptimizationScenario {
  constructor(
    public readonly name: string,
    public readonly lots: Lot[],
    public readonly objectives: ScheduleObjectives,
    public readonly fitness: number,
    public readonly description: string = ''
  ) {}

  /**
   * Cria cenario a partir de lotes e objetivos calculados
   */
  static create(
    name: string,
    lots: Lot[],
    objectives: ScheduleObjectives,
    fitness: number,
    description: string = ''
  ): OptimizationScenario {
    return new OptimizationScenario(name, lots, objectives, fitness, description);
  }

  /**
   * Calcula a duracao total do ciclo (do primeiro D0 ao ultimo manejo)
   */
  getTotalCycleDays(): number {
    if (this.lots.length === 0) return 0;

    let minD0 = this.lots[0]!.d0;
    let maxDate = this.lots[0]!.d0;

    for (const lot of this.lots) {
      if (lot.d0.compareTo(minD0) < 0) {
        minD0 = lot.d0;
      }

      const intervals = lot.getIntervals(4);
      const lastInterval = intervals[intervals.length - 1];
      if (lastInterval) {
        const lastDate = lot.d0.addDays(lastInterval.dayOffset);
        if (lastDate.compareTo(maxDate) > 0) {
          maxDate = lastDate;
        }
      }
    }

    return maxDate.daysSince(minD0);
  }

  /**
   * Obtem as mudancas em relacao aos lotes originais (D0 + gaps)
   */
  getChanges(originalLots: Lot[]): LotChange[] {
    const GAP_LABELS = ['R1\u2192R2', 'R2\u2192R3', 'R3\u2192R4'];
    const changes: LotChange[] = [];

    for (const newLot of this.lots) {
      const oldLot = originalLots.find((l) => l.id === newLot.id);
      if (!oldLot) continue;

      const d0Changed = !oldLot.d0.equals(newLot.d0);
      const daysDiff = d0Changed ? oldLot.d0.daysSince(newLot.d0) : 0;

      const gapChanges: GapChange[] = [];
      for (let i = 0; i < 3; i++) {
        const oldGap = oldLot.roundGaps[i] ?? 22;
        const newGap = newLot.roundGaps[i] ?? 22;
        if (oldGap !== newGap) {
          gapChanges.push({
            gapIndex: i,
            roundLabel: GAP_LABELS[i]!,
            oldGap,
            newGap,
          });
        }
      }

      if (d0Changed || gapChanges.length > 0) {
        changes.push({
          lotId: newLot.id,
          lotName: newLot.name,
          oldD0: oldLot.d0.toISOString(),
          newD0: newLot.d0.toISOString(),
          daysDiff,
          gapChanges,
        });
      }
    }

    return changes;
  }

  /**
   * Retorna score formatado para exibicao
   */
  getFormattedScore(): string {
    return (this.fitness * 100).toFixed(1);
  }
}
