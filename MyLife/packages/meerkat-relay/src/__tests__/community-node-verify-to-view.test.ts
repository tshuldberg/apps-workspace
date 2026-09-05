/**
 * Plan 39 P9 acceptance: VERIFY-TO-VIEW on the first-party public READ routes. A publication a
 * node FLAGS as gated requires a valid persona session on manifest/page/piece; a publication
 * that is NOT flagged (or a node with no gate configured) serves OPEN. This is the honest
 * boundary (NC-P4): the node only enforces what it flags, and self-hosted/open publications
 * are unaffected.
 *
 * The session verifier is a FAKE injected through the same seam the submit route uses.
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
  publicPostNodeKeypairFromSeed,
  type ContentManifest,
  type DeviceIdentity,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { CommunityNode } from '../index';
import {
  startCommunityNodeHttp,
  type CommunityNodePublicReadOptions,
} from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';

const CHANNEL = 'general';
const NOW = '2026-07-06T00:00:00.000Z';
const nodeReceipt = publicPostNodeKeypairFromSeed('33'.repeat(32));

interface RawResponse { status: number; text: string; json: () => unknown }
function rawRequest(url: string, headers: Record<string, string> = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'GET', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode ?? 500, text, json: () => JSON.parse(text) });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

interface Fixture { signed: SignedPublicationDescriptor; publicationId: string; manifest: ContentManifest; pieces: Uint8Array[]; infoHash: string }

async function buildFixture(communityId: string, owner: DeviceIdentity): Promise<Fixture> {
  const publicKey = new Uint8Array(randomBytes(32));
  const events = [createChannelMessage(owner, { communityId, channelId: CHANNEL, body: 'seed', hlc: { wall: '2026-07-06T00:00:10.000Z', counter: 0 } })];
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({ identity: owner, publicationId: 'pending', communityId, channelId: CHANNEL, events, publicKey, pieceStore: buildStore, now: NOW });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(manifest.infoHash, i) as Uint8Array);
  const signed = createPublication(owner, {
    kind: 'channel', communityId, channelId: CHANNEL, title: 'pub', description: 'public', category: 'technology',
    contentId: record.infoHash, publicKeyHex: bytesToHex(publicKey), now: NOW, postPolicy: 'open', postNodeKeyHex: nodeReceipt.publicKeyHex,
  });
  return { signed, publicationId: signed.descriptor.publicationId, manifest, pieces, infoHash: record.infoHash };
}

let server: SeederHttpServer | null = null;
afterEach(async () => { if (server) await server.close(); server = null; });

async function registerPub(url: string, fx: Fixture): Promise<void> {
  const body = JSON.stringify({ descriptor: fx.signed, snapshots: [{ channelId: CHANNEL, epoch: 0, manifest: fx.manifest, pieces: fx.pieces.map((p) => Buffer.from(p).toString('base64')) }] });
  await new Promise<void>((resolve, reject) => {
    const req = http.request(`${url}/public/${fx.publicationId}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => { res.on('data', () => {}); res.on('end', () => resolve()); });
    req.on('error', reject); req.write(body); req.end();
  });
}

const GATED = 'the-commons';
const OPEN = 'open-community';

/** A fake session verifier: 'session-good' -> a persona; everything else rejects. */
const sessionVerifier: CommunityNodePublicReadOptions['sessionVerifier'] = async (token: string) =>
  token === 'session-good' ? { ok: true, personaPubkey: 'p'.repeat(64) } : { ok: false, reason: 'unknown' };

let fx0: Fixture;

describe('Plan 39 P9: verify-to-view enforcement', () => {
  it('gated pub: manifest/page/piece are 401 without a session, 200 with a valid one', async () => {
    const node = new CommunityNode({ postReceipt: nodeReceipt });
    const owner = generateDeviceIdentity('Operator');
    const s = await startCommunityNodeHttp({ node, port: 0, publicRead: { sessionVerifier, isGated: (id) => id === fx0?.publicationId } });
    server = s;
    fx0 = await buildFixture(GATED, owner);
    await registerPub(s.url, fx0);

    const base = `${s.url}/public/${fx0.publicationId}`;
    // No session -> 401 read_session_required on all three reads.
    for (const url of [`${base}/manifest`, `${base}/${CHANNEL}/page`, `${base}/${fx0.infoHash}/0`]) {
      const res = await rawRequest(url);
      expect(res.status).toBe(401);
      expect((res.json() as { reason: string }).reason).toBe('read_session_required');
    }
    // Bad session -> 401 read_session_invalid.
    expect((await rawRequest(`${base}/manifest`, { 'x-mk-session': 'nope' })).status).toBe(401);
    // Valid session -> 200.
    const okManifest = await rawRequest(`${base}/manifest`, { 'x-mk-session': 'session-good' });
    expect(okManifest.status).toBe(200);
    const okPage = await rawRequest(`${base}/${CHANNEL}/page`, { 'x-mk-session': 'session-good' });
    expect(okPage.status).toBe(200);
  });

  it('NC-P4: a NON-gated publication serves reads OPEN even while the gate is configured', async () => {
    const node = new CommunityNode({ postReceipt: nodeReceipt });
    const owner = generateDeviceIdentity('Operator');
    // Gate configured, but isGated only matches a DIFFERENT id -> this pub stays open.
    const s = await startCommunityNodeHttp({ node, port: 0, publicRead: { sessionVerifier, isGated: () => false } });
    server = s;
    const fx = await buildFixture(OPEN, owner);
    await registerPub(s.url, fx);
    // No session header, yet the open publication serves.
    expect((await rawRequest(`${s.url}/public/${fx.publicationId}/manifest`)).status).toBe(200);
  });

  it('gated pub with NO verifier configured fails closed 500 read_session_not_configured', async () => {
    const node = new CommunityNode({ postReceipt: nodeReceipt });
    const owner = generateDeviceIdentity('Operator');
    const s = await startCommunityNodeHttp({ node, port: 0, publicRead: { isGated: () => true } }); // gated but no verifier
    server = s;
    const fx = await buildFixture(GATED, owner);
    await registerPub(s.url, fx);
    const res = await rawRequest(`${s.url}/public/${fx.publicationId}/manifest`, { 'x-mk-session': 'session-good' });
    expect(res.status).toBe(500);
    expect((res.json() as { reason: string }).reason).toBe('read_session_not_configured');
  });

  it('a throwing verifier fails closed 503 read_session_unreachable', async () => {
    const node = new CommunityNode({ postReceipt: nodeReceipt });
    const owner = generateDeviceIdentity('Operator');
    const s = await startCommunityNodeHttp({ node, port: 0, publicRead: { sessionVerifier: async () => { throw new Error('down'); }, isGated: () => true } });
    server = s;
    const fx = await buildFixture(GATED, owner);
    await registerPub(s.url, fx);
    const res = await rawRequest(`${s.url}/public/${fx.publicationId}/manifest`, { 'x-mk-session': 'session-good' });
    expect(res.status).toBe(503);
    expect((res.json() as { reason: string }).reason).toBe('read_session_unreachable');
  });

  it('no publicRead configured at all: every read is OPEN (self-hosted default)', async () => {
    const node = new CommunityNode({ postReceipt: nodeReceipt });
    const owner = generateDeviceIdentity('Operator');
    const s = await startCommunityNodeHttp({ node, port: 0 }); // no publicRead
    server = s;
    const fx = await buildFixture(OPEN, owner);
    await registerPub(s.url, fx);
    expect((await rawRequest(`${s.url}/public/${fx.publicationId}/manifest`)).status).toBe(200);
  });
});
