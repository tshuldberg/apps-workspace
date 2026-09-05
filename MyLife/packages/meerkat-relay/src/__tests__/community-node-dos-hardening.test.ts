/**
 * Audit S2 + S3 regression: unauthenticated DoS hardening on the always-on
 * community node.
 *
 * S2 (per-route body caps): register/publish/append buffer the request body
 * before auth/verify. Each POST route now caps the read and returns 413 past the
 * cap, before the body is fully buffered or parsed.
 *
 * S3 (bounded community map): the challenge/manifest/piece routes lazily create a
 * CommunityState per untrusted id. Without a bound the `communities` map grows
 * without limit. The node now caps the count of UNCLAIMED (no published descriptor)
 * states and sweeps expired ones; a CLAIMED (published) community is never evicted.
 *
 * Every payload here is real HTTP over a real node:http server. The oversized bodies
 * are rejected before any crypto runs (the 413 precedes node.publish/register/append).
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import {
  createCommunity,
  signFeedAuth,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import { generateDeviceIdentity } from '@mylife/sync';
import { CommunityNode } from '../index';
import { startCommunityNodeHttp } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';

const CHANNEL = 'general';
const NOW = '2026-07-04T00:00:00.000Z';

interface RawResponse { status: number; text: string }

function rawRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers ?? {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 500, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

/** Dummy per-member auth headers: enough to pass the header-presence gate so the
 *  request reaches readBody. They never need to verify -- the 413 fires first. */
const DUMMY_AUTH_HEADERS: Record<string, string> = {
  'x-mk-device': 'untrusted-device',
  'x-mk-nonce': 'untrusted-nonce',
  'x-mk-ts': NOW,
  'x-mk-sig': 'untrusted-sig',
};

let server: SeederHttpServer | null = null;
afterEach(async () => {
  if (server) await server.close();
  server = null;
});

describe('audit S2: per-route request-body caps reject an oversized body with 413', () => {
  it('rejects an oversized public register body before buffering it fully or registering', async () => {
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1', bodyLimits: { register: 64 } });

    // A body well over the 64-byte cap. On the OLD Infinity default this is buffered in
    // full and reaches decodeRegisterBody -> 400 bad_body; the cap returns 413 first.
    const oversized = JSON.stringify({ descriptor: {}, snapshots: [], filler: 'x'.repeat(4096) });
    const real = await rawRequest(`${server.url}/public/register-victim/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversized,
    });
    expect(real.status).toBe(413);

    // Nothing was registered: the anonymous manifest read 404s.
    const manifest = await rawRequest(`${server.url}/public/register-victim/manifest`);
    expect(manifest.status).toBe(404);
  });

  it('rejects an oversized publish body with 413 (before auth/parse)', async () => {
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1', bodyLimits: { publish: 64 } });

    const oversized = JSON.stringify({ descriptor: {}, snapshots: [], filler: 'x'.repeat(4096) });
    const res = await rawRequest(`${server.url}/community/publish-victim/publish`, {
      method: 'POST',
      headers: { ...DUMMY_AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: oversized,
    });
    expect(res.status).toBe(413);
  });

  it('rejects an oversized append body with 413 (before auth/parse)', async () => {
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1', bodyLimits: { append: 64 } });

    const oversized = JSON.stringify({ communityId: 'append-victim', filler: 'x'.repeat(4096) });
    const res = await rawRequest(`${server.url}/community/append-victim/append`, {
      method: 'POST',
      headers: { ...DUMMY_AUTH_HEADERS, 'Content-Type': 'application/json' },
      body: oversized,
    });
    expect(res.status).toBe(413);
  });

  it('still accepts a body under the cap (the cap does not regress legit payloads)', async () => {
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    // A cap that comfortably clears a small register body; the body is junk so the
    // verdict is 400 bad_body (NOT 413) -- proving the cap let it through to parse.
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1', bodyLimits: { register: 4096 } });
    const res = await rawRequest(`${server.url}/public/under-cap/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptor: {}, snapshots: [] }),
    });
    expect(res.status).toBe(400);
  });
});

describe('audit S3: the community map is bounded against an unclaimed-id flood', () => {
  it('caps the number of unclaimed community states under a challenge flood', async () => {
    const node = new CommunityNode({ now: () => Date.parse(NOW), maxUnclaimedCommunities: 4 });
    for (let i = 0; i < 50; i += 1) await node.issueChallenge(`junk-community-${i}`);
    // Without the S3 bound this would be 50; FIFO eviction keeps it at the cap.
    expect(await node.communityStateCount()).toBeLessThanOrEqual(4);
  });

  it('never evicts a CLAIMED (published) community during an unclaimed flood', async () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const signed: SignedCommunityDescriptor = createCommunity(owner, {
      name: 'Real Club',
      channels: [{ id: CHANNEL, name: CHANNEL }],
      members: [{ deviceId: member.publicKey, role: 'member', displayName: member.displayName, dhPublicKey: member.dhPublicKey }],
      now: NOW,
    });
    const communityId = signed.descriptor.communityId;
    const node = new CommunityNode({ now: () => Date.parse(NOW), maxUnclaimedCommunities: 2 });

    // Owner publishes the real descriptor (this claims the community).
    const challenge = (await node.issueChallenge(communityId))!;
    const auth = {
      deviceId: owner.publicKey,
      nonce: challenge.nonce,
      ts: NOW,
      signature: signFeedAuth(owner, { communityId, nonce: challenge.nonce, ts: NOW }),
    };
    expect((await node.publish(communityId, { descriptor: signed, snapshots: [] }, auth)).ok).toBe(true);
    expect(await node.hasCommunity(communityId)).toBe(true);

    // Flood far past the unclaimed cap.
    for (let i = 0; i < 20; i += 1) await node.issueChallenge(`junk-${i}`);

    // The real community survives; only the unclaimed junk is bounded.
    expect(await node.hasCommunity(communityId)).toBe(true);
  });

  it('sweepUnclaimed reclaims unclaimed states once their nonces expire', async () => {
    let t = Date.parse(NOW);
    const node = new CommunityNode({ now: () => t, challengeTtlMs: 60_000 });
    for (let i = 0; i < 10; i += 1) await node.issueChallenge(`ephemeral-${i}`);
    expect(await node.communityStateCount()).toBe(10);

    // Before expiry the sweep keeps live-nonce states.
    await node.sweepUnclaimed();
    expect(await node.communityStateCount()).toBe(10);

    // After the challenge TTL every nonce is expired: the sweep reclaims all of them.
    t += 60_001;
    await node.sweepUnclaimed();
    expect(await node.communityStateCount()).toBe(0);
  });
});
