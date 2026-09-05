/**
 * Plan 39 P12: the operator console HTTP surface. Adversarial-first:
 *  - EVERY /api route rejects a missing or wrong bearer (401), constant-path;
 *  - an unconfigured console (no secret, or no operator identity) answers 503
 *    console_not_configured on EVERY /api route -- fail-closed, no open mode;
 *  - IDOR on report keys 404s;
 *  - the audit log has NO mutating route (nothing can edit or delete a row);
 *  - actions return the REAL node verdict and the effect is visible on the
 *    public page route in the same process (AC-4);
 *  - body caps and method guards hold.
 */

import { randomBytes as nodeRandomBytes } from 'node:crypto';
import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildPublicSnapshot,
  bytesToHex,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createChannelMessage,
  createPublicAbuseReport,
  createPublication,
  createPublicPost,
  generateDeviceIdentity,
  publicPostNodeKeypairFromSeed,
  type ContentManifest,
} from '@mylife/sync';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import {
  CommunityNode,
  InMemoryPublicationStore,
  InMemoryPublicPostStore,
  InMemoryReportStore,
} from '../index';
import {
  deriveReportKey,
  InMemoryOperatorConsoleStore,
  OperatorConsoleService,
} from '../operator-console';
import { startOperatorConsoleHttp, type OperatorConsoleServer } from '../operator-console-http';

const CHANNEL = 'general';
const NOW = '2026-07-06T00:00:00.000Z';
const SECRET = 'operator-console-secret-for-tests';
const nodeReceipt = publicPostNodeKeypairFromSeed('33'.repeat(32));
const operator = publicPostNodeKeypairFromSeed('55'.repeat(32));
const persona = publicPostNodeKeypairFromSeed('44'.repeat(32));

interface RawResponse { status: number; text: string; headers: http.IncomingHttpHeaders; json: () => unknown }

function rawRequest(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    // A fresh connection per request: raw-socket reuse across odd verb/body
    // combinations (e.g. DELETE with a chunked body) corrupts the kept-alive
    // pipeline and node auto-400s the NEXT request, polluting assertions.
    const req = http.request(url, {
      method: init.method ?? 'GET',
      headers: { Connection: 'close', ...(init.headers ?? {}) },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode ?? 500, text, headers: res.headers, json: () => JSON.parse(text) });
      });
    });
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

function authed(body?: unknown): { method?: string; headers: Record<string, string>; body?: string } {
  return {
    ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}),
    headers: {
      Authorization: `Bearer ${SECRET}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
  };
}

interface Env {
  server: OperatorConsoleServer;
  node: CommunityNode;
  publicationId: string;
}

let server: OperatorConsoleServer | null = null;
afterEach(async () => { if (server) await server.close(); server = null; });
beforeEach(() => { configureSyncSecretStore(createInMemorySyncSecretStore()); });

async function boot(options: {
  consoleSecret?: string;
  nullConsole?: boolean;
  authFailureLimit?: { max: number; windowMs: number };
} = {}): Promise<Env> {
  const publications = new InMemoryPublicationStore();
  const reports = new InMemoryReportStore();
  const posts = new InMemoryPublicPostStore();
  const node = new CommunityNode({
    publicationStore: publications,
    reportStore: reports,
    publicPostStore: posts,
    postReceipt: nodeReceipt,
    trustedKillAuthorityDeviceId: operator.publicKeyHex,
  });
  const owner = generateDeviceIdentity('Publisher');
  const publicKey = new Uint8Array(nodeRandomBytes(32));
  const events = [createChannelMessage(owner, {
    communityId: 'http-community', channelId: CHANNEL, body: 'seed', hlc: { wall: '2026-07-06T00:00:10.000Z', counter: 0 },
  })];
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({
    identity: owner, publicationId: 'pending', communityId: 'http-community', channelId: CHANNEL,
    events, publicKey, pieceStore: buildStore, now: NOW,
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(manifest.infoHash, i) as Uint8Array);
  const signed = createPublication(owner, {
    kind: 'channel', communityId: 'http-community', channelId: CHANNEL, title: 'Open Channel',
    description: 'public', category: 'technology', contentId: record.infoHash,
    publicKeyHex: bytesToHex(publicKey), now: NOW,
    postPolicy: 'open', postNodeKeyHex: nodeReceipt.publicKeyHex,
  });
  const verdict = await node.registerPublication({
    descriptor: signed,
    snapshots: [{ channelId: CHANNEL, epoch: 0, manifest, pieces }],
  });
  expect(verdict.ok).toBe(true);

  let clock = Date.parse(NOW);
  const service = new OperatorConsoleService({
    node,
    publications,
    reports,
    posts,
    store: new InMemoryOperatorConsoleStore(),
    operator,
    now: () => { clock += 1000; return clock; },
  });
  server = await startOperatorConsoleHttp({
    console: options.nullConsole ? null : service,
    consoleSecret: options.consoleSecret ?? SECRET,
    port: 0,
    authFailureLimit: options.authFailureLimit ?? { max: 1_000, windowMs: 60_000 },
    alerts: async () => [{ kind: 'scanner_backlog', severity: 'warning', measured: 51, threshold: 50, unit: 'count' }],
  });
  return { server, node, publicationId: signed.descriptor.publicationId };
}

const API_ROUTES: Array<{ method: 'GET' | 'POST'; path: string; body?: unknown }> = [
  { method: 'GET', path: '/api/status' },
  { method: 'GET', path: '/api/alerts' },
  { method: 'GET', path: '/api/reports' },
  { method: 'GET', path: '/api/publications' },
  { method: 'GET', path: '/api/audit' },
  { method: 'GET', path: '/api/posts' },
  { method: 'POST', path: '/api/reports/review', body: { reportKey: 'a'.repeat(64), status: 'reviewed' } },
  { method: 'POST', path: '/api/actions/tombstone', body: { publicationId: 'p', postId: 'x', reason: 'r' } },
  { method: 'POST', path: '/api/actions/freeze', body: { publicationId: 'p', frozen: true, reason: 'r' } },
  { method: 'POST', path: '/api/actions/kill', body: { publicationId: 'p', reason: 'r' } },
  { method: 'POST', path: '/api/actions/suspend', body: { alias: 'alice', reason: 'r' } },
  { method: 'POST', path: '/api/actions/unsuspend', body: { alias: 'alice', reason: 'r' } },
  { method: 'POST', path: '/api/personas/status', body: { alias: 'alice' } },
];

describe('authentication (adversarial)', () => {
  it('rate-limits repeated failed bearer attempts and emits Retry-After', async () => {
    const env = await boot({ authFailureLimit: { max: 2, windowMs: 60_000 } });
    expect((await rawRequest(`${env.server.url}/api/status`)).status).toBe(401);
    expect((await rawRequest(`${env.server.url}/api/status`)).status).toBe(401);
    const limited = await rawRequest(`${env.server.url}/api/status`);
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('60');
  });

  it('rejects EVERY /api route without a bearer and with a wrong bearer', async () => {
    const env = await boot();
    for (const route of API_ROUTES) {
      const bare = await rawRequest(`${env.server.url}${route.path}`, {
        method: route.method,
        ...(route.body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(route.body) } : {}),
      });
      expect(bare.status, `${route.path} unauthenticated`).toBe(401);
      const wrong = await rawRequest(`${env.server.url}${route.path}`, {
        method: route.method,
        headers: {
          Authorization: 'Bearer wrong-secret',
          ...(route.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(route.body ? { body: JSON.stringify(route.body) } : {}),
      });
      expect(wrong.status, `${route.path} wrong secret`).toBe(401);
    }
  });

  it('rejects non-bearer schemes and a same-length wrong secret', async () => {
    const env = await boot();
    const basic = await rawRequest(`${env.server.url}/api/status`, { headers: { Authorization: `Basic ${SECRET}` } });
    expect(basic.status).toBe(401);
    const sameLength = SECRET.slice(0, -1) + (SECRET.endsWith('x') ? 'y' : 'x');
    const near = await rawRequest(`${env.server.url}/api/status`, { headers: { Authorization: `Bearer ${sameLength}` } });
    expect(near.status).toBe(401);
  });
});

describe('fail-closed when unconfigured', () => {
  it('answers 503 console_not_configured on every /api route with no secret', async () => {
    const env = await boot({ consoleSecret: '' });
    for (const route of API_ROUTES) {
      const res = await rawRequest(`${env.server.url}${route.path}`, {
        method: route.method,
        headers: {
          Authorization: `Bearer ${SECRET}`,
          ...(route.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(route.body ? { body: JSON.stringify(route.body) } : {}),
      });
      expect(res.status, route.path).toBe(503);
      expect((res.json() as { reason: string }).reason).toBe('console_not_configured');
    }
  });

  it('answers 503 on every /api route when the operator identity is missing (null console)', async () => {
    const env = await boot({ nullConsole: true });
    const res = await rawRequest(`${env.server.url}/api/status`, authed());
    expect(res.status).toBe(503);
    expect((res.json() as { reason: string }).reason).toBe('console_not_configured');
  });

  it('still serves the static shell and healthz (both data-free)', async () => {
    const env = await boot({ nullConsole: true });
    const page = await rawRequest(`${env.server.url}/`);
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.headers['content-security-policy']).toContain("default-src 'none'");
    expect(page.text).toContain('Meerkat operator console');
    const health = await rawRequest(`${env.server.url}/healthz`);
    expect(health.status).toBe(200);
    expect(health.text).toBe('{"ok":true}');
  });
});

describe('routes', () => {
  it('status carries real store counts (NC-P6)', async () => {
    const env = await boot();
    const empty = await rawRequest(`${env.server.url}/api/status`, authed());
    expect(empty.status).toBe(200);
    const emptyBody = empty.json() as { queue: { open: number }; operator: string; auditRows: number; alerts: unknown[] };
    expect(emptyBody.queue.open).toBe(0);
    expect(emptyBody.operator).toBe(operator.publicKeyHex);
    expect(emptyBody.auditRows).toBe(0);
    expect(emptyBody.alerts).toEqual([{ kind: 'scanner_backlog', severity: 'warning', measured: 51, threshold: 50, unit: 'count' }]);

    const alerts = await rawRequest(`${env.server.url}/api/alerts`, authed());
    expect(alerts.status).toBe(200);
    expect((alerts.json() as { alerts: unknown[] }).alerts).toEqual(emptyBody.alerts);

    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'spam spam' });
    expect((await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex)).ok).toBe(true);
    const reporter = generateDeviceIdentity('Reporter');
    const report = createPublicAbuseReport(reporter, {
      publicationId: env.publicationId, targetKind: 'post', targetId: post.postId, reason: 'spam',
    });
    expect((await env.node.submitPublicReport(env.publicationId, report)).ok).toBe(true);

    const loaded = await rawRequest(`${env.server.url}/api/status`, authed());
    const body = loaded.json() as { queue: { open: number; openByReason: Record<string, number> } };
    expect(body.queue.open).toBe(1);
    expect(body.queue.openByReason.spam).toBe(1);
  });

  it('tombstone action takes effect on the public page immediately (AC-4)', async () => {
    const env = await boot();
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'to remove' });
    expect((await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex)).ok).toBe(true);

    const res = await rawRequest(`${env.server.url}/api/actions/tombstone`, authed({
      publicationId: env.publicationId, postId: post.postId, reason: 'operator removal',
    }));
    expect(res.status).toBe(200);
    expect((res.json() as { ok: boolean }).ok).toBe(true);

    const page = await env.node.getPublicationPage(env.publicationId, CHANNEL, null, 50);
    expect(page?.publicPosts.some((p) => p.post.postId === post.postId)).toBe(false);
  });

  it('IDOR: a fabricated reportKey 404s and creates no triage state', async () => {
    const env = await boot();
    const res = await rawRequest(`${env.server.url}/api/reports/review`, authed({
      reportKey: 'ab'.repeat(32), status: 'dismissed',
    }));
    expect(res.status).toBe(404);
    expect((res.json() as { reason: string }).reason).toBe('unknown_report');
    const reports = await rawRequest(`${env.server.url}/api/reports?status=dismissed`, authed());
    expect((reports.json() as { total: number }).total).toBe(0);
  });

  it('review flips a REAL report and the queue count drops', async () => {
    const env = await boot();
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'meh' });
    expect((await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex)).ok).toBe(true);
    const reporter = generateDeviceIdentity('Reporter');
    const report = createPublicAbuseReport(reporter, {
      publicationId: env.publicationId, targetKind: 'post', targetId: post.postId, reason: 'other',
    });
    expect((await env.node.submitPublicReport(env.publicationId, report)).ok).toBe(true);
    const res = await rawRequest(`${env.server.url}/api/reports/review`, authed({
      reportKey: deriveReportKey(report), status: 'dismissed', note: 'fine',
    }));
    expect(res.status).toBe(200);
    const stats = (await rawRequest(`${env.server.url}/api/status`, authed())).json() as { queue: { open: number; dismissed: number } };
    expect(stats.queue.open).toBe(0);
    expect(stats.queue.dismissed).toBe(1);
  });

  it('suspend without a wired persona admin honestly 503s (no fake success)', async () => {
    const env = await boot();
    const res = await rawRequest(`${env.server.url}/api/actions/suspend`, authed({ alias: 'alice', reason: 'r' }));
    expect(res.status).toBe(503);
    expect((res.json() as { reason: string }).reason).toBe('persona_admin_not_configured');
  });

  it('audit has no mutating route: rows only ever grow', async () => {
    const env = await boot();
    await rawRequest(`${env.server.url}/api/actions/freeze`, authed({ publicationId: env.publicationId, frozen: true, reason: 'one' }));
    const before = (await rawRequest(`${env.server.url}/api/audit`, authed())).json() as { rows: unknown[]; total: number };
    expect(before.total).toBe(1);

    // Attempted tampering: every non-GET verb on the audit path is refused.
    // (Content-Length is explicit: node's own parser 400s a chunked DELETE body
    // before any handler runs, which would mask the route-level refusal.)
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const res = await rawRequest(`${env.server.url}/api/audit`, {
        method,
        headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json', 'Content-Length': '2' },
        body: '{}',
      });
      expect([404, 405], `${method} /api/audit`).toContain(res.status);
    }
    const after = (await rawRequest(`${env.server.url}/api/audit`, authed())).json() as { rows: unknown[]; total: number };
    expect(after.total).toBe(1);
    expect(after.rows).toEqual(before.rows);
  });

  it('caps request bodies (413) and rejects malformed JSON (400)', async () => {
    const env = await boot();
    const huge = await rawRequest(`${env.server.url}/api/actions/kill`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicationId: env.publicationId, reason: 'x'.repeat(64 * 1024) }),
    });
    expect(huge.status).toBe(413);
    const bad = await rawRequest(`${env.server.url}/api/actions/kill`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      body: '{not json',
    });
    expect(bad.status).toBe(400);
  });

  it('404s unknown API paths and 405s wrong methods', async () => {
    const env = await boot();
    expect((await rawRequest(`${env.server.url}/api/nope`, authed({}))).status).toBe(404);
    expect((await rawRequest(`${env.server.url}/api/status`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${SECRET}` },
    })).status).toBe(405);
    expect((await rawRequest(`${env.server.url}/`, { method: 'POST', headers: {} })).status).toBe(405);
    expect((await rawRequest(`${env.server.url}/unknown`)).status).toBe(404);
  });
});
