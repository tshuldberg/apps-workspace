// Restore-identity seam contract (Plan 23 / item 16a / AM8). Proves the exact
// @mylife/sync round-trip IdentityProvider.restoreIdentity depends on: a seeded
// recovery blob restores to the SAME device id + dh key, and a wrong key or a
// malformed key fails closed. This is the honest basis for the "restore really
// works end-to-end" copy the settings + onboarding surfaces now show.

import { describe, expect, it } from 'vitest';
import {
  exportRecoverableIdentity,
  generateDeviceIdentity,
  generateRecoveryKey,
  openAndRestore,
  parseRecoveryKey,
  sealRecovery,
} from '@mylife/sync';

describe('recovery restore seam (app contract)', () => {
  it('restores the SAME identity from a seeded recovery blob', () => {
    const identity = generateDeviceIdentity('Restore Test');
    const { key, bytes } = generateRecoveryKey();
    const sealed = sealRecovery(exportRecoverableIdentity(identity), bytes);

    const parsed = parseRecoveryKey(key);
    expect(parsed).not.toBeNull();
    const restored = openAndRestore(sealed, parsed!);
    expect(restored).not.toBeNull();
    expect(restored!.publicKey).toBe(identity.publicKey);
    expect(restored!.dhPublicKey).toBe(identity.dhPublicKey);
    expect(restored!.displayName).toBe(identity.displayName);
  });

  it('fails closed on the wrong recovery key (bad_backup path)', () => {
    const identity = generateDeviceIdentity('Restore Test 2');
    const { bytes } = generateRecoveryKey();
    const sealed = sealRecovery(exportRecoverableIdentity(identity), bytes);
    const wrong = generateRecoveryKey();
    expect(openAndRestore(sealed, wrong.bytes)).toBeNull();
  });

  it('rejects a malformed recovery key (bad_key path)', () => {
    expect(parseRecoveryKey('not-a-real-key')).toBeNull();
    expect(parseRecoveryKey('')).toBeNull();
  });
});
