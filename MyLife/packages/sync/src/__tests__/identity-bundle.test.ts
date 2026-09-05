/**
 * MK-015 -- SignedIdentityBundle + trust-on-first-use pinning. Pairing payloads
 * are authenticated (a bundle swap mid-flow is detected), and a known device
 * presenting a new DH key surfaces as a key change rather than silent trust.
 * Closes audit C13 half 1 (the Yearn F1 key-directory-MITM precedent).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createSignedIdentityBundle,
  verifySignedIdentityBundle,
  evaluateBundleTrust,
  type SignedIdentityBundle,
} from '../protocol/identity-bundle';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { getPinnedIdentity, pinIdentity, touchPinnedIdentity, acceptKeyChange } from '../db/queries';

describe('SignedIdentityBundle (MK-015 unit)', () => {
  it('round-trips create -> verify', () => {
    const id = generateDeviceIdentity('Alice');
    const signed = createSignedIdentityBundle(id, ['ws://relay.example:8787']);
    expect(signed.bundle.deviceId).toBe(id.publicKey);
    expect(signed.bundle.dhPublicKey).toBe(id.dhPublicKey);
    expect(signed.bundle.relayHints).toEqual(['ws://relay.example:8787']);
    expect(verifySignedIdentityBundle(signed)).toBe(true);
  });

  it('rejects a tampered DH key (the MITM swap)', () => {
    const id = generateDeviceIdentity('Alice');
    const evil = generateDeviceIdentity('Eve');
    const signed = createSignedIdentityBundle(id);
    const tampered: SignedIdentityBundle = {
      bundle: { ...signed.bundle, dhPublicKey: evil.dhPublicKey },
      signature: signed.signature,
    };
    expect(verifySignedIdentityBundle(tampered)).toBe(false);
  });

  it('rejects a bundle whose signature is from a different key than its deviceId', () => {
    const id = generateDeviceIdentity('Alice');
    const eve = generateDeviceIdentity('Eve');
    const eveSigned = createSignedIdentityBundle(eve);
    // Eve claims Alice's device id but keeps her own signature.
    const forged: SignedIdentityBundle = {
      bundle: { ...eveSigned.bundle, deviceId: id.publicKey },
      signature: eveSigned.signature,
    };
    expect(verifySignedIdentityBundle(forged)).toBe(false);
  });

  it('rejects structurally invalid bundles', () => {
    expect(verifySignedIdentityBundle({} as unknown as SignedIdentityBundle)).toBe(false);
    const id = generateDeviceIdentity('A');
    const signed = createSignedIdentityBundle(id);
    expect(verifySignedIdentityBundle({ bundle: signed.bundle, signature: 'not-hex' })).toBe(false);
  });
});

describe('evaluateBundleTrust (MK-015 TOFU matrix)', () => {
  const id = generateDeviceIdentity('Alice');
  const signed = createSignedIdentityBundle(id);

  it('first_seen when nothing is pinned', () => {
    expect(evaluateBundleTrust(signed, null)).toBe('first_seen');
  });

  it('matches when the pinned DH key is the same', () => {
    expect(evaluateBundleTrust(signed, { deviceId: id.publicKey, dhPublicKey: id.dhPublicKey })).toBe('matches');
  });

  it('key_changed when the same device re-keys its DH key (legitimate rotation)', () => {
    // deviceId is the stable Ed25519 key; the DH key can be rotated and re-signed
    // by that same key. The result is a self-valid bundle that keeps the id but
    // carries a new DH key -- exactly a key change, never silent trust.
    const rotated = generateDeviceIdentity('Alice-2');
    const reKeyed = createSignedIdentityBundle({ ...id, dhPublicKey: rotated.dhPublicKey });
    expect(verifySignedIdentityBundle(reKeyed)).toBe(true); // signed by the real deviceId
    expect(reKeyed.bundle.deviceId).toBe(id.publicKey);
    expect(reKeyed.bundle.dhPublicKey).toBe(rotated.dhPublicKey);
    expect(evaluateBundleTrust(reKeyed, { deviceId: id.publicKey, dhPublicKey: id.dhPublicKey }))
      .toBe('key_changed');
  });

  it('invalid_signature is rejected outright regardless of pin state', () => {
    const broken: SignedIdentityBundle = { bundle: signed.bundle, signature: 'ff'.repeat(64) };
    expect(evaluateBundleTrust(broken, null)).toBe('invalid_signature');
  });
});

describe('TOFU pin store (MK-015)', () => {
  let db: InMemoryTestDatabase;
  beforeEach(() => { db = createInMemoryTestDatabase(); createSyncTables(db.adapter); });
  afterEach(() => { db.close(); });

  it('pins on first use and is idempotent; touch updates last_seen', () => {
    const id = generateDeviceIdentity('Alice');
    const signed = createSignedIdentityBundle(id);
    const fields = {
      deviceId: id.publicKey, dhPublicKey: id.dhPublicKey, displayName: id.displayName,
      bundleJson: JSON.stringify(signed.bundle), bundleSignature: signed.signature,
      now: '2026-06-11T00:00:00.000Z',
    };
    pinIdentity(db.adapter, fields);
    pinIdentity(db.adapter, { ...fields, dhPublicKey: 'attacker-key', now: '2026-06-11T01:00:00.000Z' });

    const pinned = getPinnedIdentity(db.adapter, id.publicKey)!;
    expect(pinned.dhPublicKey).toBe(id.dhPublicKey); // INSERT OR IGNORE: the attacker can't overwrite
    expect(pinned.keyChangeCount).toBe(0);

    touchPinnedIdentity(db.adapter, id.publicKey, '2026-06-12T00:00:00.000Z');
    expect(getPinnedIdentity(db.adapter, id.publicKey)!.lastSeenAt).toBe('2026-06-12T00:00:00.000Z');
  });

  it('acceptKeyChange overwrites the DH key and bumps the counter (explicit user approval)', () => {
    const id = generateDeviceIdentity('Alice');
    const signed = createSignedIdentityBundle(id);
    pinIdentity(db.adapter, {
      deviceId: id.publicKey, dhPublicKey: id.dhPublicKey, displayName: id.displayName,
      bundleJson: JSON.stringify(signed.bundle), bundleSignature: signed.signature,
    });

    const reKeyed = generateDeviceIdentity('Alice-new-device');
    acceptKeyChange(db.adapter, {
      deviceId: id.publicKey, dhPublicKey: reKeyed.dhPublicKey, displayName: 'Alice',
      bundleJson: '{}', bundleSignature: 'sig2',
    });

    const pinned = getPinnedIdentity(db.adapter, id.publicKey)!;
    expect(pinned.dhPublicKey).toBe(reKeyed.dhPublicKey);
    expect(pinned.keyChangeCount).toBe(1);
  });
});
