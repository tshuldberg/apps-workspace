import { describe, expect, it } from 'vitest';
import {
  REJECTED_RETENTION_DAYS,
  buildPurgeCandidatesFilter,
  handleMediaPurgeRequest,
  runMediaPurge,
  type MediaPurgeDeps,
  type MediaPurgeStore,
  type PurgeCandidateRow,
} from '../index';

const NOW = '2026-07-04T12:00:00.000Z';

function fakeStore(candidates: PurgeCandidateRow[], options: {
  deleteFails?: Set<string>;
} = {}) {
  const deletedObjects: string[] = [];
  const purgedRows: string[] = [];
  const store: MediaPurgeStore = {
    async listPurgeCandidates(limit: number) {
      return candidates.slice(0, limit);
    },
    async deleteStorageObject(ref) {
      if (options.deleteFails?.has(ref.key)) throw new Error('storage boom');
      deletedObjects.push(`${ref.bucket}/${ref.key}`);
    },
    async markPurged(assetId) {
      purgedRows.push(assetId);
      return true;
    },
  };
  return { store, deletedObjects, purgedRows };
}

function deps(store: MediaPurgeStore, secret = 's3cret'): MediaPurgeDeps {
  return {
    env: (key: string) => (key === 'BESTCHEF_MEDIA_PURGE_WORKER_SECRET' ? secret : undefined),
    now: () => NOW,
    store,
  };
}

function candidate(id: string, key: string | null = `u1/${id}.mp4`): PurgeCandidateRow {
  return {
    id,
    storage_bucket: key ? 'bestchef-submission-videos' : null,
    storage_key: key,
    moderation_status: 'rejected',
    upload_status: 'uploaded',
    metadata: {},
  };
}

describe('bestchef-media-purge worker (TS-04)', () => {
  it('purges objects and stamps rows', async () => {
    const { store, deletedObjects, purgedRows } = fakeStore([candidate('a'), candidate('b')]);
    const result = await runMediaPurge(deps(store));

    expect(result).toMatchObject({ ok: true, scanned: 2, purgedObjects: 2, markedRows: 2 });
    expect(deletedObjects).toEqual([
      'bestchef-submission-videos/u1/a.mp4',
      'bestchef-submission-videos/u1/b.mp4',
    ]);
    expect(purgedRows).toEqual(['a', 'b']);
  });

  it('still stamps rows whose storage pointer is already gone', async () => {
    const { store, deletedObjects, purgedRows } = fakeStore([candidate('a', null)]);
    const result = await runMediaPurge(deps(store));

    expect(result).toMatchObject({ scanned: 1, purgedObjects: 0, markedRows: 1 });
    expect(deletedObjects).toEqual([]);
    expect(purgedRows).toEqual(['a']);
  });

  it('one failing object does not stop the batch', async () => {
    const { store, purgedRows } = fakeStore(
      [candidate('a'), candidate('b')],
      { deleteFails: new Set(['u1/a.mp4']) },
    );
    const result = await runMediaPurge(deps(store));

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([{ assetId: 'a', error: 'storage boom' }]);
    expect(purgedRows).toEqual(['b']);
  });

  it('clamps the batch limit', async () => {
    const many = Array.from({ length: 300 }, (_, i) => candidate(`a${i}`));
    const { store } = fakeStore(many);
    const result = await runMediaPurge(deps(store), 999);
    expect(result.scanned).toBe(200);
  });

  it('rejects requests without the worker secret', async () => {
    const { store } = fakeStore([]);
    const response = await handleMediaPurgeRequest(
      new Request('https://x/functions/v1/bestchef-media-purge', { method: 'POST' }),
      deps(store),
    );
    expect(response.status).toBe(401);
  });

  it('503s when the secret is not configured', async () => {
    const { store } = fakeStore([]);
    const response = await handleMediaPurgeRequest(
      new Request('https://x/f', { method: 'POST' }),
      { env: () => undefined, now: () => NOW, store },
    );
    expect(response.status).toBe(503);
  });

  it('runs with a valid secret and returns counts', async () => {
    const { store } = fakeStore([candidate('a')]);
    const response = await handleMediaPurgeRequest(
      new Request('https://x/f', {
        method: 'POST',
        headers: { 'X-BestChef-Worker-Secret': 's3cret' },
        body: JSON.stringify({ limit: 10 }),
      }),
      deps(store),
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { purgedObjects: number };
    expect(body.purgedObjects).toBe(1);
  });

  it('purges deletions immediately but holds rejections for the appeal window', () => {
    const filter = buildPurgeCandidatesFilter('2026-07-04T12:00:00.000Z', 50);
    expect(REJECTED_RETENTION_DAYS).toBeGreaterThanOrEqual(183);
    // Deleted uploads: no age gate. Rejections: gated behind the cutoff.
    expect(filter).toContain('or=(upload_status.eq.deleted,and(moderation_status.eq.rejected,updated_at.lt.2026-01-02T12:00:00.000Z))');
    expect(filter).toContain('storage_key=not.is.null');
    expect(filter).toContain("metadata->>purged_at=is.null");
    expect(filter).toContain('limit=50');
  });

  it('never purges quarantined child-safety evidence, even for owner-deleted uploads (C5)', () => {
    // A confirmed child-safety hit forces moderation_status='quarantined' and
    // files an open bc_child_safety_reports row. The purge filter must exclude
    // quarantined assets so the evidence bytes survive an account deletion.
    const filter = buildPurgeCandidatesFilter('2026-07-04T12:00:00.000Z', 50);
    expect(filter).toContain('moderation_status=not.eq.quarantined');
    // The exclusion is a top-level AND (not inside the or-group), so it applies
    // to BOTH the deleted-upload branch and the aged-rejection branch.
    const quarantineIdx = filter.indexOf('moderation_status=not.eq.quarantined');
    const orIdx = filter.indexOf('or=(');
    expect(quarantineIdx).toBeGreaterThanOrEqual(0);
    expect(quarantineIdx).toBeLessThan(orIdx);
  });

  it('405s non-POST', async () => {
    const { store } = fakeStore([]);
    const response = await handleMediaPurgeRequest(
      new Request('https://x/f', { method: 'GET' }),
      deps(store),
    );
    expect(response.status).toBe(405);
  });
});
