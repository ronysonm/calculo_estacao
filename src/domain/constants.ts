import { Protocol } from './value-objects/Protocol';

/**
 * Predefined protocols (CALC-01)
 *
 * Three standard breeding protocols used in IATF:
 * - D0-D7-D9: Most common protocol
 * - D0-D8-D10: Alternative protocol
 * - D0-D9-D11: Another alternative
 */
export const PREDEFINED_PROTOCOLS: readonly Protocol[] = [
  Protocol.create('protocol-1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9'),
  Protocol.create('protocol-2', 'D0-D8-D10', [0, 8, 10], 'D0-D8-D10'),
  Protocol.create('protocol-3', 'D0-D9-D11', [0, 9, 11], 'D0-D9-D11'),
] as const;

/**
 * Default protocol (most commonly used)
 */
export const DEFAULT_PROTOCOL = PREDEFINED_PROTOCOLS[0]!;

/**
 * Default lot names (LOTE-01)
 *
 * 5 standard lot categories used in Brazilian beef cattle breeding:
 * - Primíparas: First-time breeders
 * - Secundíparas: Second-time breeders
 * - Multíparas: Multiple-time breeders
 * - Solteiras: Maiden heifers
 * - Paridas: Recently calved cows
 */
export const DEFAULT_LOT_NAMES: readonly string[] = [
  'Primíparas',
  'Secundíparas',
  'Multíparas',
  'Solteiras',
  'Paridas',
] as const;

/**
 * Default number of rounds per breeding season (CALC-04)
 */
export const DEFAULT_ROUNDS = 4;

/**
 * Minimum allowed round gap in days
 */
export const MIN_ROUND_GAP = 20;

/**
 * Maximum allowed round gap in days
 */
export const MAX_ROUND_GAP = 24;

/**
 * Default round gaps in days (CALC-05)
 * Gap between the LAST protocol day of round N and D0 of round N+1.
 * Array of 3 gaps for 4 rounds: [R1→R2, R2→R3, R3→R4]
 */
export const DEFAULT_ROUND_GAPS: readonly number[] = [22, 22, 22] as const;

/**
 * Round names (Rodada 1, Rodada 2, Rodada 3, Rodada 4)
 */
export const ROUND_NAMES = ['Rodada 1', 'Rodada 2', 'Rodada 3', 'Rodada 4'] as const;

/**
 * Day names in Portuguese (short form)
 */
export const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/** Duração média da gestação bovina em dias (usado para cálculo da parição) */
export const GESTACAO_DIAS = 290;

/** Quantidade padrao de animais por lote */
export const DEFAULT_ANIMAL_COUNT = 100;

/** Taxas de sucesso padrao por rodada (%) - [R1, R2, R3, R4] */
export const DEFAULT_ROUND_SUCCESS_RATES: readonly number[] = [50, 20, 20, 10] as const;
