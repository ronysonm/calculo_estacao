/**
 * Lots State - Reactive state management with Preact signals
 *
 * Manages the list of breeding lots with automatic reactivity.
 * All updates are immutable to prevent bugs.
 */

import { signal } from '@preact/signals';
import { Lot } from '@/domain/value-objects/Lot';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { Protocol } from '@/domain/value-objects/Protocol';
import { DEFAULT_LOT_NAMES, DEFAULT_PROTOCOL, DEFAULT_ROUND_GAPS, DEFAULT_ANIMAL_COUNT } from '@/domain/constants';
import { addDaysToDateOnly } from '@/core/date-engine/utils';

/**
 * Main lots signal
 */
export const lotsSignal = signal<Lot[]>([]);

/**
 * Initialize with 5 default lots (LOTE-01)
 * All lots start with today's date and default protocol
 */
export function initializeDefaultLots(): void {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 30);
  const today = DateOnly.fromDate(startDate);
  const defaultLots: Lot[] = [];

  for (let i = 0; i < DEFAULT_LOT_NAMES.length; i++) {
    const name = DEFAULT_LOT_NAMES[i]!;
    const id = `lot-${i + 1}`;

    const lot = Lot.create(
      id,
      name,
      addDaysToDateOnly(today, i),
      DEFAULT_PROTOCOL,
      DEFAULT_ROUND_GAPS
    );

    defaultLots.push(lot);
  }

  lotsSignal.value = defaultLots;
}

/**
 * Add a new lot
 */
export function addLot(name: string, d0: DateOnly, protocol: Protocol, animalCount: number = DEFAULT_ANIMAL_COUNT): void {
  const newId = `lot-${Date.now()}`;
  const newLot = Lot.create(newId, name, d0, protocol, DEFAULT_ROUND_GAPS, animalCount);

  lotsSignal.value = [...lotsSignal.value, newLot];
}

/**
 * Change lot animal count
 */
export function changeLotAnimalCount(lotId: string, newCount: number): void {
  lotsSignal.value = lotsSignal.value.map((lot) =>
    lot.id === lotId ? lot.withAnimalCount(newCount) : lot
  );
}

/**
 * Remove a lot by ID
 */
export function removeLot(lotId: string): void {
  lotsSignal.value = lotsSignal.value.filter((lot) => lot.id !== lotId);
}

/**
 * Rename a lot
 */
export function renameLot(lotId: string, newName: string): void {
  lotsSignal.value = lotsSignal.value.map((lot) =>
    lot.id === lotId ? lot.withName(newName) : lot
  );
}

/**
 * Change lot D0 date
 */
export function changeLotD0(lotId: string, newD0: DateOnly): void {
  lotsSignal.value = lotsSignal.value.map((lot) =>
    lot.id === lotId ? lot.withD0(newD0) : lot
  );
}

/**
 * Change lot protocol
 */
export function changeLotProtocol(lotId: string, newProtocol: Protocol): void {
  lotsSignal.value = lotsSignal.value.map((lot) =>
    lot.id === lotId ? lot.withProtocol(newProtocol) : lot
  );
}

/**
 * Change a single round gap for a lot
 * @param lotId - Lot ID
 * @param gapIndex - Gap index (0 = R1→R2, 1 = R2→R3, 2 = R3→R4)
 * @param newGap - New gap value in days
 */
export function changeLotRoundGap(lotId: string, gapIndex: number, newGap: number): void {
  lotsSignal.value = lotsSignal.value.map((lot) =>
    lot.id === lotId ? lot.withRoundGap(gapIndex, newGap) : lot
  );
}

/**
 * Replace all lots (for loading from storage)
 */
export function setLots(lots: Lot[]): void {
  lotsSignal.value = lots;
}
