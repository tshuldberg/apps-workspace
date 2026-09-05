import { describe, expect, it } from 'vitest';
import {
  handleMediaUploadRequest,
  type MediaUploadAsset,
  type MediaUploadStore,
} from '../index.ts';
import {
  BESTCHEF_MEDIA_BUCKETS,
  validateMediaUploadIntent,
} from '../../_shared/media.ts';
import { VOTE_PROOF_MAX_BYTES as CLIENT_VOTE_PROOF_MAX_BYTES } from '../../../../modules/bestchef/src/cloud/vote-proof';

const FAKE_JWT = (() => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1' }));
  return `${header}.${payload}.sig`;
})();

function makeRequest(body: unknown, opts: { auth?: string | null; method?: string } = {}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const auth = opts.auth === undefined ? `Bearer ${FAKE_JWT}` : opts.auth;
  if (auth) headers.set('Authorization', auth);
  return new Request('http://localhost/functions/bestchef-media-upload', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

class FakeUploadStore implements MediaUploadStore {
  profileId: string | null = 'profile-1';
  quotaAllowed = true;
  quotaCalls: string[] = [];
  signedRequests: Array<{ bucket: string; key: string }> = [];
  createdAssets: Array<{ bucket: string; key: string; ownerKind: string; ownerId: string }> = [];

  async getProfileId(): Promise<string | null> {
    return this.profileId;
  }

  async consumeActionQuota(profileId: string): Promise<{ allowed: boolean; reason: string }> {
    this.quotaCalls.push(profileId);
    return { allowed: this.quotaAllowed, reason: this.quotaAllowed ? 'ok' : 'rate_limited' };
  }

  async createSignedUploadUrl(bucket: string, key: string): Promise<{ signedUrl: string; token: string }> {
    this.signedRequests.push({ bucket, key });
    return { signedUrl: `https://storage.example/upload/${bucket}/${key}`, token: 'signed-token' };
  }

  async createPendingAsset(input: Parameters<MediaUploadStore['createPendingAsset']>[0]): Promise<MediaUploadAsset> {
    this.createdAssets.push({
      bucket: input.bucket,
      key: input.key,
      ownerKind: input.intent.ownerKind,
      ownerId: input.intent.ownerId,
    });
    return {
      id: 'asset-1',
      owner_profile_id: input.profileId,
      owner_kind: input.intent.ownerKind,
      owner_id: input.intent.ownerId,
      media_kind: input.intent.mediaKind,
      storage_bucket: input.bucket,
      storage_key: input.key,
      upload_status: 'pending',
      moderation_status: 'pending',
      visibility: 'private',
    };
  }
}

function makeDeps(store = new FakeUploadStore()) {
  return {
    env: () => undefined,
    randomId: () => 'upload-1',
    store,
  };
}

describe('bestchef-media-upload handler', () => {
  it('rejects unauthenticated upload intents', async () => {
    const res = await handleMediaUploadRequest(
      makeRequest({ ownerKind: 'submission' }, { auth: null }),
      makeDeps(),
    );

    expect(res.status).toBe(401);
  });

  it('rejects local or remote URL payloads', () => {
    expect(validateMediaUploadIntent({
      ownerKind: 'submission',
      ownerId: 'submission-1',
      mediaKind: 'image',
      mimeType: 'image/jpeg',
      byteSize: 100,
      localUri: 'file:///tmp/photo.jpg',
    })).toMatchObject({ ok: false, code: 'invalid_input' });
  });

  it('tags unsupported MIME types with a machine code and params', () => {
    expect(validateMediaUploadIntent({
      ownerKind: 'submission',
      ownerId: 'submission-1',
      mediaKind: 'image',
      mimeType: 'image/tiff',
      byteSize: 1024,
    })).toMatchObject({
      ok: false,
      code: 'unsupported_media_type',
      params: { mimeType: 'image/tiff', mediaKind: 'image' },
    });
  });

  it('creates a signed upload and pending media asset for submission images', async () => {
    const store = new FakeUploadStore();
    const res = await handleMediaUploadRequest(
      makeRequest({
        ownerKind: 'submission',
        ownerId: 'submission-1',
        mediaKind: 'image',
        mimeType: 'image/jpeg',
        byteSize: 1024,
        contentHash: 'sha256:abc',
      }),
      makeDeps(store),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      assetId: 'asset-1',
      bucket: BESTCHEF_MEDIA_BUCKETS.submissionImages,
      token: 'signed-token',
      uploadStatus: 'pending',
      moderationStatus: 'pending',
    });
    expect(store.signedRequests[0]).toMatchObject({
      bucket: BESTCHEF_MEDIA_BUCKETS.submissionImages,
      key: 'user-1/submission/submission-1/upload-1.jpg',
    });
    expect(store.createdAssets[0]).toMatchObject({
      ownerKind: 'submission',
      ownerId: 'submission-1',
    });
  });

  it('routes receipt evidence into the receipt evidence bucket', async () => {
    const result = validateMediaUploadIntent({
      ownerKind: 'product_evidence',
      ownerId: 'evidence-1',
      mediaKind: 'image',
      mimeType: 'image/png',
      byteSize: 2048,
      evidenceKind: 'receipt',
    });

    expect(result).toMatchObject({
      ok: true,
      bucket: BESTCHEF_MEDIA_BUCKETS.receiptEvidence,
    });
  });

  it('keeps the client vote-proof pre-check limit equal to the server limit', () => {
    // The client pre-check (modules/bestchef/src/cloud/vote-proof.ts) and
    // the server cap must never drift: at the limit passes, one byte over
    // is rejected with the same file_too_large contract the client renders.
    expect(
      validateMediaUploadIntent({
        ownerKind: 'vote_proof',
        ownerId: 'submission-1',
        mediaKind: 'image',
        mimeType: 'image/jpeg',
        byteSize: CLIENT_VOTE_PROOF_MAX_BYTES,
        contentHash: 'sha256:x',
      }),
    ).toMatchObject({ ok: true, maxBytes: CLIENT_VOTE_PROOF_MAX_BYTES });
    expect(
      validateMediaUploadIntent({
        ownerKind: 'vote_proof',
        ownerId: 'submission-1',
        mediaKind: 'image',
        mimeType: 'image/jpeg',
        byteSize: CLIENT_VOTE_PROOF_MAX_BYTES + 1,
        contentHash: 'sha256:x',
      }),
    ).toMatchObject({ ok: false, code: 'file_too_large' });
  });

  it('accepts vote proof images with the proof-specific 2 MB limit', () => {
    const result = validateMediaUploadIntent({
      ownerKind: 'vote_proof',
      ownerId: 'submission-1',
      mediaKind: 'image',
      mimeType: 'image/jpeg',
      byteSize: 2 * 1024 * 1024,
      contentHash: 'sha256:proof',
    });

    expect(result).toMatchObject({
      ok: true,
      bucket: BESTCHEF_MEDIA_BUCKETS.voteProofs,
      maxBytes: 2 * 1024 * 1024,
    });

    expect(validateMediaUploadIntent({
      ownerKind: 'vote_proof',
      ownerId: 'submission-1',
      mediaKind: 'image',
      mimeType: 'image/jpeg',
      byteSize: 2 * 1024 * 1024 + 1,
      contentHash: 'sha256:proof',
    })).toMatchObject({
      ok: false,
      code: 'file_too_large',
      params: { maxBytes: 2 * 1024 * 1024, byteSize: 2 * 1024 * 1024 + 1, mediaKind: 'image' },
    });
  });

  it('creates a signed upload for vote proof images without public delivery', async () => {
    const store = new FakeUploadStore();
    const res = await handleMediaUploadRequest(
      makeRequest({
        ownerKind: 'vote_proof',
        ownerId: 'submission-1',
        mediaKind: 'image',
        mimeType: 'image/jpeg',
        byteSize: 1024,
        contentHash: 'sha256:proof',
      }),
      makeDeps(store),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      bucket: BESTCHEF_MEDIA_BUCKETS.voteProofs,
      uploadStatus: 'pending',
      moderationStatus: 'pending',
    });
    expect(store.signedRequests[0]).toMatchObject({
      bucket: BESTCHEF_MEDIA_BUCKETS.voteProofs,
      key: 'user-1/vote_proof/submission-1/upload-1.jpg',
    });
    expect(store.createdAssets[0]).toMatchObject({
      ownerKind: 'vote_proof',
      ownerId: 'submission-1',
    });
  });

  it('rejects oversized video upload intents', async () => {
    const res = await handleMediaUploadRequest(
      makeRequest({
        ownerKind: 'submission',
        ownerId: 'submission-1',
        mediaKind: 'video',
        mimeType: 'video/mp4',
        byteSize: 200 * 1024 * 1024,
      }),
      makeDeps(),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: false,
      error: {
        kind: 'file_too_large',
        params: { maxBytes: 150 * 1024 * 1024, mediaKind: 'video' },
      },
    });
  });

  it('rejects uploads over the durable per-user quota with 429', async () => {
    const store = new FakeUploadStore();
    store.quotaAllowed = false;

    const res = await handleMediaUploadRequest(
      makeRequest({
        ownerKind: 'submission',
        ownerId: 'submission-1',
        mediaKind: 'image',
        mimeType: 'image/jpeg',
        byteSize: 1024,
        contentHash: 'sha256:abc',
      }),
      makeDeps(store),
    );

    expect(res.status).toBe(429);
    expect(store.quotaCalls).toEqual(['profile-1']);
    expect(store.signedRequests).toHaveLength(0);
    expect(store.createdAssets).toHaveLength(0);
  });

  it('requires a BestChef social profile before upload', async () => {
    const store = new FakeUploadStore();
    store.profileId = null;

    const res = await handleMediaUploadRequest(
      makeRequest({
        ownerKind: 'submission',
        ownerId: 'submission-1',
        mediaKind: 'image',
        mimeType: 'image/jpeg',
        byteSize: 1024,
      }),
      makeDeps(store),
    );

    expect(res.status).toBe(403);
  });
});
