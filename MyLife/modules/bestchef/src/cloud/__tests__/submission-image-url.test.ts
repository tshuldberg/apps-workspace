import { describe, it, expect } from 'vitest';
import {
  SUBMISSION_IMAGE_BUCKET,
  submissionImageStoragePath,
  resolveSubmissionImageUrl,
  resolveSubmissionImageUrls,
} from '../submission-image-url';

// ── Fake signing client ────────────────────────────────────────────────

class FakeSignClient {
  signCalls: Array<{ path: string; expiresIn: number }> = [];
  batchCalls: Array<{ paths: string[]; expiresIn: number }> = [];

  constructor(private readonly opts: { fail?: boolean } = {}) {}

  storage = {
    from: (_bucket: string) => ({
      createSignedUrl: async (path: string, expiresIn: number) => {
        this.signCalls.push({ path, expiresIn });
        if (this.opts.fail) return { data: null, error: { message: 'boom' } };
        return { data: { signedUrl: `https://signed.example.com/${path}?token=abc` }, error: null };
      },
      createSignedUrls: async (paths: string[], expiresIn: number) => {
        this.batchCalls.push({ paths, expiresIn });
        if (this.opts.fail) return { data: null, error: { message: 'boom' } };
        return {
          data: paths.map((path) => ({
            path,
            signedUrl: `https://signed.example.com/${path}?token=abc`,
            error: null,
          })),
          error: null,
        };
      },
    }),
  };
}

describe('submissionImageStoragePath', () => {
  it('parses the key out of a Supabase public URL', () => {
    const url = `https://ref.supabase.co/storage/v1/object/public/${SUBMISSION_IMAGE_BUCKET}/user-1/photo.jpg`;
    expect(submissionImageStoragePath(url)).toBe('user-1/photo.jpg');
  });

  it('parses the key out of a signed URL (ignoring the token query)', () => {
    const url = `https://ref.supabase.co/storage/v1/object/sign/${SUBMISSION_IMAGE_BUCKET}/user-1/photo.jpg?token=xyz`;
    expect(submissionImageStoragePath(url)).toBe('user-1/photo.jpg');
  });

  it('accepts a bare storage key', () => {
    expect(submissionImageStoragePath('user-1/photo.jpg')).toBe('user-1/photo.jpg');
  });

  it('url-decodes percent-encoded key segments', () => {
    const url = `https://ref.supabase.co/storage/v1/object/public/${SUBMISSION_IMAGE_BUCKET}/user%201/my%20photo.jpg`;
    expect(submissionImageStoragePath(url)).toBe('user 1/my photo.jpg');
  });

  it('returns null for a URL that does not reference the bucket', () => {
    expect(submissionImageStoragePath('https://cdn.example.com/other-bucket/x.jpg')).toBeNull();
  });

  it('returns null for empty / nullish input', () => {
    expect(submissionImageStoragePath(null)).toBeNull();
    expect(submissionImageStoragePath('')).toBeNull();
    expect(submissionImageStoragePath('   ')).toBeNull();
  });
});

describe('resolveSubmissionImageUrl', () => {
  it('signs an approved image', async () => {
    const client = new FakeSignClient();
    const url = await resolveSubmissionImageUrl('user-1/photo.jpg', { approved: true }, client);
    expect(url).toBe('https://signed.example.com/user-1/photo.jpg?token=abc');
    expect(client.signCalls).toHaveLength(1);
  });

  it('returns null (and never signs) for unapproved content', async () => {
    const client = new FakeSignClient();
    const url = await resolveSubmissionImageUrl('user-1/photo.jpg', { approved: false }, client);
    expect(url).toBeNull();
    expect(client.signCalls).toHaveLength(0);
  });

  it('returns null when signing fails', async () => {
    const client = new FakeSignClient({ fail: true });
    const url = await resolveSubmissionImageUrl('user-1/photo.jpg', { approved: true }, client);
    expect(url).toBeNull();
  });
});

describe('resolveSubmissionImageUrls', () => {
  it('signs only approved refs and nulls the rest', async () => {
    const client = new FakeSignClient();
    const result = await resolveSubmissionImageUrls(
      [
        { id: 'a', storedValue: 'user-1/a.jpg', approved: true },
        { id: 'b', storedValue: 'user-2/b.jpg', approved: false },
        { id: 'c', storedValue: null, approved: true },
      ],
      client,
    );
    expect(result.get('a')).toBe('https://signed.example.com/user-1/a.jpg?token=abc');
    expect(result.get('b')).toBeNull();
    expect(result.get('c')).toBeNull();
    // Only the one approved, path-bearing ref is signed.
    expect(client.batchCalls[0]?.paths).toEqual(['user-1/a.jpg']);
  });

  it('makes no signing call when nothing is approved', async () => {
    const client = new FakeSignClient();
    const result = await resolveSubmissionImageUrls(
      [{ id: 'a', storedValue: 'user-1/a.jpg', approved: false }],
      client,
    );
    expect(result.get('a')).toBeNull();
    expect(client.batchCalls).toHaveLength(0);
  });
});
