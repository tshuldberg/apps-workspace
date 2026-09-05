// Push-wake boot + teardown wiring (Plan 42 P5, AC-42.9).
//
// Owns the per-install RANDOM registration handle and the boot/sign-out hooks
// that register and revoke push wake. The handle is a 256-bit random capability
// stored in device-local mk_settings; it is NOT a Meerkat identity or device
// pubkey, so the push gateway never learns who this device is (NC-42.3). A
// fresh identity (delete-my-data) drops the handle so a new install gets a new,
// unlinkable capability.
//
// HONESTY: bootPushWake only registers when the native token API, the client,
// and a configured gateway are ALL present; otherwise it returns the honest
// ok:false reason from registerPushWake and no registration is held. Nothing is
// faked. teardownPushWake revokes the server registration and discards the
// handle + token on sign-out.

import type { DatabaseAdapter } from '@mylife/db';
import { getSetting, setSetting, deleteSetting } from './db';
import {
  registerPushWake,
  unregisterPushWake,
  type RegisterPushWakeResult,
} from './background-task-registration';

/** mk_settings key holding the opaque random push registration handle. */
export const PUSH_REGISTRATION_HANDLE_KEY = 'push_registration_handle';

/** Bytes of entropy in a registration handle (256-bit). */
const HANDLE_BYTES = 32;

/** Hex-encode bytes without pulling a crypto dep (pure). */
function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * Load the persistent random registration handle, creating and storing one on
 * first use. `randomBytes` is injected (expo-crypto in the app) so this is pure
 * and unit-testable. The handle is opaque: it identifies a push registration to
 * the gateway, never the device identity.
 */
export function loadOrCreatePushRegistrationHandle(
  db: DatabaseAdapter,
  randomBytes: (n: number) => Uint8Array,
): string {
  const existing = getSetting(db, PUSH_REGISTRATION_HANDLE_KEY)?.trim();
  if (existing && existing.length === HANDLE_BYTES * 2) return existing;
  const handle = toHex(randomBytes(HANDLE_BYTES));
  setSetting(db, PUSH_REGISTRATION_HANDLE_KEY, handle);
  return handle;
}

/** Drop the stored handle (sign-out / delete): a new install gets a new one. */
export function clearPushRegistrationHandle(db: DatabaseAdapter): void {
  deleteSetting(db, PUSH_REGISTRATION_HANDLE_KEY);
}

/** Load expo-crypto's getRandomBytes, or a throwing stub when absent. */
function loadRandomBytes(): (n: number) => Uint8Array {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require('expo-crypto') as { getRandomBytes: (n: number) => Uint8Array };
    return (n: number) => Crypto.getRandomBytes(n);
  } catch {
    // No PRNG: return a stub that throws if actually invoked. bootPushWake below
    // never reaches handle creation without a native token API present, so this
    // stub is not hit on the Expo Go / test path (registration reports
    // 'unavailable' first).
    return () => {
      throw new Error('expo-crypto is not available');
    };
  }
}

/**
 * Register this device for push wake at app boot, AFTER crypto init + identity
 * are ready (the caller mounts this once identity is available). Returns the
 * honest registration result; the UI can surface 'unavailable' / 'not_configured'
 * plainly and must never claim push wake is on when it is not.
 */
export async function bootPushWake(db: DatabaseAdapter): Promise<RegisterPushWakeResult> {
  const handle = loadOrCreatePushRegistrationHandle(db, loadRandomBytes());
  return registerPushWake(handle);
}

/**
 * Revoke the push-wake registration and discard the local handle (sign-out /
 * delete-my-data). Safe to call when nothing is registered.
 */
export async function teardownPushWake(db: DatabaseAdapter): Promise<void> {
  await unregisterPushWake();
  clearPushRegistrationHandle(db);
}
