// Durable local record of the plaintext a user sent, so their own messages stay
// readable after a refetch or app restart. Messages are encrypted to the
// RECIPIENT's device key only, so the sender cannot decrypt their own ciphertext
// back; without this store the sender's history renders "readable on their
// device" forever (audit B4/U6). This is device-local, holds only content the
// user authored themselves, and never leaves the device.
//
// expo-sqlite is loaded lazily and defensively so this module stays import-safe
// under Node/Vitest and degrades to a no-op if SQLite is unavailable.

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
      const db = await SQLite.openDatabaseAsync('yearn-echoes.db');
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS sent_message_echoes ('
        + 'message_id TEXT PRIMARY KEY, match_id TEXT NOT NULL, body TEXT NOT NULL'
        + ');',
      );
      return db;
    } catch {
      return null;
    }
  })();
  return dbPromise;
}

export async function persistYearnSentEcho(
  matchId: string,
  messageId: string,
  body: string,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.runAsync(
      'INSERT OR REPLACE INTO sent_message_echoes (message_id, match_id, body) VALUES (?, ?, ?)',
      [messageId, matchId, body],
    );
  } catch {
    // best-effort; a failed echo write must never block sending
  }
}

export async function loadYearnSentEchoes(
  matchId: string,
): Promise<Record<string, string>> {
  try {
    const db = await getDb();
    if (!db) return {};
    const rows = await db.getAllAsync(
      'SELECT message_id, body FROM sent_message_echoes WHERE match_id = ?',
      [matchId],
    );
    const echoes: Record<string, string> = {};
    for (const row of rows) {
      const id = row.message_id;
      const body = row.body;
      if (typeof id === 'string' && typeof body === 'string') {
        echoes[id] = body;
      }
    }
    return echoes;
  } catch {
    return {};
  }
}
