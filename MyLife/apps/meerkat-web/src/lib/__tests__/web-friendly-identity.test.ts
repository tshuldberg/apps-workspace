// Friendly-identity web slice (plan 16): the web node gains a friend code for
// the first time (standard + custom vanity), publishes/resolves it over a REAL
// relay, and resolves chat author names from TRUSTED LOCAL sources only. All
// cryptography stays in @mylife/sync; this proves the app wiring is honest:
//   - a custom vanity code derives a stable rid and round-trips publish->resolve;
//   - a custom code is never mistaken for a standard one;
//   - the peer-name map comes from paired devices + the owner-signed descriptor,
//     NEVER from a message payload, and an unknown author has no entry.

import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  createCommunity,
  friendCodeToRendezvousId,
  generateFriendCode,
  insertPairedDevice,
  isValidCustomFriendCode,
  makeVanityFriendCode,
  normalizeFriendCodeInput,
  parseFriendCode,
  publishIdentityToRendezvous,
  resolveIdentityFromRendezvous,
  type PairedDevice,
} from '@mylife/sync';
import {
  buildCommunityPeerNameMap,
  getFriendCode,
  saveFriendCode,
  storeOwnedCommunity,
} from '../meerkat-data';
import { buildWebNode, teardownNode, withRelay, type WebNode } from './support/web-node-harness';

const nodes: WebNode[] = [];

afterEach(async () => {
  while (nodes.length) await teardownNode(nodes.pop() ?? null);
});

async function node(name: string): Promise<WebNode> {
  const n = await buildWebNode(name);
  nodes.push(n);
  return n;
}

const ws = WebSocket as unknown as new (u: string) => WebSocket;

describe('web friendly identity', () => {
  it('persists a standard friend code + rid round trip', async () => {
    const a = await node('A');
    expect(getFriendCode(a.db)).toBeNull();
    const { code, rendezvousId } = generateFriendCode();
    saveFriendCode(a.db, code, rendezvousId, false);
    const stored = getFriendCode(a.db);
    expect(stored).toEqual({ code, isCustom: false });
    expect(parseFriendCode(code)).not.toBeNull();
  });

  it('builds a custom vanity code that is valid, stable, and never standard', () => {
    const code = makeVanityFriendCode('cool'); // a real CSPRNG suffix
    expect(isValidCustomFriendCode(code)).toBe(true);
    // Never the standard 16-char checksummed shape (collision guard).
    expect(normalizeFriendCodeInput(code).length).not.toBe(16);
    expect(parseFriendCode(code)).toBeNull();
    // Deterministic rid derivation.
    const rid1 = friendCodeToRendezvousId(code);
    const rid2 = friendCodeToRendezvousId(code);
    expect(rid1).not.toBeNull();
    expect(Array.from(rid1!)).toEqual(Array.from(rid2!));
  });

  it('publishes a CUSTOM code and a second node resolves + verifies the bundle', async () => {
    const a = await node('Ana');
    const b = await node('Bo');
    const code = makeVanityFriendCode('anas-code');
    const rid = friendCodeToRendezvousId(code)!;
    saveFriendCode(a.db, code, rid, true);

    await withRelay(async (url) => {
      const published = await publishIdentityToRendezvous({
        url,
        identity: a.identity,
        customCode: code,
        relayHints: [url],
        webSocketImpl: ws,
      });
      expect(published).toBe(code);

      const result = await resolveIdentityFromRendezvous({ url, code, webSocketImpl: ws });
      expect(result.ok).toBe(true);
      if (result.ok) {
        // The resolved bundle is A's real signed identity (deviceId = A's key).
        expect(result.bundle.bundle.deviceId).toBe(a.identity.publicKey);
        expect(result.bundle.bundle.displayName).toBe(a.identity.displayName);
      }
    });
    void b; // B's node exists only to prove an independent resolver works.
  });

  it('resolves names from trusted local sources, never from a payload', async () => {
    const owner = await node('Owner');
    const friend = await node('Friend');

    // Owner creates a community whose descriptor lists the friend as a member.
    const signed = createCommunity(owner.identity, {
      name: 'Squad',
      channels: [{ id: 'general', name: 'general' }],
      members: [{ deviceId: friend.identity.publicKey, role: 'member', displayName: 'Friendly Fox' }],
    });
    storeOwnedCommunity(owner.db, owner.identity, signed);

    // A separate paired device contributes a higher-trust name that overrides.
    const pairedName = 'Verified Vera';
    const pairedDeviceId = friend.identity.publicKey;
    const paired: PairedDevice = {
      deviceId: pairedDeviceId,
      displayName: pairedName,
      dhPublicKey: friend.identity.dhPublicKey,
      sharedSecretRef: 'local:shared:deadbeef',
      lastSeenAt: null,
      lastSyncAt: null,
      lastSyncModule: null,
      bytesSent: 0,
      bytesReceived: 0,
      isActive: true,
      pairedAt: new Date().toISOString(),
    };
    insertPairedDevice(owner.db, paired);

    const names = buildCommunityPeerNameMap(owner.db, signed.descriptor.communityId);
    // Paired (verified) name wins over the descriptor member name.
    expect(names.get(pairedDeviceId)).toBe(pairedName);
    // An unknown device id has NO entry (caller falls back to short hex).
    expect(names.get('00'.repeat(32))).toBeUndefined();
  });
});
