import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  enqueueReport,
  listPendingReports,
  getPendingReport,
  retryPendingReport,
  retryPendingReports,
  generatePendingReportLocalId,
  computeReportNextAttemptDelayMinutes,
  type PendingReportPayload,
} from '../pending-reports';

vi.mock('../moderation', () => {
  return {
    reportContentToModeration: vi.fn(),
  };
});

import { reportContentToModeration } from '../moderation';

function createInMemoryDb(): DatabaseAdapter {
  type Row = {
    local_id: string;
    payload: string;
    last_error: string | null;
    attempt_count: number;
    next_attempt_at: string;
    synced: number;
    created_at: string;
    updated_at: string;
  };

  const rows = new Map<string, Row>();

  const adapter: Partial<DatabaseAdapter> = {
    execute(sql: string, params: unknown[] = []): void {
      if (sql.includes('INSERT INTO rc_pending_reports')) {
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
          synced: existing ? existing.synced : 0,
          created_at: existing ? existing.created_at : createdAt,
          updated_at: updatedAt,
        });
        return;
      }
      if (sql.includes('UPDATE rc_pending_reports') && sql.includes('synced = 1')) {
        const [updatedAt, localId] = params as [string, string];
        const existing = rows.get(localId);
        if (!existing) return;
        rows.set(localId, {
          ...existing,
          synced: 1,
          updated_at: updatedAt,
        });
        return;
      }
      if (sql.includes('UPDATE rc_pending_reports')) {
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
    },
    query<T>(sql: string, params: unknown[] = []): T[] {
      if (sql.includes('SELECT local_id FROM rc_pending_reports LIMIT 1')) {
        return [] as T[];
      }
      if (sql.includes('WHERE local_id = ?')) {
        const [localId] = params as [string];
        const row = rows.get(localId);
        return (row ? [row] : []) as T[];
      }
      if (sql.includes('WHERE synced = 0 AND next_attempt_at <= ?')) {
        const [now] = params as [string];
        return Array.from(rows.values())
          .filter((r) => r.synced === 0 && r.next_attempt_at <= now)
          .sort((a, b) => a.next_attempt_at.localeCompare(b.next_attempt_at)) as T[];
      }
      if (sql.includes('FROM rc_pending_reports')) {
        return Array.from(rows.values())
          .sort((a, b) => b.created_at.localeCompare(a.created_at)) as T[];
      }
      return [] as T[];
    },
    transaction<T>(fn: () => T): T {
      return fn();
    },
  };

  return adapter as DatabaseAdapter;
}

const samplePayload: PendingReportPayload = {
  targetKind: 'submission',
  targetId: '11111111-1111-4111-8111-111111111111',
  reason: 'Spam or scam',
  reporterProfileId: 'profile-1',
};

describe('computeReportNextAttemptDelayMinutes', () => {
  it('returns 0 for the first attempt', () => {
    expect(computeReportNextAttemptDelayMinutes(0)).toBe(0);
  });

  it('squares the attempt count', () => {
    expect(computeReportNextAttemptDelayMinutes(3)).toBe(9);
  });

  it('caps at 60 minutes', () => {
    expect(computeReportNextAttemptDelayMinutes(20)).toBe(60);
  });
});

describe('enqueueReport + listPendingReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists the report to the local queue', async () => {
    const db = createInMemoryDb();
    const result = await enqueueReport(null, db, {
      localId: 'r1',
      payload: samplePayload,
      error: 'offline',
    });

    expect(result.ok).toBe(true);
    expect(result.pending?.localId).toBe('r1');
    expect(result.pending?.synced).toBe(false);

    const list = listPendingReports(db);
    expect(list).toHaveLength(1);
    expect(list[0].payload.targetId).toBe(samplePayload.targetId);
  });

  it('is idempotent on the same localId', async () => {
    const db = createInMemoryDb();
    await enqueueReport(null, db, { localId: 'r1', payload: samplePayload, error: 'first' });
    await enqueueReport(null, db, { localId: 'r1', payload: samplePayload, error: 'second' });

    const list = listPendingReports(db);
    expect(list).toHaveLength(1);
    expect(list[0].lastError).toBe('second');
  });
});

describe('retryPendingReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the row synced when the cloud insert succeeds', async () => {
    const db = createInMemoryDb();
    await enqueueReport(null, db, { localId: 'r1', payload: samplePayload, error: 'offline' });

    vi.mocked(reportContentToModeration).mockResolvedValueOnce({
      ok: true,
      data: { flagId: 'flag-1', queueId: 'q-1', errorCode: null },
    });

    const result = await retryPendingReport(null, db, 'r1');
    expect(result.ok).toBe(true);
    expect(result.cloudReportId).toBe('flag-1');

    const row = getPendingReport(db, 'r1');
    expect(row?.synced).toBe(true);
  });

  it('increments attempt count and pushes out next_attempt_at when the cloud insert fails', async () => {
    const db = createInMemoryDb();
    await enqueueReport(null, db, { localId: 'r1', payload: samplePayload, error: 'offline' });

    vi.mocked(reportContentToModeration).mockResolvedValueOnce({
      ok: false,
      error: 'rate_limited',
    });

    const result = await retryPendingReport(null, db, 'r1');
    expect(result.ok).toBe(false);
    expect(result.attemptCount).toBe(1);
    expect(result.error).toBe('rate_limited');

    const row = getPendingReport(db, 'r1');
    expect(row?.attemptCount).toBe(1);
    expect(row?.synced).toBe(false);
  });

  it('treats an errorCode in a successful response as a retryable failure', async () => {
    const db = createInMemoryDb();
    await enqueueReport(null, db, { localId: 'r1', payload: samplePayload, error: 'offline' });

    vi.mocked(reportContentToModeration).mockResolvedValueOnce({
      ok: true,
      data: { flagId: null, queueId: null, errorCode: 'rate_limited' },
    });

    const result = await retryPendingReport(null, db, 'r1');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('rate_limited');
    const row = getPendingReport(db, 'r1');
    expect(row?.synced).toBe(false);
    expect(row?.attemptCount).toBe(1);
  });
});

describe('retryPendingReports sweeper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes only rows whose next_attempt_at has elapsed', async () => {
    const db = createInMemoryDb();
    await enqueueReport(null, db, { localId: 'r1', payload: samplePayload, error: 'a' });
    await enqueueReport(null, db, {
      localId: 'r2',
      payload: { ...samplePayload, reason: 'Other' },
      error: 'b',
    });

    vi.mocked(reportContentToModeration)
      .mockResolvedValueOnce({ ok: true, data: { flagId: 'f1', queueId: null, errorCode: null } })
      .mockResolvedValueOnce({ ok: false, error: 'fail' });

    const result = await retryPendingReports(null, db);
    expect(result.attempted).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.succeededLocalIds).toEqual(['r1']);
  });

  it('returns zero counts when no rows are pending', async () => {
    const db = createInMemoryDb();
    const result = await retryPendingReports(null, db);
    expect(result.attempted).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('coalesces concurrent sweeps into one cloud submission per pending row', async () => {
    // Arrange
    const db = createInMemoryDb();
    await enqueueReport(null, db, { localId: 'r1', payload: samplePayload, error: 'offline' });
    vi.mocked(reportContentToModeration).mockResolvedValueOnce({
      ok: true,
      data: { flagId: 'f1', queueId: null, errorCode: null },
    });

    // Act
    const firstSweep = retryPendingReports(null, db);
    const secondSweep = retryPendingReports(null, db);
    const [firstResult, secondResult] = await Promise.all([firstSweep, secondSweep]);

    // Assert
    expect(secondSweep).toBe(firstSweep);
    expect(firstResult).toEqual({
      attempted: 1,
      succeeded: 1,
      failed: 0,
      succeededLocalIds: ['r1'],
    });
    expect(secondResult).toBe(firstResult);
    expect(reportContentToModeration).toHaveBeenCalledTimes(1);
  });
});

describe('generatePendingReportLocalId', () => {
  it('returns a non-empty string', () => {
    const id = generatePendingReportLocalId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique values across consecutive calls', () => {
    const a = generatePendingReportLocalId();
    const b = generatePendingReportLocalId();
    expect(a).not.toBe(b);
  });
});
