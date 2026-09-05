import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { attachPlaybackUrl, type PromotableAssetRow } from '../media-promotion';

function asset(overrides: Partial<PromotableAssetRow> = {}): PromotableAssetRow {
  return {
    id: 'asset-1',
    owner_id: 'sub-1',
    owner_kind: 'submission',
    media_kind: 'video',
    moderation_status: 'approved',
    remote_url: null,
    storage_bucket: 'bestchef-submission-videos',
    storage_key: 'u1/v.mp4',
    metadata: {},
    ...overrides,
  };
}

function fakeAdmin(options: {
  signedUrl?: string | null;
  updatedRows?: number;
} = {}) {
  const updates: Record<string, unknown>[] = [];
  const admin = {
    storage: {
      from: () => ({
        createSignedUrl: async () =>
          options.signedUrl === null
            ? { data: null, error: { message: 'sign boom' } }
            : { data: { signedUrl: options.signedUrl ?? 'https://cdn.example.com/signed' }, error: null },
      }),
    },
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        const chain = {
          eq: () => chain,
          select: async () => ({
            data: Array.from({ length: options.updatedRows ?? 1 }, () => ({ id: 'asset-1' })),
            error: null,
          }),
        };
        return chain;
      },
    }),
  } as unknown as SupabaseClient;
  return { admin, updates };
}

describe('media promotion helper', () => {
  it('signs and patches an approved video without attribution', async () => {
    const { admin, updates } = fakeAdmin();
    await expect(attachPlaybackUrl(admin, asset())).resolves.toBe('ok');
    expect(updates).toHaveLength(1);
    expect(updates[0].remote_url).toBe('https://cdn.example.com/signed');
    expect(typeof updates[0].playback_url_expires_at).toBe('string');
    const metadata = updates[0].metadata as Record<string, unknown>;
    expect(metadata.promotion_delivery).toBe('signed_url_v1');
    // Approved rows are world-readable: staff identity must never appear.
    expect(JSON.stringify(updates[0])).not.toContain('@');
  });

  it('reports a purged object instead of signing a dead pointer', async () => {
    const { admin } = fakeAdmin();
    await expect(
      attachPlaybackUrl(admin, asset({ storage_bucket: null, storage_key: null })),
    ).resolves.toBe('asset_purged');
  });

  it('rejects non-video assets', async () => {
    const { admin } = fakeAdmin();
    await expect(attachPlaybackUrl(admin, asset({ media_kind: 'image' }))).resolves.toBe(
      'not_submission_video',
    );
  });

  it('propagates signing failures', async () => {
    const { admin } = fakeAdmin({ signedUrl: null });
    await expect(attachPlaybackUrl(admin, asset())).resolves.toBe('signing_failed');
  });

  it('reports a lost guarded update (concurrent decision)', async () => {
    const { admin } = fakeAdmin({ updatedRows: 0 });
    await expect(attachPlaybackUrl(admin, asset())).resolves.toBe('update_failed');
  });
});
