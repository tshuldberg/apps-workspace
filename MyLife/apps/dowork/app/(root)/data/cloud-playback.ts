// DoWork signed-playback client.
//
// Client half of the dowork-playback-url edge function: given a trainer video
// id or a form-check id, the server re-checks entitlement (free / owner /
// active subscription / active client link; form checks: participants only),
// mints a short-lived signed Storage URL, and returns it with metadata. The
// device never reads a raw storage path, and every play re-verifies server-side
// so a revoked entitlement cannot be replayed from a cached URL.

import type { SupabaseClient } from '@supabase/supabase-js';

const PLAYBACK_FUNCTION = 'dowork-playback-url';

export type PlaybackKind = 'trainer_video' | 'form_check';

export type PlaybackParams =
  | { videoId: string }
  | { formCheckId: string; feedbackId?: string };

export interface PlaybackSource {
  url: string;
  expiresAt: string;
  kind: PlaybackKind;
  title: string | null;
  durationSeconds: number | null;
}

export type PlaybackResult = ({ ok: true } & PlaybackSource) | { ok: false; error: string };

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

function extractError(record: Record<string, unknown>): string {
  const err = record.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Playback service error.';
}

export async function getPlaybackSource(
  supabase: SupabaseClient,
  params: PlaybackParams,
): Promise<PlaybackResult> {
  try {
    const { data, error } = await supabase.functions.invoke(PLAYBACK_FUNCTION, { body: params });
    if (error) return { ok: false, error: errMessage(error) };

    const record = (data ?? {}) as Record<string, unknown>;
    if (record.ok === false) return { ok: false, error: extractError(record) };

    if (typeof record.url !== 'string' || typeof record.expiresAt !== 'string') {
      return { ok: false, error: 'Playback service returned an invalid response.' };
    }

    const inferredKind: PlaybackKind = 'formCheckId' in params ? 'form_check' : 'trainer_video';
    const kind: PlaybackKind =
      record.kind === 'form_check' || record.kind === 'trainer_video' ? record.kind : inferredKind;

    return {
      ok: true,
      url: record.url,
      expiresAt: record.expiresAt,
      kind,
      title: typeof record.title === 'string' ? record.title : null,
      durationSeconds:
        typeof record.durationSeconds === 'number' && Number.isFinite(record.durationSeconds)
          ? record.durationSeconds
          : null,
    };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// True when a signed URL is at or past expiry, minus a skew so playback swaps
// the source before the CDN actually rejects it. Unparseable timestamps are
// treated as expired so a bad value forces a refresh rather than a dead player.
export function isExpired(expiresAt: string, skewMs = 60_000): boolean {
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return true;
  return Date.now() >= at - skewMs;
}
