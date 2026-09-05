/**
 * Plan 24 P3 acceptance: the OPEN public register route can be gated by an anti-bot
 * HUMANITY token. Everything is real: a real owner-signed publication + a real
 * node:http server (startCommunityNodeHttp). The humanity verifier is injected (the
 * deploy wires it to a HumanityService.redeem; here a fake makes the branches exact).
 *
 * Proven:
 *  - gate OFF (default): a genesis register succeeds with no humanity header.
 *  - gate ON, missing token: 401 humanity_required, and NOTHING is registered.
 *  - gate ON, invalid token: 401; already-spent token: 409 (replay).
 *  - gate ON, valid token: 200 and the manifest serves.
 *  - AM9 ordering: a malformed body is rejected (400) WITHOUT consuming a token.
 *  - firstRevisionOnly (default): a later revision is NOT re-gated.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import {
  buildPublicSnapshot,
  bytesToHex,
  createChannelMessage,
  createPublication,
  generateDeviceIdentity,
  revisePublication,
  type ChannelMessageEvent,
  type ContentManifest,
  type DeviceIdentity,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { CommunityNode } from '../index';
import { startCommunityNodeHttp, type CommunityNodeHumanityOptions } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';

const CHANNEL = 'general';
const COMMUNITY = 'humanity-community';
const NOW = '2026-07-06T00:00:00.000Z';

interface RawResponse { status: number; text: string }

function rawRequest(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<RawResponse> {
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

interface Fixture {
  owner: DeviceIdentity;
  signed: SignedPublicationDescriptor;
  publicationId: string;
  manifest: ContentManifest;
  pieces: Uint8Array[];
}

function post(author: DeviceIdentity, body: string, wall: string): ChannelMessageEvent {
  return createChannelMessage(author, { communityId: COMMUNITY, channelId: CHANNEL, body, hlc: { wall, counter: 0 } });
}

async function buildFixture(): Promise<Fixture> {
  const owner = generateDeviceIdentity('Publisher');
  const publicKey = new Uint8Array(randomBytes(32));
  const events = [post(owner, 'hello public', '2026-07-06T00:00:10.000Z')];
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({
    identity: owner, publicationId: 'pending', communityId: COMMUNITY, channelId: CHANNEL,
    events, publicKey, pieceStore: buildStore, now: NOW,
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(manifest.infoHash, i) as Uint8Array);
  const signed = createPublication(owner, {
    kind: 'channel', communityId: COMMUNITY, channelId: CHANNEL, title: 'Open Channel',
    description: 'public', category: 'technology', contentId: record.infoHash,
    publicKeyHex: bytesToHex(publicKey), now: NOW,
  });
  return { owner, signed, publicationId: signed.descriptor.publicationId, manifest, pieces };
}

function registerBody(signed: SignedPublicationDescriptor, fx: Fixture): string {
  return JSON.stringify({
    descriptor: signed,
    snapshots: [{ channelId: CHANNEL, epoch: 0, manifest: fx.manifest, pieces: fx.pieces.map((p) => Buffer.from(p).toString('base64')) }],
  });
}

function register(server: SeederHttpServer, fx: Fixture, opts: { humanity?: string; signed?: SignedPublicationDescriptor } = {}): Promise<RawResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.humanity !== undefined) headers['x-mk-humanity'] = opts.humanity;
  return rawRequest(`${server.url}/public/${fx.publicationId}/register`, {
    method: 'POST', headers, body: registerBody(opts.signed ?? fx.signed, fx),
  });
}

let server: SeederHttpServer | null = null;
afterEach(async () => { if (server) await server.close(); server = null; });

/** A fake verifier: accepts one token, rejects the rest; a second use of the accepted one is already_spent. */
function fakeHumanity(accepted: string): CommunityNodeHumanityOptions {
  const spent = new Set<string>();
  return {
    required: true,
    verifyToken: async (token: string) => {
      if (token !== accepted) return { ok: false, reason: 'invalid' };
      if (spent.has(token)) return { ok: false, reason: 'already_spent' };
      spent.add(token);
      return { ok: true };
    },
  };
}

describe('Plan 24 P3: humanity gate on the public register route', () => {
  it('gate OFF by default: a genesis register succeeds with no humanity header', async () => {
    const fx = await buildFixture();
    server = await startCommunityNodeHttp({ node: new CommunityNode({ now: () => Date.parse(NOW) }), host: '127.0.0.1' });
    expect((await register(server, fx)).status).toBe(200);
  });

  it('gate ON, missing token: 401 and nothing is registered', async () => {
    const fx = await buildFixture();
    server = await startCommunityNodeHttp({ node: new CommunityNode({ now: () => Date.parse(NOW) }), host: '127.0.0.1', humanity: fakeHumanity('good') });
    const res = await register(server, fx); // no header
    expect(res.status).toBe(401);
    expect(JSON.parse(res.text).reason).toBe('humanity_required');
    // Fail-closed: the publication was never committed.
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/manifest`)).status).toBe(404);
  });

  it('gate ON: invalid token 401, valid token 200, replay 409', async () => {
    const fx = await buildFixture();
    server = await startCommunityNodeHttp({ node: new CommunityNode({ now: () => Date.parse(NOW) }), host: '127.0.0.1', humanity: fakeHumanity('good') });
    expect((await register(server, fx, { humanity: 'bad' })).status).toBe(401);
    expect((await register(server, fx, { humanity: 'good' })).status).toBe(200);
    // The token is spent; a replay is a 409 (but the publication already exists / idempotent).
    expect((await register(server, fx, { humanity: 'good' })).status).toBe(409);
  });

  it('AM9: a malformed body is rejected 400 WITHOUT consuming a token', async () => {
    const fx = await buildFixture();
    const humanity = fakeHumanity('good');
    server = await startCommunityNodeHttp({ node: new CommunityNode({ now: () => Date.parse(NOW) }), host: '127.0.0.1', humanity });
    const res = await rawRequest(`${server.url}/public/${fx.publicationId}/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-mk-humanity': 'good' }, body: '{"descriptor":{}}',
    });
    expect(res.status).toBe(400);
    // The token was NOT spent (gate runs after shape verification): it still works.
    expect((await register(server, fx, { humanity: 'good' })).status).toBe(200);
  });

  it('firstRevisionOnly (default): a later revision is not re-gated', async () => {
    const fx = await buildFixture();
    server = await startCommunityNodeHttp({ node: new CommunityNode({ now: () => Date.parse(NOW) }), host: '127.0.0.1', humanity: fakeHumanity('good') });
    // Genesis (rev 1) needs a token.
    expect((await register(server, fx, { humanity: 'good' })).status).toBe(200);
    // Owner revises to rev 2; the later revision is NOT gated (no humanity header needed).
    const rev2 = revisePublication(fx.owner, fx.signed, { description: 'updated' }, '2026-07-06T00:01:00.000Z');
    expect((await register(server, fx, { signed: rev2 })).status).toBe(200);
  });
});
