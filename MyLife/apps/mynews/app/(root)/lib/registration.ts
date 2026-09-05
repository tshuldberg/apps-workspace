// C2 registration triangle: Supabase user_id (session) + device Ed25519 pubkey
// (signing) + handle (public identity), bound in one insert. Pure submit logic
// so the register screen stays a thin surface and this flow unit-tests against
// the in-memory port.

import { signKeyPossession, type MyNewsCloudPort, type ProfileView } from '@mylife/mynews';

export const HANDLE_RULE = /^[a-z0-9_]{3,30}$/;
export const HANDLE_RULE_COPY = '3-30 characters: a-z, 0-9, _';

export interface RegistrationAuth {
  ensureSession(): Promise<{ ok: true; userId: string } | { ok: false; error: string }>;
}

export type RegistrationOutcome =
  | { ok: true; profile: ProfileView }
  | { ok: false; field: 'handle' | 'form'; message: string };

export async function submitRegistration(input: {
  auth: RegistrationAuth;
  port: MyNewsCloudPort;
  identity: { pubkeyHex: string; privateKeyHex: string };
  handle: string;
  displayName: string;
}): Promise<RegistrationOutcome> {
  const handle = input.handle.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!HANDLE_RULE.test(handle)) {
    return { ok: false, field: 'handle', message: `Handles are ${HANDLE_RULE_COPY}` };
  }
  if (!displayName) {
    return { ok: false, field: 'form', message: 'Add a display name.' };
  }

  const session = await input.auth.ensureSession();
  if (!session.ok) {
    return {
      ok: false,
      field: 'form',
      message: `Could not start a session: ${session.error} Try again.`,
    };
  }

  let result: Awaited<ReturnType<MyNewsCloudPort['registerProfile']>>;
  try {
    result = await input.port.registerProfile({
      userId: session.userId,
      handle,
      displayName,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      field: 'form',
      message: `Could not reach the MyNews server: ${detail}`,
    };
  }

  if (result.ok) {
    // The profile row now exists with an empty key. Bind the device key with a
    // proof-of-possession signature over (userId, pubkey): the server verifies
    // it and writes the key under the service role. Non-transferable, so no one
    // can squat this key against another account.
    return bindKey(input, session.userId, result.profile);
  }

  if (result.error === 'handle-taken') {
    return { ok: false, field: 'handle', message: 'That handle is taken. Try another.' };
  }
  if (result.error === 'already-registered') {
    // This device already registered under this account: surface the existing
    // profile as success instead of a dead error. If a prior run created the
    // profile but never bound the key (empty pubkey), finish that step now.
    try {
      const existing = await input.port.getMyProfile();
      if (existing) {
        if (existing.pubkeyEd25519 === '') {
          return bindKey(input, session.userId, existing);
        }
        return { ok: true, profile: existing };
      }
    } catch {
      // Fall through to the honest failure below.
    }
    return {
      ok: false,
      field: 'form',
      message: 'This account already has a profile, but it could not be loaded. Try again.',
    };
  }
  if (result.error === 'not-signed-in') {
    return {
      ok: false,
      field: 'form',
      message: 'Your session expired before the profile was created. Try again.',
    };
  }
  return { ok: false, field: 'form', message: `Registration failed: ${result.error}` };
}

/**
 * Bind the device key to the profile with proof-of-possession. On success the
 * returned profile reflects the now-bound key. A conflict or verification
 * failure is surfaced honestly; the profile row exists either way, so a retry
 * can complete the binding.
 */
async function bindKey(
  input: {
    port: MyNewsCloudPort;
    identity: { pubkeyHex: string; privateKeyHex: string };
  },
  userId: string,
  profile: ProfileView,
): Promise<RegistrationOutcome> {
  // Already bound (e.g. an existing profile that carries the key): nothing to do.
  if (profile.pubkeyEd25519 === input.identity.pubkeyHex) {
    return { ok: true, profile };
  }
  const signatureHex = signKeyPossession(
    { userId, pubkey: input.identity.pubkeyHex },
    input.identity.privateKeyHex,
  );
  let bound: Awaited<ReturnType<MyNewsCloudPort['registerKey']>>;
  try {
    bound = await input.port.registerKey({
      userId,
      pubkeyHex: input.identity.pubkeyHex,
      signatureHex,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      field: 'form',
      message: `Your profile was created, but binding your signing key failed: ${detail} Try again.`,
    };
  }
  if (bound.ok) {
    return { ok: true, profile: { ...profile, pubkeyEd25519: input.identity.pubkeyHex } };
  }
  if (bound.error === 'pubkey-conflict') {
    return {
      ok: false,
      field: 'form',
      message: 'This device key is already registered to another profile. Contact support.',
    };
  }
  return {
    ok: false,
    field: 'form',
    message: `Your profile was created, but binding your signing key failed: ${bound.error} Try again.`,
  };
}
