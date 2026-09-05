import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlaybackSource, isExpired } from '../cloud-playback';

type InvokeResult = { data: unknown; error: unknown };

function makeSupabase(handler: (name: string, opts: { body: unknown }) => InvokeResult) {
  const invoke = vi.fn(async (name: string, opts: { body: unknown }) => handler(name, opts));
  return { supabase: { functions: { invoke } } as unknown as SupabaseClient, invoke };
}

const HAPPY = {
  url: 'https://cdn.example.com/signed/abc.mp4',
  expiresAt: '2026-07-03T12:00:00Z',
  kind: 'trainer_video',
  title: 'Barbell Bench Press',
  durationSeconds: 42,
};

describe('cloud-playback: getPlaybackSource', () => {
  it('maps a happy trainer-video response', async () => {
    const { supabase, invoke } = makeSupabase(() => ({ data: HAPPY, error: null }));
    const result = await getPlaybackSource(supabase, { videoId: 'v1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe(HAPPY.url);
      expect(result.kind).toBe('trainer_video');
      expect(result.title).toBe('Barbell Bench Press');
      expect(result.durationSeconds).toBe(42);
    }
    expect(invoke).toHaveBeenCalledWith('dowork-playback-url', { body: { videoId: 'v1' } });
  });

  it('sends the form-check body including feedbackId', async () => {
    const { supabase, invoke } = makeSupabase(() => ({
      data: { ...HAPPY, kind: 'form_check' },
      error: null,
    }));
    const result = await getPlaybackSource(supabase, { formCheckId: 'f1', feedbackId: 'fb1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe('form_check');
    expect(invoke).toHaveBeenCalledWith('dowork-playback-url', {
      body: { formCheckId: 'f1', feedbackId: 'fb1' },
    });
  });

  it('infers form_check kind when the server omits it', async () => {
    const { supabase } = makeSupabase(() => ({
      data: { url: HAPPY.url, expiresAt: HAPPY.expiresAt },
      error: null,
    }));
    const result = await getPlaybackSource(supabase, { formCheckId: 'f1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('form_check');
      expect(result.title).toBeNull();
      expect(result.durationSeconds).toBeNull();
    }
  });

  it('returns the transport error', async () => {
    const { supabase } = makeSupabase(() => ({ data: null, error: { message: 'boom' } }));
    const result = await getPlaybackSource(supabase, { videoId: 'v1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('boom');
  });

  it('surfaces an ok:false payload', async () => {
    const { supabase } = makeSupabase(() => ({
      data: { ok: false, error: 'not entitled' },
      error: null,
    }));
    const result = await getPlaybackSource(supabase, { videoId: 'v1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not entitled');
  });

  it('rejects a response missing the url', async () => {
    const { supabase } = makeSupabase(() => ({ data: { expiresAt: HAPPY.expiresAt }, error: null }));
    const result = await getPlaybackSource(supabase, { videoId: 'v1' });
    expect(result.ok).toBe(false);
  });

  it('maps a thrown invoke to an error result', async () => {
    const supabase = {
      functions: {
        invoke: vi.fn(async () => {
          throw new Error('network down');
        }),
      },
    } as unknown as SupabaseClient;
    const result = await getPlaybackSource(supabase, { videoId: 'v1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('network down');
  });
});

describe('cloud-playback: isExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is false well before expiry', () => {
    expect(isExpired('2026-07-03T12:30:00Z')).toBe(false);
  });

  it('is true inside the skew window', () => {
    // 30 s ahead, default skew is 60 s
    expect(isExpired('2026-07-03T12:00:30Z')).toBe(true);
  });

  it('is true once past expiry', () => {
    expect(isExpired('2026-07-03T11:59:00Z')).toBe(true);
  });

  it('treats an unparseable timestamp as expired', () => {
    expect(isExpired('not-a-date')).toBe(true);
  });

  it('respects a custom skew', () => {
    expect(isExpired('2026-07-03T12:00:30Z', 10_000)).toBe(false);
  });
});
