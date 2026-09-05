import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBrowserDatabaseAdapter,
  createIdbDbBytesStore,
} from '../browser-database-adapter';
import { nodeLocateFile, resetDurableLayer } from './helpers';

const locateFile = nodeLocateFile();

interface UserRow {
  id: number;
  name: string;
}

describe('BrowserDatabaseAdapter (sql.js, synchronous interface)', () => {
  beforeEach(async () => {
    await resetDurableLayer();
  });

  it('round-trips execute + parameterized query<T>', async () => {
    const db = await createBrowserDatabaseAdapter({ locateFile });
    db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    db.execute('INSERT INTO users (id, name) VALUES (?, ?)', [1, 'ada']);
    db.execute('INSERT INTO users (id, name) VALUES (?, ?)', [2, 'grace']);

    const all = db.query<UserRow>('SELECT id, name FROM users ORDER BY id ASC');
    expect(all).toEqual([
      { id: 1, name: 'ada' },
      { id: 2, name: 'grace' },
    ]);

    const filtered = db.query<UserRow>('SELECT id, name FROM users WHERE name = ?', ['grace']);
    expect(filtered).toEqual([{ id: 2, name: 'grace' }]);

    await db.close();
  });

  it('commits a transaction on success', async () => {
    const db = await createBrowserDatabaseAdapter({ locateFile });
    db.execute('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    db.transaction(() => {
      db.execute('INSERT INTO t (id) VALUES (?)', [1]);
      db.execute('INSERT INTO t (id) VALUES (?)', [2]);
    });
    expect(db.query<{ id: number }>('SELECT id FROM t ORDER BY id')).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    await db.close();
  });

  it('rolls back and rethrows when the transaction body throws', async () => {
    const db = await createBrowserDatabaseAdapter({ locateFile });
    db.execute('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    db.execute('INSERT INTO t (id) VALUES (?)', [1]);

    expect(() =>
      db.transaction(() => {
        db.execute('INSERT INTO t (id) VALUES (?)', [2]);
        throw new Error('boom');
      }),
    ).toThrow('boom');

    // The partial row (id=2) must have been rolled back; id=1 survives.
    expect(db.query<{ id: number }>('SELECT id FROM t ORDER BY id')).toEqual([{ id: 1 }]);
    await db.close();
  });

  it('survives a persist/reload cycle through the same IndexedDB key', async () => {
    const bytesStore = createIdbDbBytesStore();
    const a = await createBrowserDatabaseAdapter({ locateFile, bytesStore, persistDebounceMs: 0 });
    a.execute('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)');
    a.execute('INSERT INTO notes (id, body) VALUES (?, ?)', [1, 'hello']);
    await a.flush();
    await a.close();

    // A fresh adapter reading the SAME durable store sees the data.
    const b = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
    expect(b.query<{ id: number; body: string }>('SELECT id, body FROM notes')).toEqual([
      { id: 1, body: 'hello' },
    ]);
    await b.close();
  });

  it('reconstructs from exported bytes (new SQL.Database(bytes) path)', async () => {
    const a = await createBrowserDatabaseAdapter({ locateFile });
    a.execute('CREATE TABLE k (id INTEGER PRIMARY KEY, v TEXT)');
    a.execute('INSERT INTO k (id, v) VALUES (?, ?)', [7, 'seven']);
    const bytes = await a.export();
    await a.close();

    // Feed the exported snapshot into a brand-new adapter via an in-memory store.
    const snapshotStore = {
      async read() {
        return bytes;
      },
      async write() {
        /* no-op for this assertion */
      },
    };
    const b = await createBrowserDatabaseAdapter({ locateFile, bytesStore: snapshotStore });
    expect(b.query<{ id: number; v: string }>('SELECT id, v FROM k')).toEqual([
      { id: 7, v: 'seven' },
    ]);
    await b.close();
  });
});
