/**
 * Current app language for UGC tagging (plan 33 Phase 2.5).
 *
 * Unlike the dish-catalog locale (which maps 'en' to null because canonical
 * dish rows ARE the English surface), UGC written in English must be tagged
 * 'en' explicitly so language-filtered feeds can include it. Set by the
 * I18nProvider whenever the app language changes.
 */

// Kept import-free on purpose (expo-localization would drag the react-native
// barrel into node-env test graphs). The I18nProvider seeds this
// SYNCHRONOUSLY in its language state initializer, which runs before any
// child renders, so the 'en' default is never observable on a real device.
let ugcLanguage = 'en';

export function setUgcLanguage(language: string | null | undefined): void {
  const lowered = (language ?? '').trim().toLowerCase();
  if (/^[a-z]{2}(-[a-z0-9]{2,8})?$/.test(lowered)) {
    ugcLanguage = lowered;
  }
}

export function getUgcLanguage(): string {
  return ugcLanguage;
}
