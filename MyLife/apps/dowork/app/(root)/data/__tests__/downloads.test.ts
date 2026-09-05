// DoWork offline-download contract tests.
//
// The modern expo-file-system API and the legacy download resumable are mocked
// over a shared in-memory filesystem so the entitlement gating + index
// bookkeeping can be exercised without a native runtime. Supabase is a thin
// stub over functions.invoke (the download source + the entitlement probe both
// go through it).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import type { SupabaseClient } from '@supabase/supabase-js';

const fsState = vi.hoisted(() => ({
  files: new Map<string, number>(),
  dirs: new Set<string>(),
  downloadStatus: 200 as number,
  downloadBytes: 2048,
  downloadThrows: false,
}));

vi.mock('expo-file-system', () => {
  function join(base: unknown, parts: string[]): string {
    const baseUri = typeof base === 'string' ? base : (base as { uri: string }).uri;
    const trimmed = baseUri.replace(/\/$/, '');
    return parts.length ? [trimmed, ...parts].join('/') : baseUri;
  }
  class Directory {
    uri: string;
    constructor(base: unknown, ...parts: string[]) {
      this.uri = `${join(base, parts)}/`;
    }
    get exists(): boolean {
      return fsState.dirs.has(this.uri);
    }
    create(): void {
      fsState.dirs.add(this.uri);
    }
    delete(): void {
      fsState.dirs.delete(this.uri);
      for (const key of [...fsState.files.keys()]) {
        if (key.startsWith(this.uri)) fsState.files.delete(key);
      }
    }
    list(): unknown[] {
      return [];
    }
  }
  class File {
    uri: string;
    constructor(base: unknown, ...parts: string[]) {
      this.uri = join(base, parts);
    }
    get exists(): boolean {
      return fsState.files.has(this.uri);
    }
    get size(): number | null {
      return fsState.files.has(this.uri) ? (fsState.files.get(this.uri) ?? 0) : null;
    }
    create(): void {
      if (!fsState.files.has(this.uri)) fsState.files.set(this.uri, 0);
    }
    delete(): void {
      fsState.files.delete(this.uri);
    }
  }
  return { Paths: { document: { uri: 'file:///doc/' } }, Directory, File };
});

vi.mock('expo-file-system/legacy', () => ({
  createDownloadResumable: (
    _url: string,
    fileUri: string,
    _opts: unknown,
    cb?: (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
  ) => ({
    downloadAsync: async () => {
      cb?.({ totalBytesWritten: fsState.downloadBytes, totalBytesExpectedToWrite: fsState.downloadBytes });
      if (fsState.downloadThrows) throw new Error('network down');
      if (fsState.downloadStatus >= 200 && fsState.downloadStatus < 300) {
        fsState.files.set(fileUri, fsState.downloadBytes);
      }
      return { status: fsState.downloadStatus, uri: fileUri };
    },
    pauseAsync: async () => ({}),
  }),
}));

import {
  checkDownloadEntitlement,
  deleteDownload,
  downloadTrainerVideo,
  formatBytes,
  getDownload,
  getDownloadsTotalBytes,
  isVideoDownloaded,
  listDownloads,
  resolveDownloadedVideo,
  startVideoDownload,
  wipeAllDownloads,
} from '../downloads';

// In-memory stand-in for the hub_settings KV table. Exposes the backing store
// so tests can seed resume-position rows and assert the download-delete paths
// prune them (RT-1).
function makeKvDb(): DatabaseAdapter & { kv: Map<string, string> } {
  const store = new Map<string, string>();
  const db = {
    kv: store,
    query: <T>(sql: string, params: unknown[] = []): T[] => {
      if (sql.includes('FROM hub_settings')) {
        const value = store.get(String(params[0]));
        return (value === undefined ? [] : [{ value }]) as T[];
      }
      return [] as T[];
    },
    execute: (sql: string, params: unknown[] = []) => {
      if (sql.includes('INSERT INTO hub_settings')) {
        store.set(String(params[0]), String(params[1]));
      } else if (sql.includes('DELETE FROM hub_settings')) {
        store.delete(String(params[0]));
      }
    },
    transaction: (fn: () => void) => {
      fn();
    },
  };
  return db as unknown as DatabaseAdapter & { kv: Map<string, string> };
}

const RESUME_PREFIX = 'voice.player.resume.';

function seedResume(db: DatabaseAdapter & { kv: Map<string, string> }, videoId: string, seconds: number): void {
  db.kv.set(`${RESUME_PREFIX}${videoId}`, String(seconds));
}

function hasResume(db: DatabaseAdapter & { kv: Map<string, string> }, videoId: string): boolean {
  return db.kv.has(`${RESUME_PREFIX}${videoId}`);
}

type InvokeHandler = (name: string, opts: { body: Record<string, unknown> }) => { data: unknown; error: unknown };

function makeSupabase(handler: InvokeHandler) {
  const invoke = vi.fn(async (name: string, opts: { body: Record<string, unknown> }) => handler(name, opts));
  return { supabase: { functions: { invoke } } as unknown as SupabaseClient, invoke };
}

const SIGNED = {
  url: 'https://cdn.example.com/signed/clip.mp4?token=abc',
  expiresAt: '2026-07-04T00:00:00Z',
  kind: 'trainer_video',
  title: 'Bench setup',
  durationSeconds: 42,
};

beforeEach(() => {
  fsState.files.clear();
  fsState.dirs.clear();
  fsState.downloadStatus = 200;
  fsState.downloadBytes = 2048;
  fsState.downloadThrows = false;
});

describe('download index', () => {
  it('starts empty and reports zero bytes', () => {
    const db = makeKvDb();
    expect(listDownloads(db)).toEqual([]);
    expect(getDownloadsTotalBytes(db)).toBe(0);
    expect(isVideoDownloaded(db, 'v1')).toBe(false);
    expect(getDownload(db, 'v1')).toBeNull();
  });

  it('drops corrupt index payloads instead of throwing', () => {
    const db = makeKvDb();
    db.execute(
      `INSERT INTO hub_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['dowork.downloads.index.v1', 'not json{{{'],
    );
    expect(() => listDownloads(db)).not.toThrow();
    expect(listDownloads(db)).toEqual([]);
  });
});

describe('concurrent index writes (DL-1)', () => {
  it('survives two near-concurrent upserts for different videos', async () => {
    const db = makeKvDb();
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));

    // Simulate two downloads finishing back to back by racing their
    // completion writes: both must be present in the index afterward,
    // not just whichever wrote last on a stale read.
    const [a, b] = await Promise.all([
      downloadTrainerVideo({ supabase, db, videoId: 'v1', title: 'First' }),
      downloadTrainerVideo({ supabase, db, videoId: 'v2', title: 'Second' }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(isVideoDownloaded(db, 'v1')).toBe(true);
    expect(isVideoDownloaded(db, 'v2')).toBe(true);
    expect(listDownloads(db)).toHaveLength(2);
  });

  it('upsertIndex writes go through db.transaction', async () => {
    const db = makeKvDb();
    let transactionCalls = 0;
    const wrapped: DatabaseAdapter = {
      ...db,
      transaction: (fn: () => void) => {
        transactionCalls += 1;
        fn();
      },
    };
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    await downloadTrainerVideo({ supabase, db: wrapped, videoId: 'v1' });
    expect(transactionCalls).toBeGreaterThan(0);
  });

  it('wraps the index write (INSERT) inside a transaction, with a read in the same scope', async () => {
    // Trace every KV op, flagging whether a transaction was open. The upsert's
    // INSERT must always land inside a transaction, and the read-modify-write
    // must read the current map from within that same transaction so no
    // interleaving reader/writer can clobber it (DL-1). The pre-download
    // "already downloaded?" probe reads outside a transaction, which is fine;
    // we only require that every INSERT and its paired in-transaction SELECT
    // are transaction-scoped.
    const store = new Map<string, string>();
    let depth = 0;
    const trace: Array<{ op: 'query' | 'execute'; inTx: boolean }> = [];
    const tracingDb = {
      query: <T>(sql: string, params: unknown[] = []): T[] => {
        if (sql.includes('FROM hub_settings')) {
          trace.push({ op: 'query', inTx: depth > 0 });
          const value = store.get(String(params[0]));
          return (value === undefined ? [] : [{ value }]) as T[];
        }
        return [] as T[];
      },
      execute: (sql: string, params: unknown[] = []) => {
        if (sql.includes('INSERT INTO hub_settings')) {
          trace.push({ op: 'execute', inTx: depth > 0 });
          store.set(String(params[0]), String(params[1]));
        }
      },
      transaction: (fn: () => void) => {
        depth += 1;
        try {
          fn();
        } finally {
          depth -= 1;
        }
      },
    } as unknown as DatabaseAdapter;

    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    await downloadTrainerVideo({ supabase, db: tracingDb, videoId: 'v1' });

    const inserts = trace.filter((t) => t.op === 'execute');
    expect(inserts).toHaveLength(1);
    expect(inserts.every((t) => t.inTx)).toBe(true);
    // At least one hub_settings read happened inside the transaction (the
    // read half of the atomic read-modify-write).
    expect(trace.some((t) => t.op === 'query' && t.inTx)).toBe(true);
  });

  it('routes removeFromIndex (deleteDownload) through db.transaction too', async () => {
    const db = makeKvDb();
    let transactionCalls = 0;
    const wrapped: DatabaseAdapter = {
      ...db,
      transaction: (fn: () => void) => {
        transactionCalls += 1;
        fn();
      },
    };
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    await downloadTrainerVideo({ supabase, db: wrapped, videoId: 'v1' });
    const afterUpsert = transactionCalls;
    await deleteDownload(wrapped, 'v1');
    expect(transactionCalls).toBeGreaterThan(afterUpsert);
    expect(isVideoDownloaded(wrapped, 'v1')).toBe(false);
  });
});

describe('downloadTrainerVideo', () => {
  it('downloads an entitled video, records the index, and reports progress', async () => {
    const db = makeKvDb();
    const { supabase, invoke } = makeSupabase(() => ({ data: SIGNED, error: null }));
    const progress: number[] = [];
    const result = await downloadTrainerVideo(
      { supabase, db, videoId: 'v1', title: 'Bench setup' },
      { onProgress: (p) => progress.push(p.fraction) },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.videoId).toBe('v1');
      expect(result.entry.bytes).toBe(2048);
      expect(result.entry.title).toBe('Bench setup');
      expect(result.entry.fileUri).toContain('trainer-downloads/v1.mp4');
    }
    expect(progress[progress.length - 1]).toBe(1);
    expect(invoke).toHaveBeenCalledWith('dowork-playback-url', { body: { videoId: 'v1' } });
    expect(isVideoDownloaded(db, 'v1')).toBe(true);
    expect(getDownloadsTotalBytes(db)).toBe(2048);
  });

  it('is a no-op that returns the existing entry when already downloaded', async () => {
    const db = makeKvDb();
    const { supabase, invoke } = makeSupabase(() => ({ data: SIGNED, error: null }));
    await downloadTrainerVideo({ supabase, db, videoId: 'v1' });
    invoke.mockClear();
    const again = await downloadTrainerVideo({ supabase, db, videoId: 'v1' });
    expect(again.ok).toBe(true);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('refuses to download without a cloud connection', async () => {
    const db = makeKvDb();
    const result = await downloadTrainerVideo({ supabase: null, db, videoId: 'v1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/cloud connection/i);
  });

  it('surfaces an entitlement failure from the server (no fake success)', async () => {
    const db = makeKvDb();
    const { supabase } = makeSupabase(() => ({ data: { ok: false, error: 'not_entitled' }, error: null }));
    const result = await downloadTrainerVideo({ supabase, db, videoId: 'v1' });
    expect(result.ok).toBe(false);
    expect(isVideoDownloaded(db, 'v1')).toBe(false);
  });

  it('cleans up the partial file on a non-2xx download', async () => {
    fsState.downloadStatus = 500;
    const db = makeKvDb();
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    const result = await downloadTrainerVideo({ supabase, db, videoId: 'v1' });
    expect(result.ok).toBe(false);
    expect(isVideoDownloaded(db, 'v1')).toBe(false);
    expect(fsState.files.size).toBe(0);
  });

  it('reports a thrown download error and leaves no index row', async () => {
    fsState.downloadThrows = true;
    const db = makeKvDb();
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    const result = await downloadTrainerVideo({ supabase, db, videoId: 'v1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('network down');
    expect(isVideoDownloaded(db, 'v1')).toBe(false);
  });

  it('reports an honest error instead of throwing when the sandbox directory cannot be created (RT-15)', async () => {
    const db = makeKvDb();
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    // Simulate a full disk / permission failure inside Directory.create().
    const { Directory } = await import('expo-file-system');
    const originalCreate = Directory.prototype.create;
    Directory.prototype.create = () => {
      throw new Error('ENOSPC: no space left on device');
    };
    try {
      await expect(
        downloadTrainerVideo({ supabase, db, videoId: 'v1' }),
      ).resolves.toEqual({ ok: false, error: 'ENOSPC: no space left on device' });
    } finally {
      Directory.prototype.create = originalCreate;
    }
    expect(isVideoDownloaded(db, 'v1')).toBe(false);
  });
});

describe('startVideoDownload cancel', () => {
  it('reports a cancelled result and writes no index row', async () => {
    const db = makeKvDb();
    // A holder object (rather than a bare `let`) avoids TS narrowing the
    // reassigned closure variable back to `null` at the call site below.
    const resolveInvokeRef: { current: ((value: { data: unknown; error: unknown }) => void) | null } = {
      current: null,
    };
    const invoke = vi.fn(
      () => new Promise<{ data: unknown; error: unknown }>((resolve) => {
        resolveInvokeRef.current = resolve;
      }),
    );
    const supabase = { functions: { invoke } } as unknown as SupabaseClient;

    const handle = startVideoDownload({ supabase, db, videoId: 'v1' });
    await handle.cancel();
    // Let the (now cancelled) entitlement check resolve.
    resolveInvokeRef.current?.({ data: SIGNED, error: null });
    const result = await handle.promise;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.cancelled).toBe(true);
    expect(isVideoDownloaded(db, 'v1')).toBe(false);
  });
});

describe('checkDownloadEntitlement', () => {
  it('returns entitled for a 200 with a url', async () => {
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    expect(await checkDownloadEntitlement(supabase, 'v1')).toBe('entitled');
  });

  it('returns revoked for an ok:false not_entitled payload', async () => {
    const { supabase } = makeSupabase(() => ({ data: { ok: false, error: 'not_entitled' }, error: null }));
    expect(await checkDownloadEntitlement(supabase, 'v1')).toBe('revoked');
  });

  it('returns revoked for a 403 FunctionsHttpError context', async () => {
    const { supabase } = makeSupabase(() => ({
      data: null,
      error: {
        message: 'non-2xx',
        context: { status: 403, clone: () => ({ json: async () => ({ error: 'not_entitled' }) }) },
      },
    }));
    expect(await checkDownloadEntitlement(supabase, 'v1')).toBe('revoked');
  });

  it('treats a markerless 403 as offline/unknown and keeps the file', async () => {
    // Gateways, JWT middleware, and CORS-ish layers can 403 without the
    // playback function's { error: 'not_entitled' } body; that must never
    // delete a legitimately owned download.
    const { supabase } = makeSupabase(() => ({
      data: null,
      error: {
        message: 'non-2xx',
        context: {
          status: 403,
          clone: () => ({ json: async () => { throw new Error('no body'); } }),
        },
      },
    }));
    expect(await checkDownloadEntitlement(supabase, 'v1')).toBe('offline');
  });

  it('treats a 500 error as offline (keeps the file)', async () => {
    const { supabase } = makeSupabase(() => ({
      data: null,
      error: { message: 'boom', context: { status: 500, clone: () => ({ json: async () => ({}) }) } },
    }));
    expect(await checkDownloadEntitlement(supabase, 'v1')).toBe('offline');
  });

  it('treats a thrown invoke as offline', async () => {
    const supabase = {
      functions: { invoke: vi.fn(async () => { throw new Error('network'); }) },
    } as unknown as SupabaseClient;
    expect(await checkDownloadEntitlement(supabase, 'v1')).toBe('offline');
  });

  it('returns needs_reauth for a 401 (stale session), distinct from offline (RT-12)', async () => {
    const { supabase } = makeSupabase(() => ({
      data: null,
      error: { message: 'non-2xx', context: { status: 401, clone: () => ({ json: async () => ({}) }) } },
    }));
    expect(await checkDownloadEntitlement(supabase, 'v1')).toBe('needs_reauth');
  });
});

describe('resolveDownloadedVideo', () => {
  async function seedDownload(db: DatabaseAdapter, supabaseHandler: InvokeHandler) {
    const { supabase } = makeSupabase(supabaseHandler);
    await downloadTrainerVideo({ supabase, db, videoId: 'v1', title: 'Bench setup' });
    return supabase;
  }

  it('returns not_downloaded when nothing is saved', async () => {
    const db = makeKvDb();
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    const result = await resolveDownloadedVideo({ supabase, db, videoId: 'v1' });
    expect(result.status).toBe('not_downloaded');
  });

  it('plays the local file when the server still confirms entitlement', async () => {
    const db = makeKvDb();
    await seedDownload(db, () => ({ data: SIGNED, error: null }));
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    const result = await resolveDownloadedVideo({ supabase, db, videoId: 'v1' });
    expect(result.status).toBe('play_local');
    if (result.status === 'play_local') expect(result.fileUri).toContain('v1.mp4');
  });

  it('plays the local file offline without deleting it', async () => {
    const db = makeKvDb();
    await seedDownload(db, () => ({ data: SIGNED, error: null }));
    const { supabase } = makeSupabase(() => ({ data: null, error: { message: 'offline' } }));
    const result = await resolveDownloadedVideo({ supabase, db, videoId: 'v1' });
    expect(result.status).toBe('play_local');
    expect(isVideoDownloaded(db, 'v1')).toBe(true);
  });

  it('deletes the file and explains when entitlement is revoked', async () => {
    const db = makeKvDb();
    await seedDownload(db, () => ({ data: SIGNED, error: null }));
    const { supabase } = makeSupabase(() => ({ data: { ok: false, error: 'not_entitled' }, error: null }));
    const result = await resolveDownloadedVideo({ supabase, db, videoId: 'v1' });
    expect(result.status).toBe('revoked');
    if (result.status === 'revoked') expect(result.message).toMatch(/access/i);
    expect(isVideoDownloaded(db, 'v1')).toBe(false);
    expect(fsState.files.size).toBe(0);
  });

  it('prunes the saved resume row on a revoked deletion (RT-1)', async () => {
    const db = makeKvDb();
    await seedDownload(db, () => ({ data: SIGNED, error: null }));
    seedResume(db, 'v1', 120);
    const { supabase } = makeSupabase(() => ({ data: { ok: false, error: 'not_entitled' }, error: null }));
    const result = await resolveDownloadedVideo({ supabase, db, videoId: 'v1' });
    expect(result.status).toBe('revoked');
    expect(hasResume(db, 'v1')).toBe(false);
  });

  it('cleans a stale index row when the file is gone from disk', async () => {
    const db = makeKvDb();
    await seedDownload(db, () => ({ data: SIGNED, error: null }));
    fsState.files.clear(); // simulate an external eviction
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    const result = await resolveDownloadedVideo({ supabase, db, videoId: 'v1' });
    expect(result.status).toBe('not_downloaded');
    expect(isVideoDownloaded(db, 'v1')).toBe(false);
  });
});

describe('deleteDownload + wipeAllDownloads', () => {
  it('deletes a single download and its file', async () => {
    const db = makeKvDb();
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    await downloadTrainerVideo({ supabase, db, videoId: 'v1' });
    await downloadTrainerVideo({ supabase, db, videoId: 'v2' });
    await deleteDownload(db, 'v1');
    expect(isVideoDownloaded(db, 'v1')).toBe(false);
    expect(isVideoDownloaded(db, 'v2')).toBe(true);
  });

  it('prunes the saved resume row when a single download is deleted (RT-1)', async () => {
    const db = makeKvDb();
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    await downloadTrainerVideo({ supabase, db, videoId: 'v1' });
    await downloadTrainerVideo({ supabase, db, videoId: 'v2' });
    seedResume(db, 'v1', 90);
    seedResume(db, 'v2', 30);
    await deleteDownload(db, 'v1');
    expect(hasResume(db, 'v1')).toBe(false);
    // The other download's playhead is untouched.
    expect(hasResume(db, 'v2')).toBe(true);
  });

  it('wipes every download and clears the index', async () => {
    const db = makeKvDb();
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    await downloadTrainerVideo({ supabase, db, videoId: 'v1' });
    await downloadTrainerVideo({ supabase, db, videoId: 'v2' });
    await wipeAllDownloads(db);
    expect(listDownloads(db)).toEqual([]);
    expect(getDownloadsTotalBytes(db)).toBe(0);
    expect(fsState.files.size).toBe(0);
  });

  it('prunes every downloaded video resume row on a full wipe (RT-1)', async () => {
    const db = makeKvDb();
    const { supabase } = makeSupabase(() => ({ data: SIGNED, error: null }));
    await downloadTrainerVideo({ supabase, db, videoId: 'v1' });
    await downloadTrainerVideo({ supabase, db, videoId: 'v2' });
    seedResume(db, 'v1', 90);
    seedResume(db, 'v2', 30);
    // A streamed-only video's playhead is not managed by downloads and must survive.
    seedResume(db, 'streamed', 45);
    await wipeAllDownloads(db);
    expect(hasResume(db, 'v1')).toBe(false);
    expect(hasResume(db, 'v2')).toBe(false);
    expect(hasResume(db, 'streamed')).toBe(true);
  });
});

describe('formatBytes', () => {
  it('formats an honest empty state', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
  });

  it('scales through KB / MB / GB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3 GB');
  });
});
