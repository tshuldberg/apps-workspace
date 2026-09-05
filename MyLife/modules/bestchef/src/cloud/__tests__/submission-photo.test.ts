import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { finalizeSubmissionMedia, uploadSubmissionPhoto } from '../submission-photo';

// ── Test doubles ──────────────────────────────────────────────────────

class FakeFunctionClient {
  invocations: Array<{ fn: string; body: Record<string, unknown> }> = [];

  constructor(private readonly responses: Record<string, Record<string, unknown> | { error: { message: string } }>) {}

  functions = {
    invoke: async <T,>(fn: string, options: { body: Record<string, unknown> }) => {
      this.invocations.push({ fn, body: options.body });
      const response = this.responses[fn];
      if (response && 'error' in response) {
        return { data: null as T | null, error: response.error };
      }
      return { data: (response ?? null) as T | null, error: null };
    },
  };

  storageUploads: Array<{ bucket: string; key: string; token: string; contentType?: string }> = [];
  publicUrlCalls: Array<{ bucket: string; path: string }> = [];
  publicUrlForKey = (key: string) =>
    `https://cdn.example.com/bestchef-submission-images/${key}`;
  uploadToSignedUrlError: { message?: string; statusCode?: string | number } | null = null;

  storage = {
    from: (bucket: string) => ({
      uploadToSignedUrl: async (
        path: string,
        token: string,
        _body: ArrayBuffer | Blob | Uint8Array,
        options?: { contentType?: string },
      ) => {
        this.storageUploads.push({ bucket, key: path, token, contentType: options?.contentType });
        return { error: this.uploadToSignedUrlError };
      },
      getPublicUrl: (path: string) => {
        this.publicUrlCalls.push({ bucket, path });
        return { data: { publicUrl: this.publicUrlForKey(path) } };
      },
    }),
  };
}

beforeEach(() => {
  // Stub global fetch so the helper can read the local URI as a Blob.
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      // PUT path used when token is missing. Tests using token will not hit this.
      return new Response(null, { status: 200 });
    }
    if (typeof url === 'string' && url.startsWith('file://')) {
      return new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
    }
    return new Response(null, { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────

describe('uploadSubmissionPhoto', () => {
  it('runs upload-intent → signed PUT → finalize and resolves a public https URL', async () => {
    const client = new FakeFunctionClient({
      'bestchef-media-upload': {
        ok: true,
        assetId: 'asset-1',
        bucket: 'bestchef-submission-images',
        key: 'user-1/submission/sub-1/asset-1.jpg',
        signedUploadUrl: 'https://example.supabase.co/storage/v1/upload/signed-url',
        token: 'signed-token',
        maxBytes: 12 * 1024 * 1024,
        uploadStatus: 'pending',
        moderationStatus: 'pending',
      },
      'bestchef-media-finalize': {
        ok: true,
        assetId: 'asset-1',
        uploadStatus: 'uploaded',
        moderationStatus: 'pending',
        visibility: 'public',
      },
    });

    const result = await uploadSubmissionPhoto(
      {
        ownerId: 'sub-1',
        localUri: 'file:///var/mobile/photo.jpg',
        byteSize: 3,
        contentHash: 'abc123',
      },
      client as never,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.publicUrl).toBe(
      'https://cdn.example.com/bestchef-submission-images/user-1/submission/sub-1/asset-1.jpg',
    );
    expect(result.data.assetId).toBe('asset-1');
    expect(result.data.bucket).toBe('bestchef-submission-images');

    // 3-step sequence: upload-intent, finalize. PUT bypassed via uploadToSignedUrl.
    expect(client.invocations.map((i) => i.fn)).toEqual([
      'bestchef-media-upload',
      'bestchef-media-finalize',
    ]);
    expect(client.invocations[0]?.body).toMatchObject({
      ownerKind: 'submission',
      ownerId: 'sub-1',
      mediaKind: 'image',
      mimeType: 'image/jpeg',
      byteSize: 3,
      contentHash: 'abc123',
    });
    expect(client.invocations[1]?.body).toMatchObject({
      assetId: 'asset-1',
      byteSize: 3,
      contentHash: 'abc123',
    });

    // The bytes must have been uploaded to the bucket/key from the intent.
    expect(client.storageUploads).toHaveLength(1);
    expect(client.storageUploads[0]).toMatchObject({
      bucket: 'bestchef-submission-images',
      key: 'user-1/submission/sub-1/asset-1.jpg',
      token: 'signed-token',
      contentType: 'image/jpeg',
    });

    // getPublicUrl called for the final lookup.
    expect(client.publicUrlCalls).toContainEqual({
      bucket: 'bestchef-submission-images',
      path: 'user-1/submission/sub-1/asset-1.jpg',
    });
  });

  it('returns an error when input validation fails', async () => {
    const client = new FakeFunctionClient({});
    const result = await uploadSubmissionPhoto(
      {
        ownerId: '',
        localUri: 'file:///photo.jpg',
        byteSize: 0,
        contentHash: '',
      },
      client as never,
    );

    expect(result.ok).toBe(false);
    expect(client.invocations).toHaveLength(0);
  });

  it('surfaces upload-intent errors before reading bytes', async () => {
    const client = new FakeFunctionClient({
      'bestchef-media-upload': { error: { message: 'denied' } },
    });

    const result = await uploadSubmissionPhoto(
      {
        ownerId: 'sub-1',
        localUri: 'file:///photo.jpg',
        byteSize: 3,
        contentHash: 'abc',
      },
      client as never,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // No parsable machine envelope on the fake error: falls to 'unknown'.
      expect(result.code).toBe('unknown');
      expect(result.retryable).toBe(true);
    }
    expect(client.storageUploads).toHaveLength(0);
  });

  it('maps machine error envelopes from the upload intent to typed codes', async () => {
    const client = new FakeFunctionClient({
      'bestchef-media-upload': {
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 400,
            json: async () => ({
              ok: false,
              error: {
                kind: 'file_too_large',
                message: 'Media exceeds the 12582912 byte upload limit.',
                params: { maxBytes: 12 * 1024 * 1024, byteSize: 20 * 1024 * 1024, mediaKind: 'image' },
              },
            }),
          },
        },
      },
    });

    const result = await uploadSubmissionPhoto(
      {
        ownerId: 'sub-1',
        localUri: 'file:///photo.jpg',
        byteSize: 20 * 1024 * 1024,
        contentHash: 'abc',
      },
      client as never,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('file_too_large');
      expect(result.retryable).toBe(false);
      expect(result.params).toEqual({ maxMb: 12 });
    }
  });

  it('maps a 413 storage-client PUT rejection to file_too_large (permanent, not retryable)', async () => {
    const client = new FakeFunctionClient({
      'bestchef-media-upload': {
        ok: true,
        assetId: 'asset-1',
        bucket: 'bestchef-submission-images',
        key: 'user-1/submission/sub-1/asset-1.jpg',
        signedUploadUrl: 'https://example.supabase.co/storage/v1/upload/signed-url',
        token: 'signed-token',
        maxBytes: 12 * 1024 * 1024,
        uploadStatus: 'pending',
        moderationStatus: 'pending',
      },
    });
    client.uploadToSignedUrlError = { message: 'Payload too large', statusCode: '413' };

    const result = await uploadSubmissionPhoto(
      {
        ownerId: 'sub-1',
        localUri: 'file:///photo.jpg',
        byteSize: 3,
        contentHash: 'abc',
      },
      client as never,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('file_too_large');
      expect(result.retryable).toBe(false);
    }
  });

  it('refuses to return a non-https public URL', async () => {
    const client = new FakeFunctionClient({
      'bestchef-media-upload': {
        ok: true,
        assetId: 'asset-1',
        bucket: 'bestchef-submission-images',
        key: 'user-1/submission/sub-1/asset-1.jpg',
        signedUploadUrl: 'https://example.supabase.co/storage/v1/upload/signed-url',
        token: 'signed-token',
        maxBytes: 12 * 1024 * 1024,
        uploadStatus: 'pending',
        moderationStatus: 'pending',
      },
      'bestchef-media-finalize': {
        ok: true,
        assetId: 'asset-1',
        uploadStatus: 'uploaded',
        moderationStatus: 'pending',
        visibility: 'public',
      },
    });
    client.publicUrlForKey = () => 'http://insecure.example.com/photo.jpg';

    const result = await uploadSubmissionPhoto(
      {
        ownerId: 'sub-1',
        localUri: 'file:///photo.jpg',
        byteSize: 3,
        contentHash: 'abc',
      },
      client as never,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('unknown');
    }
  });
});

describe('finalizeSubmissionMedia video dimensions (audit M2)', () => {
  const intent = {
    assetId: 'asset-1',
    bucket: 'bestchef-submission-images',
    key: 'user-1/submission/sub-1/asset-1.mp4',
    signedUploadUrl: 'https://example.supabase.co/upload',
    token: 'signed-token',
  };

  it('sends durationMs/width/height to the finalize function', async () => {
    const client = new FakeFunctionClient({
      'bestchef-media-finalize': {
        ok: true,
        assetId: 'asset-1',
        uploadStatus: 'uploaded',
        moderationStatus: 'pending',
        visibility: 'private',
      },
    });
    client.publicUrlForKey = (key: string) => `https://cdn.example.com/${key}`;

    const result = await finalizeSubmissionMedia(
      { intent, byteSize: 100, contentHash: null, durationMs: 42_000, width: 1080, height: 1920 },
      client as never,
    );

    expect(result.ok).toBe(true);
    expect(client.invocations[0]?.body).toMatchObject({
      assetId: 'asset-1',
      durationMs: 42_000,
      width: 1080,
      height: 1920,
      byteSize: 100,
    });
  });

  it('defaults dimensions to null when omitted', async () => {
    const client = new FakeFunctionClient({
      'bestchef-media-finalize': {
        ok: true,
        assetId: 'asset-1',
        uploadStatus: 'uploaded',
        moderationStatus: 'pending',
        visibility: 'private',
      },
    });
    client.publicUrlForKey = (key: string) => `https://cdn.example.com/${key}`;

    await finalizeSubmissionMedia({ intent, byteSize: 100, contentHash: null }, client as never);

    expect(client.invocations[0]?.body).toMatchObject({
      durationMs: null,
      width: null,
      height: null,
    });
  });
});
