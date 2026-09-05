import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '@mylife/bestchef';
import {
  AI_PHOTO_CONSENT_KEY,
  AI_PHOTO_CONSENT_VERSION,
  getAiPhotoConsent,
  setAiPhotoConsent,
} from '../ai-consent';

describe('AI photo consent persistence', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('reports no consent before the user accepts', () => {
    expect(getAiPhotoConsent(db)).toBe(false);
  });

  it('persists consent at the current version', () => {
    setAiPhotoConsent(db);
    expect(getAiPhotoConsent(db)).toBe(true);
    const row = db.query<{ value: string }>(`SELECT value FROM rc_settings WHERE key = ?`, [
      AI_PHOTO_CONSENT_KEY,
    ]);
    expect(row[0]?.value).toBe(AI_PHOTO_CONSENT_VERSION);
  });

  it('treats a stale consent version as not consented (re-prompt)', () => {
    db.execute(`INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`, [
      AI_PHOTO_CONSENT_KEY,
      '2020-01-01',
    ]);
    expect(getAiPhotoConsent(db)).toBe(false);
  });
});
