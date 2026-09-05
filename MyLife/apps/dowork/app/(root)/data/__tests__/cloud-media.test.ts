// DoWork cloud-media contract tests.
//
// expo-file-system/legacy is mocked so the sign -> upload -> finalize
// orchestration can be exercised without a native runtime. The mutable
// `uploadState` lets a test force a failed storage PUT.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const uploadState = vi.hoisted(() => ({ status: 200 }));

vi.mock('expo-file-system/legacy', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 'BINARY_CONTENT' },
  createUploadTask: (
    _url: string,
    _uri: string,
    _opts: unknown,
    onProgress?: (p: { totalBytesSent: number; totalBytesExpectedToSend: number }) => void,
  ) => ({
    uploadAsync: async () => {
      onProgress?.({ totalBytesSent: 100, totalBytesExpectedToSend: 100 });
      return { status: uploadState.status };
    },
  }),
}));

import {
  finalizeImageUpload,
  finalizeTrainerVideo,
  signUpload,
  uploadTrainerImage,
  uploadTrainerVideoToCloud,
} from '../cloud-media';

type InvokeCall = { body: Record<string, unknown> };

function makeSupabase(handler: (body: Record<string, unknown>) => { data: unknown; error: unknown }) {
  const calls: InvokeCall[] = [];
  const invoke = vi.fn(async (_name: string, opts: { body: Record<string, unknown> }) => {
    calls.push({ body: opts.body });
    return handler(opts.body);
  });
  return { supabase: { functions: { invoke } } as unknown as SupabaseClient, calls, invoke };
}

const RAW_VIDEO = {
  id: 'v1',
  trainer_id: 't1',
  exercise_slug: 'bench',
  storage_path: 'u1/videos/v1.mp4',
  thumbnail_url: 'https://pub/thumb.jpg',
  duration_seconds: 42,
  angle: 'front',
  is_primary: false,
  is_hidden: false,
  sort_order: 0,
  title: 'Bench setup',
  description: 'brace first',
  is_premium: true,
  view_count: 0,
  published_at: '2026-07-03T00:00:00Z',
  created_at: '2026-07-03T00:00:00Z',
  updated_at: '2026-07-03T00:00:00Z',
};

function routed(body: Record<string, unknown>): { data: unknown; error: unknown } {
  if (body.action === 'sign') {
    return {
      data: { ok: true, bucket: 'b', key: `${body.kind}-key.bin`, uploadUrl: 'https://up', token: null, maxBytes: 100 },
      error: null,
    };
  }
  if (body.action === 'finalize' && body.kind === 'trainer_video') {
    return { data: { ok: true, video: RAW_VIDEO }, error: null };
  }
  // image finalize
  return { data: { ok: true, key: body.key, publicUrl: `https://pub/${String(body.key)}` }, error: null };
}

beforeEach(() => {
  uploadState.status = 200;
});

describe('signUpload', () => {
  it('maps a signed response', async () => {
    const { supabase } = makeSupabase(routed);
    const result = await signUpload(supabase, { kind: 'trainer_video', contentType: 'video/mp4', contentLength: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.signed.uploadUrl).toBe('https://up');
  });

  it('rejects an invalid sign response', async () => {
    const { supabase } = makeSupabase(() => ({ data: { ok: true }, error: null }));
    const result = await signUpload(supabase, { kind: 'avatar', contentType: 'image/jpeg', contentLength: 10 });
    expect(result.ok).toBe(false);
  });

  it('surfaces an ok:false payload', async () => {
    const { supabase } = makeSupabase(() => ({ data: { ok: false, error: { message: 'too large' } }, error: null }));
    const result = await signUpload(supabase, { kind: 'trainer_video', contentType: 'video/mp4', contentLength: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('too large');
  });
});

describe('finalizeTrainerVideo', () => {
  it('forwards title/description/isPremium and hydrates the row', async () => {
    const { supabase, calls } = makeSupabase(routed);
    const result = await finalizeTrainerVideo(supabase, {
      key: 'u1/videos/v1.mp4',
      exerciseSlug: 'bench',
      title: 'Bench setup',
      description: 'brace first',
      isPremium: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.video.isPremium).toBe(true);
    expect(calls[0]?.body).toMatchObject({ title: 'Bench setup', isPremium: true, kind: 'trainer_video' });
  });

  it('rejects an invalid finalize response', async () => {
    const { supabase } = makeSupabase(() => ({ data: { ok: true }, error: null }));
    const result = await finalizeTrainerVideo(supabase, { key: 'k', exerciseSlug: 'bench' });
    expect(result.ok).toBe(false);
  });
});

describe('finalizeImageUpload', () => {
  it('returns the public URL', async () => {
    const { supabase } = makeSupabase(routed);
    const result = await finalizeImageUpload(supabase, { kind: 'trainer_thumbnail', key: 'u1/t.jpg' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.publicUrl).toBe('https://pub/u1/t.jpg');
  });

  it('fails when no public URL comes back', async () => {
    const { supabase } = makeSupabase(() => ({ data: { ok: true, key: 'k' }, error: null }));
    const result = await finalizeImageUpload(supabase, { kind: 'trainer_thumbnail', key: 'k' });
    expect(result.ok).toBe(false);
  });
});

describe('uploadTrainerImage', () => {
  it('signs, uploads, and finalizes', async () => {
    const { supabase } = makeSupabase(routed);
    const result = await uploadTrainerImage(supabase, {
      kind: 'trainer_thumbnail',
      fileUri: 'file://hero.jpg',
      contentType: 'image/jpeg',
      contentLength: 500,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.publicUrl).toContain('https://pub/');
  });

  it('stops on a sign failure', async () => {
    const { supabase } = makeSupabase(() => ({ data: null, error: { message: 'nope' } }));
    const result = await uploadTrainerImage(supabase, {
      kind: 'trainer_thumbnail',
      fileUri: 'file://hero.jpg',
      contentType: 'image/jpeg',
      contentLength: 500,
    });
    expect(result.ok).toBe(false);
  });

  it('stops on an upload failure', async () => {
    uploadState.status = 500;
    const { supabase } = makeSupabase(routed);
    const result = await uploadTrainerImage(supabase, {
      kind: 'trainer_thumbnail',
      fileUri: 'file://hero.jpg',
      contentType: 'image/jpeg',
      contentLength: 500,
    });
    expect(result.ok).toBe(false);
  });
});

describe('uploadTrainerVideoToCloud', () => {
  it('signs -> uploads -> finalizes without a thumbnail', async () => {
    const { supabase, calls } = makeSupabase(routed);
    const result = await uploadTrainerVideoToCloud(supabase, {
      fileUri: 'file://v.mp4',
      contentType: 'video/mp4',
      contentLength: 1000,
      exerciseSlug: 'bench',
      title: 'Bench setup',
      isPremium: true,
    });
    expect(result.ok).toBe(true);
    const finalize = calls.find((c) => c.body.action === 'finalize');
    expect(finalize?.body).toMatchObject({ title: 'Bench setup', isPremium: true });
    expect(finalize?.body.thumbnailKey).toBeUndefined();
  });

  it('uploads a thumbnail first and passes its key to finalize', async () => {
    const { supabase, calls } = makeSupabase(routed);
    const result = await uploadTrainerVideoToCloud(supabase, {
      fileUri: 'file://v.mp4',
      contentType: 'video/mp4',
      contentLength: 1000,
      exerciseSlug: 'bench',
      thumbnailUri: 'file://thumb.jpg',
      thumbnailContentLength: 200,
    });
    expect(result.ok).toBe(true);
    const finalize = calls.find((c) => c.body.action === 'finalize' && c.body.kind === 'trainer_video');
    expect(finalize?.body.thumbnailKey).toBe('trainer_thumbnail-key.bin');
  });

  it('still uploads the video when the thumbnail finalize fails', async () => {
    // trainer_thumbnail finalize returns no publicUrl -> thumbnail is dropped.
    const { supabase, calls } = makeSupabase((body) => {
      if (body.action === 'finalize' && body.kind === 'trainer_thumbnail') {
        return { data: { ok: true, key: body.key }, error: null };
      }
      return routed(body);
    });
    const result = await uploadTrainerVideoToCloud(supabase, {
      fileUri: 'file://v.mp4',
      contentType: 'video/mp4',
      contentLength: 1000,
      exerciseSlug: 'bench',
      thumbnailUri: 'file://thumb.jpg',
    });
    expect(result.ok).toBe(true);
    const finalize = calls.find((c) => c.body.action === 'finalize' && c.body.kind === 'trainer_video');
    expect(finalize?.body.thumbnailKey).toBeUndefined();
  });

  it('stops on a video sign failure', async () => {
    const { supabase } = makeSupabase((body) =>
      body.action === 'sign' ? { data: null, error: { message: 'nope' } } : routed(body),
    );
    const result = await uploadTrainerVideoToCloud(supabase, {
      fileUri: 'file://v.mp4',
      contentType: 'video/mp4',
      contentLength: 1000,
      exerciseSlug: 'bench',
    });
    expect(result.ok).toBe(false);
  });

  it('stops on a video upload failure', async () => {
    uploadState.status = 500;
    const { supabase } = makeSupabase(routed);
    const result = await uploadTrainerVideoToCloud(supabase, {
      fileUri: 'file://v.mp4',
      contentType: 'video/mp4',
      contentLength: 1000,
      exerciseSlug: 'bench',
    });
    expect(result.ok).toBe(false);
  });
});
