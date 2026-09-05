import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, I18nManager, Platform } from 'react-native';
import type { DatabaseAdapter } from '@mylife/db';
import { setUgcLanguage } from '../data/app-language';
import { setDishCatalogLocale } from '../data/cloud-dishes';
import { useDatabase } from '../providers/DatabaseProvider';
import {
  getDeviceLanguage,
  getDeviceLocaleTag,
  getLanguageOption,
  isLanguageCode,
  type LanguageCode,
  type LanguageOption,
} from './languages';
import type { JakartaWeight } from '@mylife/bestchef';
import { restartAppForRtlChange } from './restart';
import { resolveFontFamily, scriptTypeStyle } from './typography';
import {
  formatNumberForLanguage,
  formatRelativeTimeForLanguage,
  translatePluralized,
  translateText,
  type TranslationKey,
} from './translations';

const LANGUAGE_SETTING_KEY = 'app_language';
const LANGUAGE_ONBOARDING_KEY = 'language_onboarding_complete';

type TranslationValues = Record<string, string | number>;

interface I18nContextValue {
  ready: boolean;
  language: LanguageCode;
  languageOption: LanguageOption;
  deviceLanguage: LanguageCode;
  deviceLocaleTag: string;
  isLanguageOnboardingComplete: boolean;
  isRtl: boolean;
  pendingRtlRestart: boolean;
  setLanguage: (language: LanguageCode) => void;
  completeLanguageOnboarding: () => void;
  acknowledgeRtlRestart: () => void;
  t: (key: TranslationKey | string, values?: TranslationValues) => string;
  tp: (
    count: number,
    singularKey: TranslationKey | string,
    pluralKey: TranslationKey | string,
    values?: TranslationValues,
  ) => string;
  formatNumber: (value: number) => string;
  formatRelativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit) => string;
  /**
   * Per-script font resolution (audit L4). Non-Latin locales render in their
   * iOS system face instead of silently falling back to the OS default; use
   * this instead of referencing JAKARTA_FONTS.* directly in new screens.
   */
  fontFamily: (weight: JakartaWeight) => string;
  fontStyle: (weight: JakartaWeight) => { fontFamily: string };
}

const I18nContext = createContext<I18nContextValue | null>(null);

function loadSetting(db: DatabaseAdapter, key: string): string | null {
  try {
    const rows = db.query<{ value: string }>(`SELECT value FROM rc_settings WHERE key = ?`, [key]);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

function saveSetting(db: DatabaseAdapter, key: string, value: string): void {
  try {
    db.execute(`INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`, [key, value]);
  } catch {}
}

function applyRtlIfNeeded(language: LanguageCode): boolean {
  const option = getLanguageOption(language);
  const shouldBeRtl = option.textDirection === 'rtl';
  if (I18nManager.isRTL === shouldBeRtl) return false;
  try {
    I18nManager.allowRTL(shouldBeRtl);
    I18nManager.forceRTL(shouldBeRtl);
    return true;
  } catch {
    return false;
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const db = useDatabase();
  const [ready, setReady] = useState(false);
  const [deviceLanguage] = useState<LanguageCode>(() => getDeviceLanguage());
  const [deviceLocaleTag] = useState(() => getDeviceLocaleTag());
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    // Synchronous seed of the UGC language holder: this initializer runs
    // before ANY child renders, closing the cold-start window where a write
    // could tag a non-English device as 'en' (idempotent module write).
    setUgcLanguage(deviceLanguage);
    return deviceLanguage;
  });
  const [isLanguageOnboardingComplete, setLanguageOnboardingComplete] = useState(false);
  const [pendingRtlRestart, setPendingRtlRestart] = useState(false);

  useEffect(() => {
    const savedLanguage = loadSetting(db, LANGUAGE_SETTING_KEY);
    const savedOnboarding = loadSetting(db, LANGUAGE_ONBOARDING_KEY);
    if (savedLanguage && isLanguageCode(savedLanguage)) {
      setLanguageState(savedLanguage);
    }
    setLanguageOnboardingComplete(savedOnboarding === 'true');
    setReady(true);
  }, [db]);

  // Dish catalog localization follows the app language (plan 33 Phase 2.3):
  // the data layer needs the locale for bc_search_dishes and busts its cache
  // on change so localized dish names refresh everywhere. UGC written from
  // this device is tagged with the same language (Phase 2.5).
  useEffect(() => {
    setDishCatalogLocale(language);
    setUgcLanguage(language);
  }, [language]);

  const setLanguage = useCallback((nextLanguage: LanguageCode) => {
    if (nextLanguage === language) return;
    const rtlChanged = applyRtlIfNeeded(nextLanguage);
    setLanguageState(nextLanguage);
    // Synchronous push (the [language] effect also runs, but AFTER children
    // re-render): UGC writes triggered in the same commit must already see
    // the new language.
    setUgcLanguage(nextLanguage);
    setDishCatalogLocale(nextLanguage);
    saveSetting(db, LANGUAGE_SETTING_KEY, nextLanguage);
    if (rtlChanged) setPendingRtlRestart(true);
  }, [db, language]);

  const completeLanguageOnboarding = useCallback(() => {
    applyRtlIfNeeded(language);
    saveSetting(db, LANGUAGE_ONBOARDING_KEY, 'true');
    saveSetting(db, LANGUAGE_SETTING_KEY, language);
    setLanguageOnboardingComplete(true);
  }, [db, language]);

  const acknowledgeRtlRestart = useCallback(() => {
    setPendingRtlRestart(false);
    if (Platform.OS === 'web') return;
    void restartAppForRtlChange({
      isDev: Boolean(__DEV__),
      devReload: () => {
        const DevSettings = require('react-native').DevSettings;
        DevSettings?.reload?.();
      },
      productionReloadAsync: () => {
        const Updates = require('expo-updates');
        return Updates.reloadAsync();
      },
      onManualRestartRequired: () => {
        Alert.alert(
          translateText(language, 'Restart Required'),
          translateText(language, 'Please close and reopen the app to apply the new layout direction.'),
        );
      },
    });
  }, [language]);

  const t = useCallback((key: TranslationKey | string, values?: TranslationValues) => (
    translateText(language, key, values)
  ), [language]);

  const tp = useCallback((
    count: number,
    singularKey: TranslationKey | string,
    pluralKey: TranslationKey | string,
    values?: TranslationValues,
  ) => translatePluralized(language, count, singularKey, pluralKey, values), [language]);

  const formatNumber = useCallback((value: number) => (
    formatNumberForLanguage(language, value)
  ), [language]);

  const formatRelativeTime = useCallback((value: number, unit: Intl.RelativeTimeFormatUnit) => (
    formatRelativeTimeForLanguage(language, value, unit)
  ), [language]);

  const fontFamily = useCallback((weight: JakartaWeight) => (
    resolveFontFamily(language, weight)
  ), [language]);

  const fontStyle = useCallback((weight: JakartaWeight) => (
    scriptTypeStyle(language, weight)
  ), [language]);

  const value = useMemo<I18nContextValue>(() => ({
    ready,
    language,
    languageOption: getLanguageOption(language),
    deviceLanguage,
    deviceLocaleTag,
    isLanguageOnboardingComplete,
    isRtl: getLanguageOption(language).textDirection === 'rtl',
    pendingRtlRestart,
    setLanguage,
    completeLanguageOnboarding,
    acknowledgeRtlRestart,
    t,
    tp,
    formatNumber,
    formatRelativeTime,
    fontFamily,
    fontStyle,
  }), [
    ready,
    language,
    deviceLanguage,
    deviceLocaleTag,
    isLanguageOnboardingComplete,
    pendingRtlRestart,
    setLanguage,
    completeLanguageOnboarding,
    acknowledgeRtlRestart,
    t,
    tp,
    formatNumber,
    formatRelativeTime,
    fontFamily,
    fontStyle,
  ]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}
