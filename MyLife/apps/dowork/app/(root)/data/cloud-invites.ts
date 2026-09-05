// DoWork trainer-invite redemption client.
//
// Client half of the dowork-redeem-invite edge function, the ONLY path that
// creates a dw_trainers row. The user posts a 12-char invite code; on success
// the server returns the freshly minted trainer row. Error codes come back as
// HTTP status codes (supabase-js surfaces those as a FunctionsHttpError whose
// `context` is the raw Response), so this client reads the response body to map
// the machine code to an honest message.
//
// Contract (supabase/functions/dowork-redeem-invite/index.ts):
//   POST { code, displayName? } with user JWT
//     200 { trainer }
//     400/404 { error: 'invalid_code' }
//     409 { error: 'already_claimed' | 'expired' | 'already_trainer' }
//     401 { error: 'unauthorized' }
//     500/503 { error: 'server_error' | 'config_error' }

import type { SupabaseClient } from '@supabase/supabase-js';

const REDEEM_FUNCTION = 'dowork-redeem-invite';

export type RedeemInviteErrorCode =
  | 'invalid_code'
  | 'already_claimed'
  | 'expired'
  | 'already_trainer'
  | 'unauthorized'
  | 'server_error'
  | 'unknown';

export interface RedeemedTrainer {
  id: string;
  userId: string;
  displayName: string;
  handle: string | null;
  headline: string | null;
  specialties: string[];
  isVerified: boolean;
  isActive: boolean;
  priceTier: number;
  subscriberCount: number;
  createdAt: string;
}

export type RedeemInviteResult =
  | { ok: true; trainer: RedeemedTrainer }
  | { ok: false; error: string; code: RedeemInviteErrorCode };

interface RawRedeemedTrainer {
  id: string;
  user_id: string;
  display_name: string;
  handle: string | null;
  headline: string | null;
  specialties: string[] | null;
  is_verified: boolean;
  is_active: boolean;
  price_tier: number | null;
  subscriber_count: number | null;
  created_at: string;
}

const MESSAGES: Record<RedeemInviteErrorCode, string> = {
  invalid_code: "That invite code isn't valid. Check it and try again.",
  already_claimed: 'This invite has already been used.',
  expired: 'This invite has expired. Ask your DoWork contact for a new code.',
  already_trainer: 'You already have a trainer profile.',
  unauthorized: 'You need to be signed in before redeeming an invite.',
  server_error: 'Could not redeem the invite right now. Please try again.',
  unknown: 'Could not redeem the invite right now. Please try again.',
};

function normalizeCode(raw: string): RedeemInviteErrorCode {
  switch (raw) {
    case 'invalid_code':
    case 'already_claimed':
    case 'expired':
    case 'already_trainer':
    case 'unauthorized':
      return raw;
    case 'server_error':
    case 'config_error':
      return 'server_error';
    default:
      return 'unknown';
  }
}

function toTrainer(raw: RawRedeemedTrainer): RedeemedTrainer {
  return {
    id: raw.id,
    userId: raw.user_id,
    displayName: raw.display_name,
    handle: raw.handle ?? null,
    headline: raw.headline ?? null,
    specialties: Array.isArray(raw.specialties) ? raw.specialties : [],
    isVerified: raw.is_verified,
    isActive: raw.is_active,
    priceTier: typeof raw.price_tier === 'number' ? raw.price_tier : 1,
    subscriberCount: typeof raw.subscriber_count === 'number' ? raw.subscriber_count : 0,
    createdAt: raw.created_at,
  };
}

// Pulls the machine error code out of a FunctionsHttpError. supabase-js hangs
// the raw Response off `error.context`; the body is `{ error: '<code>' }`.
async function extractErrorCode(error: unknown): Promise<RedeemInviteErrorCode> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as { json?: unknown }).json === 'function') {
    try {
      const body = (await (context as { json: () => Promise<unknown> }).json()) as {
        error?: unknown;
      } | null;
      if (body && typeof body.error === 'string') {
        return normalizeCode(body.error);
      }
    } catch {
      // Non-JSON or already-consumed body; fall through to message parsing.
    }
  }
  // Fallback: some transports surface the code in the message.
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : String(error ?? '');
  for (const code of ['already_claimed', 'expired', 'already_trainer', 'invalid_code', 'unauthorized'] as const) {
    if (message.includes(code)) return code;
  }
  return 'unknown';
}

export async function redeemTrainerInvite(
  supabase: SupabaseClient,
  code: string,
  displayName?: string,
): Promise<RedeemInviteResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    return { ok: false, error: MESSAGES.invalid_code, code: 'invalid_code' };
  }

  const body: Record<string, unknown> = { code: trimmed };
  const cleanName = displayName?.trim();
  if (cleanName) body.displayName = cleanName;

  try {
    const { data, error } = await supabase.functions.invoke(REDEEM_FUNCTION, { body });

    if (error) {
      const errorCode = await extractErrorCode(error);
      return { ok: false, error: MESSAGES[errorCode], code: errorCode };
    }

    const record = (data ?? {}) as Record<string, unknown>;
    // Defensive: some function transports return a 200 envelope carrying the
    // error code instead of an HTTP error.
    if (typeof record.error === 'string') {
      const errorCode = normalizeCode(record.error);
      return { ok: false, error: MESSAGES[errorCode], code: errorCode };
    }

    const trainer = record.trainer;
    if (!trainer || typeof trainer !== 'object') {
      return { ok: false, error: 'The redeem service returned an unexpected response.', code: 'unknown' };
    }

    return { ok: true, trainer: toTrainer(trainer as RawRedeemedTrainer) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not reach the redeem service.';
    return { ok: false, error: message, code: 'unknown' };
  }
}
