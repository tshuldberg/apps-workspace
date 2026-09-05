import { describe, expect, it } from 'vitest';
import { createBrowserDatabaseAdapter, type DbBytesStore } from '../browser-database-adapter';
import { nodeLocateFile } from './helpers';

const locateFile = nodeLocateFile();
function fixture() {
  let bytes: Uint8Array | null = null;
  const store: DbBytesStore = {
    async read() { return bytes; },
    async write(next) { bytes = new Uint8Array(next); },
  };
  return store;
}

describe('database durability acceptance', () => {
  it('F1 refuses a second writer before it loads a stale snapshot', async () => {
    const bytesStore = fixture();
    const a = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
    a.execute('CREATE TABLE notes(id TEXT PRIMARY KEY, body TEXT)');
    await a.flush();
    try {
      await expect(createBrowserDatabaseAdapter({ locateFile, bytesStore })).rejects.toThrow(/another tab/i);
    } finally { await a.close(); }
  });

  it('F2 rejects a failed flush instead of retrying until it appears successful', async () => {
    let attempts = 0;
    const bytesStore = fixture();
    bytesStore.write = async () => {
      attempts++;
      if (attempts <= 20) throw new Error('QuotaExceededError');
    };
    const db = await createBrowserDatabaseAdapter({ locateFile, bytesStore, persistDebounceMs: 60000 });
    db.execute('CREATE TABLE notes(id TEXT)');
    try {
      await expect(db.flush()).rejects.toThrow('QuotaExceededError');
      expect(attempts).toBe(1);
    } finally {
      bytesStore.write = async () => {};
      await db.close();
    }
  });
});

it('F1 transfers the latest committed inserts, deletes and atomic transactions', async () => {
  const bytesStore = fixture();
  const a = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
  a.execute('CREATE TABLE notes(id TEXT PRIMARY KEY, body TEXT)');
  a.execute("INSERT INTO notes VALUES ('a', 'first')");
  await a.close(); // includes the pending write
  const b = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
  b.transaction(() => {
    b.execute("DELETE FROM notes WHERE id='a'");
    b.execute("INSERT INTO notes VALUES ('b', 'second')");
  });
  expect(() => b.transaction(() => {
    b.execute("DELETE FROM notes WHERE id='b'");
    throw new Error('rollback');
  })).toThrow('rollback');
  await b.close();
  const c = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
  expect(c.query('SELECT * FROM notes')).toEqual([{ id: 'b', body: 'second' }]);
  await c.close();
});

it('F2 bounds permanent quota failure, retains edits, and recovers manually', async () => {
  const { vi } = await import('vitest');
  const bytesStore = fixture();
  const write = bytesStore.write;
  let attempts = 0;
  bytesStore.write = async () => { attempts++; throw new Error('quota'); };
  const db = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
  vi.useFakeTimers();
  try {
    db.execute('CREATE TABLE notes(id TEXT)');
    await expect(db.flush()).rejects.toThrow('quota');
    for (const delay of [1000, 2000, 4000]) await vi.advanceTimersByTimeAsync(delay);
    expect(attempts).toBe(4);
    expect(db.getPersistenceState()).toMatchObject({ status: 'unsaved', pending: true });
    db.execute("INSERT INTO notes VALUES ('retained')");
    await vi.advanceTimersByTimeAsync(60000);
    expect(attempts).toBe(4);
    for (let i = 0; i < 20; i++) await expect(db.flush()).rejects.toThrow('quota');
    expect(attempts).toBe(4);
    await expect(db.close()).rejects.toThrow('quota');
    await expect(createBrowserDatabaseAdapter({ locateFile, bytesStore })).rejects.toThrow(/another tab/i);
    bytesStore.write = write;
    await db.retryPersistence();
    expect(db.getPersistenceState()).toMatchObject({ status: 'saved', pending: false });
    await db.close();
  } finally { vi.useRealTimers(); }
  const reopened = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
  expect(reopened.query('SELECT * FROM notes')).toEqual([{ id: 'retained' }]);
  await reopened.close();
});

it('F2 transient failure backs off and saves without manual recovery', async () => {
  const { vi } = await import('vitest');
  const bytesStore = fixture();
  const write = bytesStore.write;
  let attempts = 0;
  bytesStore.write = async (bytes) => { if (++attempts === 1) throw new Error('transient'); await write(bytes); };
  const db = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
  vi.useFakeTimers();
  try {
    db.execute('CREATE TABLE notes(id TEXT)');
    await expect(db.flush()).rejects.toThrow('transient');
    await vi.advanceTimersByTimeAsync(999);
    expect(attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(attempts).toBe(2);
    expect(db.getPersistenceState().status).toBe('saved');
    await db.close();
  } finally { vi.useRealTimers(); }
});

it('F2 coalesces concurrent flushes and retains edits arriving during a save', async () => {
  const bytesStore = fixture();
  const write = bytesStore.write;
  let unblock!: () => void;
  const blocked = new Promise<void>((resolve) => { unblock = resolve; });
  let attempts = 0;
  bytesStore.write = async (bytes) => { if (++attempts === 1) await blocked; await write(bytes); };
  const db = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
  db.execute('CREATE TABLE notes(id TEXT)');
  const first = db.flush();
  db.execute("INSERT INTO notes VALUES ('during')");
  const second = db.flush();
  expect(db.getPersistenceState().pending).toBe(true);
  unblock();
  await Promise.all([first, second]);
  expect(attempts).toBe(2);
  await db.close();
  const reopened = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
  expect(reopened.query('SELECT * FROM notes')).toEqual([{ id: 'during' }]);
  await reopened.close();
});

it('F2 never persists references before the secret vault succeeds', async () => {
  const bytesStore = fixture();
  let vaultReady = false;
  const db = await createBrowserDatabaseAdapter({ locateFile, bytesStore, beforePersist: async () => {
    if (!vaultReady) throw new Error('keys unsaved');
  } });
  db.execute('CREATE TABLE identity(key_ref TEXT)');
  await expect(db.flush()).rejects.toThrow('keys unsaved');
  expect(await bytesStore.read()).toBeNull();
  vaultReady = true;
  await db.close();
  expect(await bytesStore.read()).not.toBeNull();
});

it('F2 retains edits made during a failed write and rejects flush until recovery', async () => {
  const bytesStore = fixture();
  const write = bytesStore.write;
  let fail!: () => void;
  const blocked = new Promise<void>((resolve) => { fail = resolve; });
  bytesStore.write = async () => { await blocked; throw new Error('interrupted'); };
  const db = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
  db.execute('CREATE TABLE notes(id TEXT)');
  const pending = db.flush();
  db.execute("INSERT INTO notes VALUES ('during failure')");
  fail();
  await expect(pending).rejects.toThrow('interrupted');
  expect(await bytesStore.read()).toBeNull();
  bytesStore.write = write;
  await db.retryPersistence();
  await db.close();
  const reopened = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
  expect(reopened.query('SELECT * FROM notes')).toEqual([{ id: 'during failure' }]);
  await reopened.close();
});

it('F1 releases failed boot ownership and prevents writes through the query API', async () => {
  const bytesStore = fixture();
  await expect(createBrowserDatabaseAdapter({ locateFile, bytesStore, beforeOpen: async () => { throw new Error('boot'); } })).rejects.toThrow('boot');
  const db = await createBrowserDatabaseAdapter({ locateFile, bytesStore });
  db.execute('CREATE TABLE notes(id TEXT)');
  await db.flush();
  expect(() => db.query("INSERT INTO notes VALUES ('bypass') RETURNING id")).toThrow(/readonly/);
  expect(db.getPersistenceState().status).toBe('saved');
  await db.close();
});
