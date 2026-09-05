/**
 * Localized badge labels (plan 45 M4).
 *
 * bc_badge_definitions ships name/description as English-only DB rows. The
 * editorial set is fixed (10 badges), so its labels live in the i18n catalogs
 * under `badge.<id>.name` / `badge.<id>.description`. These helpers resolve a
 * badge's display strings through i18n, falling back to the DB-provided value
 * for any badge id that is not in the catalog (e.g. a future badge added to the
 * DB before its catalog keys exist).
 */
import { EN } from './catalogs';
import type { TranslationKey } from './catalogs';

type Translate = (key: TranslationKey | string, values?: Record<string, string | number>) => string;

const EN_KEYS = EN as Record<string, string>;

function hasKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(EN_KEYS, key);
}

/** Localized badge name, or the DB-provided name if the id has no catalog keys. */
export function localizedBadgeName(t: Translate, id: string, dbName: string): string {
  const key = `badge.${id}.name`;
  return hasKey(key) ? t(key) : dbName;
}

/** Localized badge description, or the DB-provided description as fallback. */
export function localizedBadgeDescription(t: Translate, id: string, dbDescription: string): string {
  const key = `badge.${id}.description`;
  return hasKey(key) ? t(key) : dbDescription;
}
