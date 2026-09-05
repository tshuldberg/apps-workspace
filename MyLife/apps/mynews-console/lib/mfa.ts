import 'server-only';

import { type MfaStep, nextMfaStep } from './aal';
import { createSupabaseServerClient } from './supabase-server';

/**
 * Console MFA (plan 48 WP9). TOTP enrolment and verification through the
 * @supabase/ssr cookie client, which is the same client that holds the console
 * session, so a successful verify upgrades THIS session to aal2.
 *
 * There is no bypass. No environment variable, header, or build flag skips this;
 * a moderator without aal2 reaches /mfa and nothing else. See README.md for why
 * that is workable in local development (TOTP needs no mail, SMS, or vendor).
 *
 * Factor hygiene: an abandoned enrolment leaves an `unverified` factor behind,
 * and Supabase refuses a second factor with the same friendly name. Enrolling
 * clears this console's own unverified factors first, and never touches a
 * verified one, so a stuck enrolment cannot lock a moderator out and a retry
 * cannot remove working MFA.
 */

export const CONSOLE_FACTOR_NAME = 'mynews-console';

export interface MfaState {
  step: MfaStep;
  currentLevel: string | null;
  nextLevel: string | null;
  verifiedFactorId: string | null;
  /** Present only immediately after an enroll call. */
  enrollment: { factorId: string; secret: string; uri: string } | null;
}

export async function readMfaState(): Promise<MfaState> {
  const supabase = await createSupabaseServerClient();
  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const verified = (factors?.totp ?? []).find((factor) => factor.status === 'verified') ?? null;
  return {
    step: nextMfaStep({
      currentLevel: aal?.currentLevel ?? null,
      nextLevel: aal?.nextLevel ?? null,
      hasVerifiedFactor: verified !== null,
    }),
    currentLevel: aal?.currentLevel ?? null,
    nextLevel: aal?.nextLevel ?? null,
    verifiedFactorId: verified?.id ?? null,
    enrollment: null,
  };
}

export type MfaOutcome =
  | { ok: true; code: 'enrolled'; factorId: string; secret: string; uri: string }
  | { ok: true; code: 'verified' }
  | { ok: false; code: string };

/**
 * Start TOTP enrolment. Returns the secret and otpauth URI for the moderator's
 * authenticator app; the factor is not usable until verifyTotp succeeds.
 */
export async function enrollTotp(): Promise<MfaOutcome> {
  const supabase = await createSupabaseServerClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, code: 'list_failed' };
  if ((factors?.totp ?? []).some((factor) => factor.status === 'verified')) {
    // A verified factor already exists; the moderator needs to VERIFY this
    // session, not enrol again. Never unenroll a working factor to make room.
    return { ok: false, code: 'already_enrolled' };
  }
  for (const stale of factors?.totp ?? []) {
    if (stale.status !== 'verified') {
      await supabase.auth.mfa.unenroll({ factorId: stale.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: CONSOLE_FACTOR_NAME,
  });
  if (error || !data) {
    console.error(`mynews-console: mfa enroll failed: ${error?.message ?? 'no data'}`);
    return { ok: false, code: 'enroll_failed' };
  }
  return {
    ok: true,
    code: 'enrolled',
    factorId: data.id,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/**
 * Verify a TOTP code against a fresh challenge. On success the console session's
 * assurance level becomes aal2 and the refreshed cookie is written by the ssr
 * client, so the very next request passes requireModerator().
 */
export async function verifyTotp(input: { factorId: string; code: string }): Promise<MfaOutcome> {
  const code = input.code.replace(/\s+/g, '');
  if (!/^\d{6,8}$/.test(code)) return { ok: false, code: 'bad_code' };
  const supabase = await createSupabaseServerClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: input.factorId,
  });
  if (challengeError || !challenge) {
    console.error(`mynews-console: mfa challenge failed: ${challengeError?.message ?? 'no data'}`);
    return { ok: false, code: 'challenge_failed' };
  }
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: input.factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) {
    // Deliberately generic: a wrong code and a replayed code read the same.
    return { ok: false, code: 'invalid_code' };
  }
  return { ok: true, code: 'verified' };
}

/**
 * The factor id to challenge for a session that has a verified factor. Null when
 * there is none, which sends the moderator to enrolment instead.
 */
export async function verifiedFactorId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return null;
  return (data?.totp ?? []).find((factor) => factor.status === 'verified')?.id ?? null;
}
