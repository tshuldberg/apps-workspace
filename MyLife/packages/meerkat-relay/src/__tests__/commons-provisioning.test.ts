/**
 * Plan 39 P8 acceptance: The Commons provisioning. The builder produces real, registerable
 * open publications (one per topic channel) under the `the-commons` community, each
 * operator-signed with the node receipt key pinned and postPolicy 'open'. Proven by
 * registering a provisioned topic on a REAL community node and serving its verify-to-view
 * gated page.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import {
  generateDeviceIdentity,
  publicPostNodeKeypairFromSeed,
  verifyPublication,
} from '@mylife/sync';
import {
  buildCommonsProvisioning,
  commonsGatePredicate,
  COMMONS_COMMUNITY_ID,
  DEFAULT_COMMONS_TOPICS,
  parseCommonsProvisioning,
  serializeCommonsProvisioning,
  CommunityNode,
  startCommunityNodeHttp,
} from '../index';
import type { SeederHttpServer } from '../seeder-http';

const nodeReceipt = publicPostNodeKeypairFromSeed('33'.repeat(32));
const NOW = '2026-07-06T00:00:00.000Z';

let server: SeederHttpServer | null = null;
afterEach(async () => { if (server) await server.close(); server = null; });

function rawRequest(url: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'GET', headers }, (res) => {
      const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 500, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject); req.end();
  });
}

describe('Plan 39 P8: The Commons provisioning', () => {
  it('serialize -> parse round-trips, and parse fail-closes on a tampered/non-Commons row', async () => {
    const operator = generateDeviceIdentity('CommonsOperator');
    const provisioned = await buildCommonsProvisioning({
      operator, postNodeKeyHex: nodeReceipt.publicKeyHex, randomBytes: (n) => new Uint8Array(randomBytes(n)), now: NOW,
      topics: [DEFAULT_COMMONS_TOPICS[0]!, DEFAULT_COMMONS_TOPICS[1]!],
    });
    const json = serializeCommonsProvisioning(provisioned);
    const parsed = parseCommonsProvisioning(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.map((p) => p.publicationId)).toEqual(provisioned.map((p) => p.publicationId));
    // A tampered descriptor (wrong community stamped in) fails the fail-closed parse.
    const tampered = JSON.parse(json) as { publications: Array<{ descriptor: { descriptor: { communityId: string } } }> };
    tampered.publications[0]!.descriptor.descriptor.communityId = 'not-the-commons';
    expect(parseCommonsProvisioning(JSON.stringify(tampered))).toBeNull();
    expect(parseCommonsProvisioning('not json')).toBeNull();

    // Malformed rows fail closed BEFORE the boot path touches them (codex P8 finding).
    const badPiece = JSON.parse(json) as { publications: Array<{ piecesBase64: unknown }> };
    badPiece.publications[0]!.piecesBase64 = [null];
    expect(parseCommonsProvisioning(JSON.stringify(badPiece))).toBeNull();
    const badManifest = JSON.parse(json) as { publications: Array<{ manifest: unknown }> };
    badManifest.publications[0]!.manifest = { infoHash: 'x' }; // no pieces array
    expect(parseCommonsProvisioning(JSON.stringify(badManifest))).toBeNull();
  });

  it('builds one open, operator-signed, node-pinned publication per topic', async () => {
    const operator = generateDeviceIdentity('CommonsOperator');
    const provisioned = await buildCommonsProvisioning({
      operator, postNodeKeyHex: nodeReceipt.publicKeyHex, randomBytes: (n) => new Uint8Array(randomBytes(n)), now: NOW,
    });
    expect(provisioned).toHaveLength(DEFAULT_COMMONS_TOPICS.length);
    for (const pub of provisioned) {
      expect(pub.descriptor.descriptor.communityId).toBe(COMMONS_COMMUNITY_ID);
      expect(pub.descriptor.descriptor.postPolicy).toBe('open');
      expect(pub.descriptor.descriptor.postNodeKeyHex).toBe(nodeReceipt.publicKeyHex);
      expect(pub.descriptor.descriptor.ownerDeviceId).toBe(operator.publicKey);
      // The descriptor is a valid owner-signed publication.
      expect(verifyPublication(pub.descriptor)).toBe('ok');
    }
    // Every id is distinct (distinct topic channels).
    expect(new Set(provisioned.map((p) => p.publicationId)).size).toBe(provisioned.length);
  });

  it('a provisioned topic registers on a real node and serves its (verify-to-view gated) page', async () => {
    const operator = generateDeviceIdentity('CommonsOperator');
    const provisioned = await buildCommonsProvisioning({
      operator, postNodeKeyHex: nodeReceipt.publicKeyHex, randomBytes: (n) => new Uint8Array(randomBytes(n)), now: NOW,
      topics: [DEFAULT_COMMONS_TOPICS[0]!], // just the first topic for the e2e
    });
    const pub = provisioned[0]!;

    const node = new CommunityNode({ postReceipt: nodeReceipt });
    // The first-party node gates The Commons reads (Plan 39 P9) via the provisioned id set.
    const isGated = commonsGatePredicate(provisioned);
    const sessionVerifier = async (t: string) => (t === 'good' ? { ok: true as const, personaPubkey: 'p'.repeat(64) } : { ok: false as const, reason: 'x' });
    server = await startCommunityNodeHttp({ node, port: 0, publicRead: { sessionVerifier, isGated } });

    // Register the provisioned topic publication.
    const body = JSON.stringify({ descriptor: pub.descriptor, snapshots: [{ channelId: pub.channelId, epoch: 0, manifest: pub.manifest, pieces: pub.pieces.map((p) => Buffer.from(p).toString('base64')) }] });
    await new Promise<void>((resolve, reject) => {
      const req = http.request(`${server!.url}/public/${pub.publicationId}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => { res.on('data', () => {}); res.on('end', () => resolve()); });
      req.on('error', reject); req.write(body); req.end();
    });

    const pageUrl = `${server.url}/public/${pub.publicationId}/${pub.channelId}/page`;
    // Gated: no session -> 401.
    expect((await rawRequest(pageUrl)).status).toBe(401);
    // With a session -> 200 and the operator's genesis welcome event is served.
    const ok = await rawRequest(pageUrl, { 'x-mk-session': 'good' });
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('Welcome to');
  });
});
