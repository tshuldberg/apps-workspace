/**
 * End-to-end recovery (plan 14, MK-020) over the real relay. Alice seals her
 * identity under a recovery key and stashes the ciphertext in a relay mailbox
 * keyed by an id derived from the recovery key. A freshly-wiped device that has
 * ONLY the printed recovery key recomputes the id, fetches the blob, decrypts,
 * and recovers the SAME deviceId. The relay only ever holds opaque ciphertext.
 *
 * Honesty note: this reuses the MK-016 rendezvous store, which is one-time +
 * short-TTL -- it proves the crypto + transport round-trip. A durable,
 * re-resolvable recovery mailbox (long TTL, survives multiple restores) is a
 * follow-up; the recovery key + encrypted export themselves are storage-agnostic.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  generateDeviceIdentity,
  extractSigningPrivateKeyHex,
  generateRecoveryKey,
  parseRecoveryKey,
  exportRecoverableIdentity,
  sealRecovery,
  openRecovery,
  publishRendezvous,
  resolveRendezvous,
  sha512Hex,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../server';

let server: RelayServer | null = null;

afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
});

/** Public mailbox id derived from the recovery key (one-way; not the enc key). */
const backupId = (recoveryBytes: Uint8Array) => sha512Hex(recoveryBytes).slice(0, 32);

describe('recovery via relay mailbox e2e (MK-020)', () => {
  it('wipes the device and restores the same identity from the recovery key + relay', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const url = `ws://127.0.0.1:${server.port}`;

    // --- Before the wipe: Alice backs up her identity. ---
    const alice = generateDeviceIdentity('Alice');
    const aliceSigningPriv = extractSigningPrivateKeyHex(alice.privateKeyRef);
    const { key: printedKey, bytes: recoveryBytes } = generateRecoveryKey();

    const blob = sealRecovery(exportRecoverableIdentity(alice), recoveryBytes);
    await publishRendezvous({ url, rid: backupId(recoveryBytes), record: blob });

    // --- The phone is wiped. All that survives is the printed recovery key. ---
    const recovered = parseRecoveryKey(printedKey);
    expect(recovered).not.toBeNull();

    const fetched = await resolveRendezvous({ url, rid: backupId(recovered!) });
    expect(fetched).not.toBeNull();

    const restored = openRecovery(fetched!, recovered!);
    expect(restored).not.toBeNull();
    // Same identity is back: same deviceId and the same secret signing key.
    expect(restored!.publicKey).toBe(alice.publicKey);
    expect(restored!.signingPrivateKeyHex).toBe(aliceSigningPriv);
  });

  it('a wrong recovery key cannot open the backup even if it fetches the blob', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const url = `ws://127.0.0.1:${server.port}`;

    const alice = generateDeviceIdentity('Alice');
    const { bytes: realKey } = generateRecoveryKey();
    const blob = sealRecovery(exportRecoverableIdentity(alice), realKey);
    // Publish under the WRONG key's id so the attacker can even find it, to show
    // the encryption -- not obscurity -- is what protects the export.
    const wrongKey = generateRecoveryKey().bytes;
    await publishRendezvous({ url, rid: backupId(wrongKey), record: blob });

    const fetched = await resolveRendezvous({ url, rid: backupId(wrongKey) });
    expect(fetched).toBe(blob);
    expect(openRecovery(fetched!, wrongKey)).toBeNull();
  });
});
