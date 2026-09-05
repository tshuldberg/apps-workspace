import { describe, expect, it } from 'vitest';
import {
  handleMediaFinalizeRequest,
  type FinalizedMediaAsset,
  type MediaAssetForFinalize,
  type MediaFinalizeStore,
} from '../index.ts';

const NOW = '2026-04-26T12:00:00.000Z';
const FAKE_JWT = (() => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1' }));
  return `${header}.${payload}.sig`;
})();

function makeRequest(body: unknown, opts: { auth?: string | null; method?: string } = {}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const auth = opts.auth === undefined ? `Bearer ${FAKE_JWT}` : opts.auth;
  if (auth) headers.set('Authorization', auth);
  return new Request('http://localhost/functions/bestchef-media-finalize', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

class FakeFinalizeStore implements MediaFinalizeStore {
  profileId: string | null = 'profile-1';
  asset: MediaAssetForFinalize | null = {
    id: 'asset-1',
    owner_profile_id: 'profile-1',
    metadata: { upload_id: 'upload-1' },
  };
  finalized: Array<Parameters<MediaFinalizeStore['finalizeAsset']>[0]> = [];

  async getProfileId(): Promise<string | null> {
    return this.profileId;
  }

  async getAssetForProfile(assetId: string, profileId: string): Promise<MediaAssetForFinalize | null> {
    if (!this.asset || this.asset.id !== assetId || this.asset.owner_profile_id !== profileId) {
      return null;
    }
    return this.asset;
  }

  async finalizeAsset(
    input: Parameters<MediaFinalizeStore['finalizeAsset']>[0],
  ): Promise<FinalizedMediaAsset> {
    this.finalized.push(input);
    return {
      id: input.asset.id,
      upload_status: 'uploaded',
      moderation_status: 'pending',
      visibility: 'private',
      width: input.width,
      height: input.height,
      duration_ms: input.durationMs,
    };
  }
}

function makeDeps(store = new FakeFinalizeStore()) {
  return {
    env: () => undefined,
    now: () => NOW,
    store,
  };
}

describe('bestchef-media-finalize handler', () => {
  it('rejects unauthenticated finalize requests', async () => {
    const res = await handleMediaFinalizeRequest(
      makeRequest({ assetId: 'asset-1' }, { auth: null }),
      makeDeps(),
    );

    expect(res.status).toBe(401);
  });

  it('rejects finalize payloads containing media URLs', async () => {
    const res = await handleMediaFinalizeRequest(
      makeRequest({
        assetId: 'asset-1',
        remoteUrl: 'https://example.com/image.jpg',
      }),
      makeDeps(),
    );

    expect(res.status).toBe(400);
  });

  it('finalizes a profile-owned asset without approving public delivery', async () => {
    const store = new FakeFinalizeStore();
    const res = await handleMediaFinalizeRequest(
      makeRequest({
        assetId: 'asset-1',
        width: 1200,
        height: 900,
        byteSize: 4096,
        contentHash: 'sha256:abc',
      }),
      makeDeps(store),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      assetId: 'asset-1',
      uploadStatus: 'uploaded',
      moderationStatus: 'pending',
      visibility: 'private',
    });
    expect(store.finalized[0]).toMatchObject({
      width: 1200,
      height: 900,
      byteSize: 4096,
      contentHash: 'sha256:abc',
      now: NOW,
    });
  });

  it('persists video duration/width/height within bounds (audit M2)', async () => {
    const store = new FakeFinalizeStore();
    const res = await handleMediaFinalizeRequest(
      makeRequest({
        assetId: 'asset-1',
        durationMs: 42_000,
        width: 1080,
        height: 1920,
        byteSize: 4096,
      }),
      makeDeps(store),
    );

    expect(res.status).toBe(200);
    expect(store.finalized[0]).toMatchObject({
      durationMs: 42_000,
      width: 1080,
      height: 1920,
    });
  });

  it('drops absurd dimensions past the server ceiling to null', async () => {
    const store = new FakeFinalizeStore();
    await handleMediaFinalizeRequest(
      makeRequest({
        assetId: 'asset-1',
        durationMs: 999_999_999_999, // way past the 6h ceiling
        width: 100_000, // past the 8K ceiling
        height: 1920,
      }),
      makeDeps(store),
    );

    expect(store.finalized[0]).toMatchObject({
      durationMs: null,
      width: null,
      height: 1920,
    });
  });

  it('returns not_found when the asset is not owned by the profile', async () => {
    const store = new FakeFinalizeStore();
    store.asset = null;

    const res = await handleMediaFinalizeRequest(
      makeRequest({ assetId: 'asset-1' }),
      makeDeps(store),
    );

    expect(res.status).toBe(404);
  });

  it('requires a BestChef social profile before finalize', async () => {
    const store = new FakeFinalizeStore();
    store.profileId = null;

    const res = await handleMediaFinalizeRequest(
      makeRequest({ assetId: 'asset-1' }),
      makeDeps(store),
    );

    expect(res.status).toBe(403);
  });
});
