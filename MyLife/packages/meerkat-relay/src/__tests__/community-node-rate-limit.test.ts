/**
 * Community feed P6 item 3 acceptance: deterministic per-device rate limits on the
 * community node. Authenticated publish/append/pull are capped per deviceId per
 * window; challenge ISSUANCE is capped globally per community (the pre-auth route
 * has no deviceId). Over-limit yields a 429 rate_limited verdict; it recovers once
 * the injected clock advances past the window.
 *
 * Real signed CommunityDescriptor + real per-member feed auth; the clock is
 * injected so the window math is exact and reproducible.
 */

import { describe, expect, it } from 'vitest';
import {
  createCommunity,
  signFeedAuth,
  signSealedTailEntry,
  type DeviceIdentity,
  type SealedTailEntry,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import { generateDeviceIdentity } from '@mylife/sync';
import { CommunityNode, InMemorySeederPieceStore } from '../index';

const CHANNEL = 'general';
const NOW_MS = Date.parse('2026-06-16T00:00:00.000Z');
const WINDOW = 60_000;
const SEALED = new Uint8Array(Array.from({ length: 64 }, (_, i) => (i * 5 + 1) % 251));

interface Fixture {
  owner: DeviceIdentity;
  member: DeviceIdentity;
  communityId: string;
  signed: SignedCommunityDescriptor;
}

function buildFixture(now: string): Fixture {
  const owner = generateDeviceIdentity('Owner');
  const member = generateDeviceIdentity('Member');
  const signed = createCommunity(owner, {
    name: 'Rate Club',
    channels: [{ id: CHANNEL, name: CHANNEL }],
    members: [{ deviceId: member.publicKey, role: 'member', displayName: member.displayName, dhPublicKey: member.dhPublicKey }],
    now,
  });
  return { owner, member, communityId: signed.descriptor.communityId, signed };
}

/** A controllable clock starting at NOW_MS. */
function clock(): { now: () => number; advance: (ms: number) => void } {
  let t = NOW_MS;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

async function authFor(node: CommunityNode, fx: Fixture, identity: DeviceIdentity, ts: string): Promise<{ deviceId: string; nonce: string; ts: string; signature: string } | null> {
  const challenge = await node.issueChallenge(fx.communityId);
  if (!challenge) return null;
  return {
    deviceId: identity.publicKey,
    nonce: challenge.nonce,
    ts,
    signature: signFeedAuth(identity, { communityId: fx.communityId, nonce: challenge.nonce, ts }),
  };
}

function tailEntry(fx: Fixture, author: DeviceIdentity, wall: string): SealedTailEntry {
  return signSealedTailEntry(author, {
    communityId: fx.communityId,
    channelId: CHANNEL,
    authorDeviceId: author.publicKey,
    hlcWall: wall,
    hlcCounter: 0,
  }, SEALED);
}

describe('community feed P6 item 3: per-device rate limits', () => {
  it('the (N+1)th authed append in the window is 429; it recovers after the window', async () => {
    const c = clock();
    const ts = new Date(NOW_MS).toISOString();
    const fx = buildFixture(ts);
    // appendPerWindow = 3 to keep the test tight; window default 60s.
    const node = new CommunityNode({
      pieceStore: new InMemorySeederPieceStore(),
      now: c.now,
      rateLimits: { appendPerWindow: 3 },
    });
    // Owner publishes the descriptor so appends can auth.
    await node.publish(fx.communityId, { descriptor: fx.signed, snapshots: [] }, (await authFor(node, fx, fx.owner, ts))!);

    // 3 appends succeed (within the window).
    for (let i = 0; i < 3; i += 1) {
      const v = await node.append(fx.communityId, tailEntry(fx, fx.member, `2026-06-16T00:00:1${i}.000Z`), (await authFor(node, fx, fx.member, ts))!);
      expect(v.ok).toBe(true);
    }
    // The 4th append within the same window is rate-limited (429).
    const over = await node.append(fx.communityId, tailEntry(fx, fx.member, '2026-06-16T00:00:20.000Z'), (await authFor(node, fx, fx.member, ts))!);
    expect(over).toEqual({ ok: false, status: 429, reason: 'rate_limited' });

    // Advance past the window: the bucket clears and the next append succeeds.
    c.advance(WINDOW + 1);
    const tsLater = new Date(c.now()).toISOString();
    const recovered = await node.append(fx.communityId, tailEntry(fx, fx.member, '2026-06-16T00:01:30.000Z'), (await authFor(node, fx, fx.member, tsLater))!);
    expect(recovered.ok).toBe(true);
  });

  it('the (N+1)th authed pull (manifest) in the window is 429', async () => {
    const c = clock();
    const ts = new Date(NOW_MS).toISOString();
    const fx = buildFixture(ts);
    const node = new CommunityNode({
      pieceStore: new InMemorySeederPieceStore(),
      now: c.now,
      rateLimits: { pullPerWindow: 2 },
    });
    await node.publish(fx.communityId, { descriptor: fx.signed, snapshots: [] }, (await authFor(node, fx, fx.owner, ts))!);

    for (let i = 0; i < 2; i += 1) {
      const v = await node.verifyRequest(fx.communityId, (await authFor(node, fx, fx.member, ts))!, false, 'pull');
      expect(v.ok).toBe(true);
    }
    const over = await node.verifyRequest(fx.communityId, (await authFor(node, fx, fx.member, ts))!, false, 'pull');
    expect(over).toEqual({ ok: false, status: 429, reason: 'rate_limited' });
  });

  it('caps challenge issuance globally per community (a flood cannot exhaust memory)', async () => {
    const c = clock();
    const ts = new Date(NOW_MS).toISOString();
    const fx = buildFixture(ts);
    const node = new CommunityNode({
      pieceStore: new InMemorySeederPieceStore(),
      now: c.now,
      rateLimits: { challengeCeilingPerCommunity: 4 },
    });

    // 4 live challenges issue; the 5th (over the ceiling) returns null.
    for (let i = 0; i < 4; i += 1) expect(await node.issueChallenge(fx.communityId)).not.toBeNull();
    expect(await node.issueChallenge(fx.communityId)).toBeNull();

    // Advancing past the challenge TTL prunes the live nonces, freeing the ceiling.
    c.advance(2 * 60 * 1000 + 1);
    expect(await node.issueChallenge(fx.communityId)).not.toBeNull();
  });
});
