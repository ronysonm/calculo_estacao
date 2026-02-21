/**
 * usePersistence Hook
 *
 * Auto-save and auto-load from localStorage
 * Handles quota warnings and incognito mode
 */

import { useEffect, useRef } from 'preact/hooks';
import { lotsSignal, setLots } from '@/state/signals/lots';
import { roundSuccessRatesSignal, setAllRoundSuccessRates } from '@/state/signals/success-rates';
import { customHolidaysSignal, setCustomHolidays } from '@/state/signals/conflicts';
import { DateOnly } from '@/domain/value-objects/DateOnly';
import { storage } from '@/services/persistence/storage';
import { debounce } from '@/utils/performance';

/**
 * Hook to enable auto-save and auto-load
 */
export function usePersistence() {
  const hasLoadedRef = useRef(false);
  const lastQuotaWarningRef = useRef(0);

  // Load on mount
  useEffect(() => {
    if (hasLoadedRef.current) return;

    // Check if storage is available
    if (!storage.isAvailable()) {
      console.warn('localStorage not available (incognito mode?)');
      return;
    }

    // Load data
    const data = storage.load();
    if (data) {
      setLots(data.lots);
      if (data.roundSuccessRates) {
        setAllRoundSuccessRates(data.roundSuccessRates);
      }
      if (data.customHolidays && data.customHolidays.length > 0) {
        setCustomHolidays(
          data.customHolidays.map((h) => ({
            date: DateOnly.create(h.year, h.month, h.day),
            name: h.name,
          }))
        );
      }
      console.log(`Loaded ${data.lots.length} lots from localStorage`);
    }

    hasLoadedRef.current = true;
  }, []);

  // Save on lots change (debounced 1 second)
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (!storage.isAvailable()) return;

    const debouncedSave = debounce(() => {
      const lots = lotsSignal.value;
      const rates = roundSuccessRatesSignal.value;
      const holidays = customHolidaysSignal.value.map((h) => ({
        year: h.date.year,
        month: h.date.month,
        day: h.date.day,
        name: h.name,
      }));
      storage.save(lots, [], rates, holidays);

      // Check quota
      const quota = storage.getQuotaInfo();

      // Warning at 80%
      if (quota.percentage >= 80 && quota.percentage < 95) {
        const now = Date.now();
        // Only warn once per 5 minutes
        if (now - lastQuotaWarningRef.current > 5 * 60 * 1000) {
          console.warn(`Storage at ${quota.percentage}%`);
          alert(
            `Armazenamento em ${quota.percentage}%\n\n` +
              'Considere exportar seus dados para Excel/PDF em breve.'
          );
          lastQuotaWarningRef.current = now;
        }
      }

      // Critical at 95%
      if (quota.percentage >= 95) {
        const now = Date.now();
        if (now - lastQuotaWarningRef.current > 5 * 60 * 1000) {
          console.error(`Storage critical: ${quota.percentage}%`);
          alert(
            `⚠️ Armazenamento crítico: ${quota.percentage}%\n\n` +
              'Exporte seus dados AGORA antes de perder informações!'
          );
          lastQuotaWarningRef.current = now;
        }
      }
    }, 1000);

    debouncedSave();
  }, [lotsSignal.value, roundSuccessRatesSignal.value, customHolidaysSignal.value]);

  return {
    clear: () => storage.clear(),
    getQuota: () => storage.getQuotaInfo(),
  };
}
