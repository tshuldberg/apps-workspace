import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  enqueueFailedSubmission,
  updatePendingSubmissionPhotoUrl,
  listPendingSubmissions,
  retryPendingSubmission,
  computeNextAttemptDelayMinutes,
  runPendingSubmissionSweep,
} from '../submission-sync-queue';

// In-memory mini adapter that mimics DatabaseAdapter for the rc_pending_submissions table.
function createInMemoryDb(): DatabaseAdapter {
  type Row = {
    local_id: string;
    payload: string;
    last_error: string | null;
    attempt_count: number;
    next_attempt_at: string;
    created_at: string;
    updated_at: string;
  };

  const rows = new Map<string, Row>();

  const adapter: Partial<DatabaseAdapter> = {
    execute(sql: string, params: unknown[] = []): void {
      if (sql.includes('INSERT INTO rc_pending_submissions')) {
        const [
          localId,
          payload,
          lastError,
          nextAttemptAt,
          createdAt,
          updatedAt,
        ] = params as [string, string, string, string, string, string];
        const existing = rows.get(localId);
        rows.set(localId, {
          local_id: localId,
          payload,
          last_error: lastError,
          attempt_count: existing ? existing.attempt_count : 0,
          next_attempt_at: nextAttemptAt,
          created_at: existing ? existing.created_at : createdAt,
          updated_at: updatedAt,
        });
        return;
      }
      if (sql.includes('SET payload = ?')) {
        const [payload, updatedAt, localId] = params as [string, string, string];
        const existing = rows.get(localId);
        if (!existing) return;
        rows.set(localId, { ...existing, payload, updated_at: updatedAt });
        return;
      }
      if (sql.includes('UPDATE rc_pending_submissions')) {
        const [attemptCount, lastError, nextAttemptAt, updatedAt, localId] = params as [
          number,
          string,
          string,
          string,
          string,
        ];
        const existing = rows.get(localId);
        if (!existing) return;
        rows.set(localId, {
          ...existing,
          attempt_count: attemptCount,
          last_error: lastError,
          next_attempt_at: nextAttemptAt,
          updated_at: updatedAt,
        });
        return;
      }
      if (sql.includes('DELETE FROM rc_pending_submissions')) {
        const [localId] = params as [string];
        rows.delete(localId);
        return;
      }
    },
    query<T>(sql: string, params: unknown[] = []): T[] {
      if (sql.includes('SELECT local_id FROM rc_pending_submissions LIMIT 1')) {
        return [] as T[];
      }
      if (sql.includes('WHERE local_id = ?')) {
        const [localId] = params as [string];
        const row = rows.get(localId);
        return (row ? [row] : []) as T[];
      }
      if (sql.includes('WHERE next_attempt_at <= ?')) {
        const [now] = params as [string];
        return Array.from(rows.values())
          .filter((r) => r.next_attempt_at <= now)
          .sort((a, b) => a.next_attempt_at.localeCompare(b.next_attempt_at)) as T[];
      }
      if (sql.includes('FROM rc_pending_submissions')) {
        return Array.from(rows.values())
          .sort((a, b) => a.created_at.localeCompare(b.created_at)) as T[];
      }
      return [] as T[];
    },
    transaction<T>(fn: () => T): T {
      return fn();
    },
  };

  return adapter as DatabaseAdapter;
}

vi.mock('../submission-alias', () => {
  return {
    ensureSubmissionAlias: vi.fn(),
  };
});

import { ensureSubmissionAlias } from '../submission-alias';

const samplePayload = {
  alias: 'local:abc-123',
  profileId: 'profile-1',
  dishSlug: 'pad-thai',
  title: 'My Pad Thai',
  description: 'Yum',
  ingredients: ['noodles', 'tamarind'],
  steps: ['boil', 'toss'],
  tags: [],
  photoUrl: null,
};

describe('computeNextAttemptDelayMinutes', () => {
  it('returns 0 for non-positive attempts', () => {
    expect(computeNextAttemptDelayMinutes(0)).toBe(0);
    expect(computeNextAttemptDelayMinutes(-1)).toBe(0);
  });

  it('returns attempt^2 below the cap', () => {
    expect(computeNextAttemptDelayMinutes(1)).toBe(1);
    expect(computeNextAttemptDelayMinutes(2)).toBe(4);
    expect(computeNextAttemptDelayMinutes(7)).toBe(49);
  });

  it('caps at 60 minutes for large attempts', () => {
    expect(computeNextAttemptDelayMinutes(8)).toBe(60);
    expect(computeNextAttemptDelayMinutes(20)).toBe(60);
  });
});

describe('enqueueFailedSubmission + listPendingSubmissions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('enqueues a row that listPendingSubmissions returns', async () => {
    const db = createInMemoryDb();

    const enqueued = await enqueueFailedSubmission(db, null, {
      localId: 'local-1',
      payload: samplePayload,
      error: 'offline',
    });
    expect(enqueued).not.toBeNull();
    expect(enqueued?.localId).toBe('local-1');
    expect(enqueued?.attemptCount).toBe(0);

    const all = listPendingSubmissions(db);
    expect(all).toHaveLength(1);
    expect(all[0].lastError).toBe('offline');
    expect(all[0].payload.title).toBe('My Pad Thai');
  });

  it('patches the queued payload photo URL for replay reconciliation', async () => {
    const db = createInMemoryDb();
    await enqueueFailedSubmission(db, null, {
      localId: 'local-1',
      payload: { ...samplePayload, photoUrl: null },
      error: 'offline',
    });

    expect(updatePendingSubmissionPhotoUrl(db, 'local-1', 'https://cdn.example.com/p.jpg')).toBe(true);
    expect(listPendingSubmissions(db)[0].payload.photoUrl).toBe('https://cdn.example.com/p.jpg');

    expect(updatePendingSubmissionPhotoUrl(db, 'missing', 'https://x')).toBe(false);
  });

  it('replaces payload + error on duplicate enqueue', async () => {
    const db = createInMemoryDb();
    await enqueueFailedSubmission(db, null, {
      localId: 'local-1',
      payload: samplePayload,
      error: 'offline',
    });
    await enqueueFailedSubmission(db, null, {
      localId: 'local-1',
      payload: { ...samplePayload, title: 'Updated' },
      error: 'rls denied',
    });

    const all = listPendingSubmissions(db);
    expect(all).toHaveLength(1);
    expect(all[0].lastError).toBe('rls denied');
    expect(all[0].payload.title).toBe('Updated');
  });
});

describe('retryPendingSubmission', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('deletes the row on success and returns the cloud submission id', async () => {
    const db = createInMemoryDb();
    await enqueueFailedSubmission(db, null, {
      localId: 'local-1',
      payload: samplePayload,
      error: 'offline',
    });

    vi.mocked(ensureSubmissionAlias).mockResolvedValueOnce({
      ok: true,
      data: 'cloud-uuid-1',
    } as never);

    const result = await retryPendingSubmission(null, db, 'local-1');
    expect(result.ok).toBe(true);
    expect(result.cloudSubmissionId).toBe('cloud-uuid-1');
    expect(listPendingSubmissions(db)).toHaveLength(0);
  });

  it('increments attempt_count on failure with squared backoff', async () => {
    const db = createInMemoryDb();
    await enqueueFailedSubmission(db, null, {
      localId: 'local-1',
      payload: samplePayload,
      error: 'offline',
    });

    vi.mocked(ensureSubmissionAlias).mockResolvedValueOnce({
      ok: false,
      error: 'still offline',
    } as never);

    const before = Date.now();
    const result = await retryPendingSubmission(null, db, 'local-1');
    expect(result.ok).toBe(false);
    expect(result.attemptCount).toBe(1);
    expect(result.error).toBe('still offline');
    expect(result.nextAttemptAt).not.toBeNull();

    const rows = listPendingSubmissions(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].attemptCount).toBe(1);

    // 1^2 = 1 minute delay; the timestamp must be at least ~58s in the future.
    const delayMs = new Date(rows[0].nextAttemptAt).getTime() - before;
    expect(delayMs).toBeGreaterThan(55_000);
    expect(delayMs).toBeLessThan(120_000);
  });

  it('caps backoff at 60 minutes after enough attempts', async () => {
    const db = createInMemoryDb();
    await enqueueFailedSubmission(db, null, {
      localId: 'local-1',
      payload: samplePayload,
      error: 'offline',
    });

    vi.mocked(ensureSubmissionAlias).mockResolvedValue({
      ok: false,
      error: 'still failing',
    } as never);

    let last;
    for (let i = 0; i < 9; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      last = await retryPendingSubmission(null, db, 'local-1');
    }
    expect(last?.attemptCount).toBe(9);
    expect(last?.nextAttemptAt).not.toBeNull();
    const delayMs = new Date(last!.nextAttemptAt!).getTime() - Date.now();
    // Backoff is capped at 60 minutes (3600s).
    expect(delayMs).toBeLessThanOrEqual(60 * 60 * 1000 + 5_000);
    expect(delayMs).toBeGreaterThan(55 * 60 * 1000);
  });

  it('returns an error when the local row does not exist', async () => {
    const db = createInMemoryDb();
    const result = await retryPendingSubmission(null, db, 'missing');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});

describe('runPendingSubmissionSweep', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retries due rows and reports counts', async () => {
    const db = createInMemoryDb();

    await enqueueFailedSubmission(db, null, {
      localId: 'local-1',
      payload: samplePayload,
      error: 'offline',
    });
    await enqueueFailedSubmission(db, null, {
      localId: 'local-2',
      payload: { ...samplePayload, alias: 'local:def-456' },
      error: 'offline',
    });

    vi.mocked(ensureSubmissionAlias)
      .mockResolvedValueOnce({ ok: true, data: 'cloud-1' } as never)
      .mockResolvedValueOnce({ ok: false, error: 'still failing' } as never);

    const result = await runPendingSubmissionSweep(null, db);
    expect(result.attempted).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.succeededLocalIds).toEqual(['local-1']);
  });
});
