/**
 * Storage Service - localStorage adapter with quota monitoring
 *
 * CRITICAL: All writes wrapped in try-catch to handle QuotaExceededError (Pitfall #5)
 */

import { Lot } from '@/domain/value-objects/Lot';
import { Protocol } from '@/domain/value-objects/Protocol';

const STORAGE_KEY = 'estacao-iatf-data';
const VERSION = 1;

interface StorageData {
  version: number;
  lots: ReturnType<Lot['toJSON']>[];
  customProtocols: ReturnType<Protocol['toJSON']>[];
  roundSuccessRates?: readonly number[] | undefined;
  savedAt: string;
}

export class EstacaoStorage {
  /**
   * Save lots and custom protocols to localStorage
   *
   * @param lots - Lots to save
   * @param customProtocols - Custom protocols (optional)
   * @returns true if saved successfully, false if quota exceeded
   */
  save(lots: Lot[], customProtocols: Protocol[] = [], roundSuccessRates?: readonly number[]): boolean {
    try {
      // Check size before saving
      const data: StorageData = {
        version: VERSION,
        lots: lots.map((lot) => lot.toJSON()),
        customProtocols: customProtocols.map((p) => p.toJSON()),
        roundSuccessRates,
        savedAt: new Date().toISOString(),
      };

      const json = JSON.stringify(data);
      const sizeKB = new Blob([json]).size / 1024;

      // Warn if > 4MB (localStorage limit is typically 5-10MB)
      if (sizeKB > 4096) {
        console.warn(`Storage size: ${sizeKB.toFixed(2)} KB - approaching limit!`);
        alert(
          'Atenção: Dados estão ficando grandes. Considere exportar para Excel/PDF e começar nova estação.'
        );
      }

      localStorage.setItem(STORAGE_KEY, json);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded');
        alert(
          'Armazenamento cheio! Não foi possível salvar.\n\n' +
            'Por favor, exporte seus dados para Excel/PDF e limpe o armazenamento.'
        );
        return false;
      } else {
        console.error('Failed to save to localStorage:', error);
        return false;
      }
    }
  }

  /**
   * Load lots and custom protocols from localStorage
   *
   * @returns Loaded data or null if not found/invalid
   */
  load(): { lots: Lot[]; customProtocols: Protocol[]; roundSuccessRates?: readonly number[] | undefined } | null {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return null;

      const data = JSON.parse(json) as StorageData;

      // Version check
      if (data.version !== VERSION) {
        console.warn(`Storage version mismatch: ${data.version} vs ${VERSION}`);
        // Could implement migration here
        return null;
      }

      // Deserialize
      const lots = data.lots.map((lotData) => Lot.fromJSON(lotData as any));
      const customProtocols = data.customProtocols.map((pData) =>
        Protocol.fromJSON(pData)
      );

      return { lots, customProtocols, roundSuccessRates: data.roundSuccessRates };
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Clear all data from localStorage
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  /**
   * Get storage quota information
   *
   * @returns Quota usage information
   */
  getQuotaInfo(): { used: number; total: number; percentage: number } {
    try {
      // Estimate used space
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key]!.length + key.length;
        }
      }

      // localStorage typically has 5-10MB limit
      // We'll use 5MB as conservative estimate
      const total = 5 * 1024 * 1024; // 5MB in bytes
      const percentage = Math.round((used / total) * 100);

      return {
        used, // bytes
        total, // bytes
        percentage, // 0-100
      };
    } catch (error) {
      console.error('Failed to get quota info:', error);
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  /**
   * Check if saved data exists in localStorage
   */
  hasSavedData(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Check if storage is available (works in incognito mode)
   */
  isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const storage = new EstacaoStorage();
