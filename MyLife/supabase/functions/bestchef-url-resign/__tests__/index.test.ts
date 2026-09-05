import { describe, expect, it } from 'vitest';
import {
  PLAYBACK_URL_TTL_SECONDS,
  RESIGN_WINDOW_DAYS,
  buildResignCandidatesFilter,
  handleUrlResignRequest,
  runUrlResign,
  type ResignCandidateRow,
  type UrlResignDeps,
  type UrlResignStore,
} from '../index';

const NOW = '2026-07-11T12:00:00.000Z';

function fakeStore(
  candidates: ResignCandidateRow[],
  options: { signFails?: Set<string>; updateFails?: Set<string>; signedUrl?: string } = {},
) {
  const signed: string[] = [];
  const updated: string[] = [];
  const store: UrlResignStore = {
    async listExpiringAssets(limit: number) {
      return candidates.slice(0, limit);
    },
    async signPlaybackUrl(ref) {
      if (options.signFails?.has(ref.key)) return null;
      signed.push(`${ref.bucket}/${ref.key}`);
      return options.signedUrl ?? `https://cdn.example.com/${ref.key}?resigned`;
    },
    async updatePlaybackUrl(assetId, patch) {
      if (options.updateFails?.has(assetId)) return false;
      updated.push(assetId);
      expect(patch.remoteUrl).toContain('https://');
      expect(patch.expiresAt).toBeTruthy();
      return true;
    },
  };
  return { store, signed, updated };
}

function deps(store: UrlResignStore, secret = 's3cret'): UrlResignDeps {
  return {
    env: (key: string) => (key === 'BESTCHEF_URL_RESIGN_WORKER_SECRET' ? secret : undefined),
    now: () => NOW,
    store,
  };
}

function candidate(id: string, key: string | null = `u1/${id}.mp4`): ResignCandidateRow {
  return {
    id,
    storage_bucket: key ? 'bestchef-submission-videos' : null,
    storage_key: key,
    metadata: {},
  };
}

describe('bestchef-url-resign worker (audit H6)', () => {
  it('re-signs expiring approved videos and stamps a new expiry', async () => {
    const { store, signed, updated } = fakeStore([candidate('a'), candidate('b')]);
    const result = await runUrlResign(deps(store));

    expect(result).toMatchObject({ ok: true, scanned: 2, resigned: 2 });
    expect(signed).toEqual([
      'bestchef-submission-videos/u1/a.mp4',
      'bestchef-submission-videos/u1/b.mp4',
    ]);
    expect(updated).toEqual(['a', 'b']);
  });

  it('skips a candidate whose storage pointer is already gone', async () => {
    const { store, signed, updated } = fakeStore([candidate('a', null)]);
    const result = await runUrlResign(deps(store));

    expect(result).toMatchObject({ scanned: 1, resigned: 0, failures: [] });
    expect(signed).toEqual([]);
    expect(updated).toEqual([]);
  });

  it('isolates a signing failure so the rest of the batch still resigns', async () => {
    const { store, updated } = fakeStore(
      [candidate('a'), candidate('b')],
      { signFails: new Set(['u1/a.mp4']) },
    );
    const result = await runUrlResign(deps(store));

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([{ assetId: 'a', error: 'signing_failed' }]);
    expect(updated).toEqual(['b']);
  });

  it('isolates an update failure (e.g. concurrent moderation decision) without stopping the batch', async () => {
    const { store, updated } = fakeStore(
      [candidate('a'), candidate('b')],
      { updateFails: new Set(['a']) },
    );
    const result = await runUrlResign(deps(store));

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([{ assetId: 'a', error: 'update_failed' }]);
    expect(updated).toEqual(['b']);
  });

  it('clamps the batch limit', async () => {
    const many = Array.from({ length: 300 }, (_, i) => candidate(`a${i}`));
    const { store } = fakeStore(many);
    const result = await runUrlResign(deps(store), 999);
    expect(result.scanned).toBe(200);
  });

  it('rejects requests without the worker secret', async () => {
    const { store } = fakeStore([]);
    const response = await handleUrlResignRequest(
      new Request('https://x/functions/v1/bestchef-url-resign', { method: 'POST' }),
      deps(store),
    );
    expect(response.status).toBe(401);
  });

  it('503s when the secret is not configured', async () => {
    const { store } = fakeStore([]);
    const response = await handleUrlResignRequest(
      new Request('https://x/f', { method: 'POST' }),
      { env: () => undefined, now: () => NOW, store },
    );
    expect(response.status).toBe(503);
  });

  it('runs with a valid secret and returns counts', async () => {
    const { store } = fakeStore([candidate('a')]);
    const response = await handleUrlResignRequest(
      new Request('https://x/f', {
        method: 'POST',
        headers: { 'X-BestChef-Worker-Secret': 's3cret' },
        body: JSON.stringify({ limit: 10 }),
      }),
      deps(store),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { resigned: number };
    expect(body.resigned).toBe(1);
  });

  it('405s non-POST', async () => {
    const { store } = fakeStore([]);
    const response = await handleUrlResignRequest(
      new Request('https://x/f', { method: 'GET' }),
      deps(store),
    );
    expect(response.status).toBe(405);
  });

  it('only selects approved videos within the rolling window, with a valid storage pointer', () => {
    const filter = buildResignCandidatesFilter('2026-07-11T12:00:00.000Z', 50);
    expect(PLAYBACK_URL_TTL_SECONDS).toBe(365 * 24 * 60 * 60);
    expect(RESIGN_WINDOW_DAYS).toBe(30);
    expect(filter).toContain('owner_kind=eq.submission');
    expect(filter).toContain('media_kind=eq.video');
    expect(filter).toContain('moderation_status=eq.approved');
    expect(filter).toContain('remote_url=not.is.null');
    expect(filter).toContain('storage_bucket=not.is.null');
    expect(filter).toContain('storage_key=not.is.null');
    expect(filter).toContain('playback_url_expires_at=lt.2026-08-10T12:00:00.000Z');
    expect(filter).toContain('limit=50');
  });
});
