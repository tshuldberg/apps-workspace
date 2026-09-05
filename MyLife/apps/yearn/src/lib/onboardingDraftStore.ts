// Durable local persistence for the in-progress onboarding draft so a user does
// not lose their profile setup if the app is backgrounded or killed mid-flow
// (audit U2). Device-local, single draft per device, holds only the user's own
// not-yet-published profile data. expo-sqlite is loaded lazily and defensively
// so this module stays import-safe under Node/Vitest and degrades to a no-op if
// SQLite is unavailable.
import type { YearnOnboardingDraft } from './onboarding';

const DRAFT_KEY = 'current';

type SqliteDb = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: unknown[]): Promise<unknown>;
  getAllAsync(sql: string, params: unknown[]): Promise<Array<Record<string, unknown>>>;
};

let dbPromise: Promise<SqliteDb | null> | null = null;

async function getDb(): Promise<SqliteDb | null> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    try {
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      const SQLite = require('expo-sqlite') as {
        openDatabaseAsync?: (name: string) => Promise<SqliteDb>;
      };
      if (typeof SQLite.openDatabaseAsync !== 'function') return null;
      const db = await SQLite.openDatabaseAsync('yearn-onboarding.db');
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS onboarding_draft (key TEXT PRIMARY KEY, body TEXT NOT NULL);',
      );
      return db;
    } catch {
      return null;
    }
  })();
  return dbPromise;
}

export async function persistYearnOnboardingDraft(draft: YearnOnboardingDraft): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    // Reset transient upload flags so a draft restored after a kill never shows
    // a permanently "uploading" photo.
    const durable: YearnOnboardingDraft = {
      ...draft,
      photos: draft.photos.map((photo) => ({ ...photo, isUploading: false })),
    };
    await db.runAsync(
      'INSERT OR REPLACE INTO onboarding_draft (key, body) VALUES (?, ?)',
      [DRAFT_KEY, JSON.stringify(durable)],
    );
  } catch {
    // best-effort; a failed draft write must never block onboarding
  }
}

export async function loadYearnOnboardingDraft(): Promise<YearnOnboardingDraft | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.getAllAsync(
      'SELECT body FROM onboarding_draft WHERE key = ?',
      [DRAFT_KEY],
    );
    const body = rows[0]?.body;
    if (typeof body !== 'string') return null;
    return JSON.parse(body) as YearnOnboardingDraft;
  } catch {
    return null;
  }
}

export async function clearYearnOnboardingDraft(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.runAsync('DELETE FROM onboarding_draft WHERE key = ?', [DRAFT_KEY]);
  } catch {
    // best-effort
  }
}
