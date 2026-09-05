/**
 * Community feed P4 acceptance (node emit): after a REAL change the CommunityNode
 * parks ONE content-FREE notify ping on the community's notify token, derived
 * from the stored descriptor's genesisNonce (no epoch key, zero-knowledge intact);
 * after a REJECTED append (bad auth / bad entry) it parks NOTHING.
 *
 * Real signed CommunityDescriptor, a real over-ciphertext-signed sealed tail
 * entry (the node verifies only that outer signature; it never decrypts), and a
 * real injected parkNotify. The ping is asserted to carry no message bytes.
 */

import { describe, expect, it } from 'vitest';
import {
  createCommunity,
  deriveCommunityNotifyToken,
  readCommunityNotifyPing,
  signFeedAuth,
  signSealedTailEntry,
  type DeviceIdentity,
  type SealedTailEntry,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import { generateDeviceIdentity } from '@mylife/sync';
import { CommunityNode, InMemorySeederPieceStore } from '../index';

const CHANNEL = 'general';
const NOW = '2026-06-16T00:00:00.000Z';
const NOW_MS = Date.parse(NOW);

// Opaque "ciphertext" bytes. The node verifies only the OUTER author signature
// over these bytes; it never decrypts, so any bytes stand in for a sealed event.
const SEALED = new Uint8Array(Array.from({ length: 80 }, (_, i) => (i * 7 + 3) % 251));

interface Fixture {
  owner: DeviceIdentity;
  member: DeviceIdentity;
  outsider: DeviceIdentity;
  communityId: string;
  genesisNonce: string;
  signed: SignedCommunityDescriptor;
}

function buildFixture(): Fixture {
  const owner = generateDeviceIdentity('Owner');
  const member = generateDeviceIdentity('Member');
  const outsider = generateDeviceIdentity('Outsider');

  const signed = createCommunity(owner, {
    name: 'Feed Club P4',
    channels: [{ id: CHANNEL, name: CHANNEL }],
    members: [
      { deviceId: member.publicKey, role: 'member', displayName: member.displayName, dhPublicKey: member.dhPublicKey },
    ],
    now: NOW,
  });

  return {
    owner, member, outsider,
    communityId: signed.descriptor.communityId,
    genesisNonce: signed.descriptor.genesisNonce,
    signed,
  };
}

/** Authenticate + publish the descriptor so the node holds it (no snapshots = no notify). */
async function ownerPublishDescriptor(node: CommunityNode, fx: Fixture): Promise<void> {
  const challenge = (await node.issueChallenge(fx.communityId))!;
  const auth = {
    deviceId: fx.owner.publicKey,
    nonce: challenge.nonce,
    ts: NOW,
    signature: signFeedAuth(fx.owner, { communityId: fx.communityId, nonce: challenge.nonce, ts: NOW }),
  };
  const verdict = await node.publish(fx.communityId, { descriptor: fx.signed, snapshots: [] }, auth);
  expect(verdict.ok).toBe(true);
}

/** A real authed append of one over-ciphertext-signed tail entry. */
async function appendAs(
  node: CommunityNode,
  fx: Fixture,
  authIdentity: DeviceIdentity,
  entry: SealedTailEntry,
): Promise<{ ok: boolean }> {
  const challenge = (await node.issueChallenge(fx.communityId))!;
  const auth = {
    deviceId: authIdentity.publicKey,
    nonce: challenge.nonce,
    ts: NOW,
    signature: signFeedAuth(authIdentity, { communityId: fx.communityId, nonce: challenge.nonce, ts: NOW }),
  };
  return node.append(fx.communityId, entry, auth);
}

/** Sign an opaque sealed tail entry as `author`. */
function tailEntry(fx: Fixture, author: DeviceIdentity, wall: string): SealedTailEntry {
  return signSealedTailEntry(author, {
    communityId: fx.communityId,
    channelId: CHANNEL,
    authorDeviceId: author.publicKey,
    hlcWall: wall,
    hlcCounter: 0,
  }, SEALED);
}

describe('community feed P4: node parks a content-free notify ping on real change', () => {
  it('parks ONE ping after a real append, on the genesisNonce-derived token, content-free', async () => {
    const fx = buildFixture();
    const parked: { token: string; ping: Uint8Array }[] = [];
    const node = new CommunityNode({
      pieceStore: new InMemorySeederPieceStore(),
      now: () => NOW_MS,
      parkNotify: (token, ping) => { parked.push({ token, ping }); },
    });
    await ownerPublishDescriptor(node, fx);

    const entry = tailEntry(fx, fx.member, '2026-06-16T00:00:10.000Z');
    const verdict = await appendAs(node, fx, fx.member, entry);
    expect(verdict.ok).toBe(true);

    // Exactly one ping was parked.
    expect(parked).toHaveLength(1);

    // It is on the notify token any descriptor-holder derives from the genesisNonce.
    const expectedToken = deriveCommunityNotifyToken(fx.genesisNonce, fx.communityId);
    expect(parked[0]!.token).toBe(expectedToken);

    // It is content-free: a descriptor-holder reads only {communityId, ts}; no message.
    const read = readCommunityNotifyPing(fx.genesisNonce, parked[0]!.ping);
    expect(read).not.toBeNull();
    expect(Object.keys(read!).sort()).toEqual(['communityId', 'ts']);
    expect(read!.communityId).toBe(fx.communityId);
    expect(read!.ts).toBe(NOW);
  });

  it('parks NOTHING after a rejected append (bad auth: not a member)', async () => {
    const fx = buildFixture();
    const parked: { token: string; ping: Uint8Array }[] = [];
    const node = new CommunityNode({
      pieceStore: new InMemorySeederPieceStore(),
      now: () => NOW_MS,
      parkNotify: (token, ping) => { parked.push({ token, ping }); },
    });
    await ownerPublishDescriptor(node, fx);

    // An outsider (valid key, NOT in the descriptor) authenticates + appends.
    const entry = tailEntry(fx, fx.outsider, '2026-06-16T00:00:11.000Z');
    const verdict = await appendAs(node, fx, fx.outsider, entry);
    expect(verdict.ok).toBe(false);

    expect(parked).toHaveLength(0);
  });

  it('parks NOTHING after a rejected append (bad entry: wrong community id)', async () => {
    const fx = buildFixture();
    const parked: { token: string; ping: Uint8Array }[] = [];
    const node = new CommunityNode({
      pieceStore: new InMemorySeederPieceStore(),
      now: () => NOW_MS,
      parkNotify: (token, ping) => { parked.push({ token, ping }); },
    });
    await ownerPublishDescriptor(node, fx);

    // A member with valid auth, but the entry names the wrong community id.
    const good = tailEntry(fx, fx.member, '2026-06-16T00:00:12.000Z');
    const badEntry: SealedTailEntry = { ...good, communityId: 'not-this-community' };
    const verdict = await appendAs(node, fx, fx.member, badEntry);
    expect(verdict.ok).toBe(false);

    expect(parked).toHaveLength(0);
  });

  it('does not require parkNotify: append still succeeds when none is wired (Expo-safe)', async () => {
    const fx = buildFixture();
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => NOW_MS });
    await ownerPublishDescriptor(node, fx);
    const entry = tailEntry(fx, fx.member, '2026-06-16T00:00:13.000Z');
    const verdict = await appendAs(node, fx, fx.member, entry);
    expect(verdict.ok).toBe(true);
  });
});
