import type { DatabaseAdapter } from '@mylife/db';

export type CoverImageQuality = 'small' | 'medium' | 'large';
export type LibrarySortPreference = 'added' | 'title' | 'author' | 'rating';

export interface BooksSettings {
  defaultShelfSlug: string;
  coverImageQuality: CoverImageQuality;
  defaultSort: LibrarySortPreference;
}

const SETTING_KEYS = {
  defaultShelfSlug: 'books.default_shelf_slug',
  coverImageQuality: 'books.cover_image_quality',
  defaultSort: 'books.default_sort',
} as const;

const DEFAULT_SETTINGS: BooksSettings = {
  defaultShelfSlug: 'want-to-read',
  coverImageQuality: 'large',
  defaultSort: 'added',
};

type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

function readSetting(db: DatabaseAdapter, key: SettingKey): string | null {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM bk_settings WHERE key = ? LIMIT 1`,
    [key],
  );
  return rows[0]?.value ?? null;
}

function writeSetting(db: DatabaseAdapter, key: SettingKey, value: string): void {
  db.execute(
    `INSERT INTO bk_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

function isCoverImageQuality(value: string | null): value is CoverImageQuality {
  return value === 'small' || value === 'medium' || value === 'large';
}

function isLibrarySortPreference(value: string | null): value is LibrarySortPreference {
  return value === 'added' || value === 'title' || value === 'author' || value === 'rating';
}

export function getBooksSettings(db: DatabaseAdapter): BooksSettings {
  const defaultShelfSlug = readSetting(db, SETTING_KEYS.defaultShelfSlug);
  const coverImageQuality = readSetting(db, SETTING_KEYS.coverImageQuality);
  const defaultSort = readSetting(db, SETTING_KEYS.defaultSort);

  return {
    defaultShelfSlug: defaultShelfSlug || DEFAULT_SETTINGS.defaultShelfSlug,
    coverImageQuality: isCoverImageQuality(coverImageQuality)
      ? coverImageQuality
      : DEFAULT_SETTINGS.coverImageQuality,
    defaultSort: isLibrarySortPreference(defaultSort)
      ? defaultSort
      : DEFAULT_SETTINGS.defaultSort,
  };
}

export function setBooksDefaultShelf(db: DatabaseAdapter, shelfSlug: string): void {
  writeSetting(db, SETTING_KEYS.defaultShelfSlug, shelfSlug);
}

export function setBooksCoverImageQuality(
  db: DatabaseAdapter,
  coverImageQuality: CoverImageQuality,
): void {
  writeSetting(db, SETTING_KEYS.coverImageQuality, coverImageQuality);
}

export function setBooksDefaultSort(
  db: DatabaseAdapter,
  defaultSort: LibrarySortPreference,
): void {
  writeSetting(db, SETTING_KEYS.defaultSort, defaultSort);
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO bk_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM bk_settings WHERE key = ? LIMIT 1`,
    [key],
  );
  return rows[0]?.value ?? null;
}

export function resolvePreferredShelf<T extends { id: string; slug: string }>(
  shelves: T[],
  preferredSlug: string,
): T | null {
  return (
    shelves.find((shelf) => shelf.slug === preferredSlug) ??
    shelves.find((shelf) => shelf.slug === 'want-to-read') ??
    shelves[0] ??
    null
  );
}
