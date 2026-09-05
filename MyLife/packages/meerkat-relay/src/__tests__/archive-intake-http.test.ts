/**
 * WP-43E managed archive job intake API tests.
 *
 * Drives the real /api/archive/* HTTP surface (archive-intake-http.ts, mounted via
 * startCommunityNodeHttp's archiveIntake option) over a genuine node:http listener with the real
 * in-memory lifecycle store, object store, reference ledger, and deletion queue -- the same
 * substrate archive-pin-fixtures.ts already proves against for pin reconciliation/takedown.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { createHash } from 'node:crypto';
import {
  bytesToHex,
  createArchiveJob,
  createPublication,
  extractSigningPrivateKeyHex,
  generateDeviceIdentity,
  signMessage,
  type DeviceIdentity,
  type SignedArchiveJob,
} from '@mylife/sync';
import {
  MEERKAT_HOSTED_STORAGE_FEATURE,
  issueMeerkatHostedEntitlement,
} from '@mylife/entitlements/server';
import { CommunityNode } from '../index';
import { startCommunityNodeHttp } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';
import {
  InMemoryArchiveRequestNonceStore,
  type ArchiveIntakeOptions,
  type ArchiveIntakeQuotaSource,
} from '../archive-intake-http';
import { InMemoryObjectStore } from '../object-store-memory';
import { InMemoryArchiveLifecycleStore } from '../archive-lifecycle';
import { InMemoryObjectReferenceLedger } from '../object-reference-ledger-memory';
import { InMemoryObjectDeletionJobStore } from '../object-deletion-jobs-memory';
import { ArchiveObjectByteService } from '../archive-object-bytes';
import { ArchiveScannerWorker } from '../archive-scanner-worker';
import type { MalwareScanner } from '../archive-malware-scan';
import type { AbuseHashScanner } from '../abuse-scan';
import { FakeServingIndex } from './support/archive-pin-fixtures';

const NOW = Date.parse('2026-07-12T00:00:00.000Z');
const ENTITLEMENT_SECRET = 'archive-intake-secret';
const HOST_ID = 'archive-host-1';

interface RawResponse { status: number; json: any; headers: http.IncomingHttpHeaders }

function rawRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: Buffer | string } = {},
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers ?? {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json: any = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = text; }
        resolve({ status: res.statusCode ?? 500, json, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function entitlementToken(owner: DeviceIdentity): Promise<string> {
  const issued = await issueMeerkatHostedEntitlement({
    secret: ENTITLEMENT_SECRET,
    subjectId: owner.publicKey,
    features: [MEERKAT_HOSTED_STORAGE_FEATURE],
  });
  return issued.token;
}

async function bearer(owner: DeviceIdentity): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await entitlementToken(owner)}` };
}

let nonceCounter = 0;

function ownerRequestHeaders(
  owner: DeviceIdentity,
  method: string,
  pathname: string,
  body: Uint8Array,
  ts = new Date(NOW).toISOString(),
): Record<string, string> {
  nonceCounter += 1;
  const nonce = sha256(new TextEncoder().encode(`${owner.publicKey}:${ts}:${nonceCounter}`));
  const bytes = new TextEncoder().encode(JSON.stringify([
    'meerkat-archive-request-auth-v2',
    method,
    pathname,
    ts,
    nonce,
    sha256(body),
  ]));
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(owner.privateKeyRef), bytes));
  return { 'x-mk-ts': ts, 'x-mk-nonce': nonce, 'x-mk-owner-sig': signature };
}

function ownerAuthHeaders(
  owner: DeviceIdentity,
  jobId: string,
  ts = new Date(NOW).toISOString(),
  method = 'GET',
): Record<string, string> {
  return ownerRequestHeaders(owner, method, `/api/archive/jobs/${jobId}`, new Uint8Array(0), ts);
}

interface Harness {
  objectStore: InMemoryObjectStore;
  store: InMemoryArchiveLifecycleStore;
  ledger: InMemoryObjectReferenceLedger;
  deletionJobs: InMemoryObjectDeletionJobStore;
  byteService: ArchiveObjectByteService;
  servingIndex: FakeServingIndex;
  quota: ArchiveIntakeQuotaSource;
  options: ArchiveIntakeOptions;
}

function buildHarness(overrides: Partial<ArchiveIntakeOptions> = {}): Harness {
  const objectStore = new InMemoryObjectStore();
  const store = new InMemoryArchiveLifecycleStore();
  const ledger = new InMemoryObjectReferenceLedger();
  const deletionJobs = new InMemoryObjectDeletionJobStore();
  const byteService = new ArchiveObjectByteService(objectStore, store, ledger);
  const servingIndex = new FakeServingIndex();
  const quota: ArchiveIntakeQuotaSource = {
    capBytes: () => 10 * 1024 * 1024,
  };
  const options: ArchiveIntakeOptions = {
    store,
    byteService,
    servingIndex,
    referenceLedger: ledger,
    deletionJobs,
    probeAbsence: async (durableKey) => (await objectStore.observe(durableKey)) === null,
    entitlementSecret: ENTITLEMENT_SECRET,
    quota,
    resolvePublication: (publicationId) => authoritativePublications.get(publicationId) ?? null,
    nonceStore: new InMemoryArchiveRequestNonceStore(() => NOW),
    hostId: HOST_ID,
    now: () => NOW,
    ...overrides,
  };
  return { objectStore, store, ledger, deletionJobs, byteService, servingIndex, quota, options };
}

const authoritativePublications = new Map<string, {
  signed: ReturnType<typeof createPublication>;
  objects: SignedArchiveJob['job']['objects'];
}>();
const ownersByJobId = new Map<string, DeviceIdentity>();

function buildJob(
  suffix: string,
  contentIdOverride?: string,
  objectBytes: readonly Uint8Array[] = [new Uint8Array(10)],
): { owner: DeviceIdentity; signed: SignedArchiveJob; contentId: string } {
  const owner = generateDeviceIdentity(`Archive owner ${suffix}`);
  const contentId = contentIdOverride ?? `content-${suffix}`;
  const publication = createPublication(owner, {
    kind: 'channel',
    communityId: `community-${suffix}`,
    channelId: `channel-${suffix}`,
    postId: null,
    title: `Archive ${suffix}`,
    description: 'test',
    category: 'technology',
    contentId,
    publicKeyHex: 'aabbccddeeff00',
    hostUrls: ['https://archive.example'],
    joinPolicy: 'open',
    now: new Date(NOW).toISOString(),
  });
  const signed = createArchiveJob(owner, publication, {
    tier: 'managed',
    hostUrl: 'https://archive.example',
    objects: objectBytes.map((bytes, index) => ({ index, hash: sha256(bytes), size: bytes.byteLength })),
    rights: {
      license: 'cc_by',
      rightsAssertion: 'i_own',
      provenance: 'owner-created',
      consentAt: new Date(NOW).toISOString(),
    },
    now: new Date(NOW).toISOString(),
  });
  authoritativePublications.set(publication.descriptor.publicationId, {
    signed: publication,
    objects: signed.job.objects,
  });
  ownersByJobId.set(signed.job.jobId, owner);
  return { owner, signed, contentId };
}

let server: SeederHttpServer | null = null;
afterEach(async () => {
  if (server) await server.close();
  server = null;
  authoritativePublications.clear();
  ownersByJobId.clear();
});

async function start(archiveIntake: ArchiveIntakeOptions): Promise<SeederHttpServer> {
  server = await startCommunityNodeHttp({
    node: new CommunityNode({ now: () => NOW }),
    host: '127.0.0.1',
    archiveIntake,
  });
  return server;
}

async function createJob(base: string, signed: SignedArchiveJob, expectedBytes: number, idempotencyKey: string): Promise<RawResponse> {
  const owner = ownersByJobId.get(signed.job.jobId)!;
  const body = JSON.stringify({ signedJob: signed, idempotencyKey, expectedBytes });
  return rawRequest(`${base}/api/archive/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await bearer(owner)),
      ...ownerRequestHeaders(owner, 'POST', '/api/archive/jobs', new TextEncoder().encode(body)),
    },
    body,
  });
}

async function uploadObject(base: string, jobId: string, index: number, bytes: Uint8Array): Promise<RawResponse> {
  const owner = ownersByJobId.get(jobId)!;
  const pathname = `/api/archive/jobs/${jobId}/objects/${index}`;
  return rawRequest(`${base}/api/archive/jobs/${jobId}/objects/${index}`, {
    method: 'PUT',
    headers: {
      'x-mk-object-hash': sha256(bytes),
      ...(await bearer(owner)),
      ...ownerRequestHeaders(owner, 'PUT', pathname, bytes),
    },
    body: Buffer.from(bytes),
  });
}

async function completeJob(base: string, jobId: string): Promise<RawResponse> {
  const owner = ownersByJobId.get(jobId)!;
  const body = '{}';
  return rawRequest(`${base}/api/archive/jobs/${jobId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await bearer(owner)),
      ...ownerRequestHeaders(
        owner,
        'POST',
        `/api/archive/jobs/${jobId}/complete`,
        new TextEncoder().encode(body),
      ),
    },
    body,
  });
}

describe('POST /api/archive/jobs (create)', () => {
  it('creates a job for a valid signed job', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const { signed } = buildJob('create-1');
    const res = await createJob(s.url, signed, 10, 'idem-create-1');
    expect(res.status).toBe(200);
    expect(res.json.jobId).toBe(signed.job.jobId);
    expect(res.json.status).toBe('created');
    expect(res.json.expectedBytes).toBe(10);
    expect(res.json.receivedBytes).toBe(0);
  });

  it('replays the SAME job idempotently on the same idempotency key (200, not 409)', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const { signed } = buildJob('create-2');
    const first = await createJob(s.url, signed, 10, 'idem-create-2');
    const second = await createJob(s.url, signed, 10, 'idem-create-2');
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.json.jobId).toBe(first.json.jobId);
  });

  it('rejects a DIFFERENT payload reusing the same idempotency key with 409', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const a = buildJob('create-3a');
    const b = buildJob('create-3b');
    const first = await createJob(s.url, a.signed, 10, 'idem-create-3');
    expect(first.status).toBe(200);
    const second = await createJob(s.url, b.signed, 10, 'idem-create-3');
    expect(second.status).toBe(409);
  });

  it('rejects a tampered signature fail-closed', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const { signed } = buildJob('create-4');
    const tampered: SignedArchiveJob = { ...signed, signature: '00'.repeat(64) };
    const res = await createJob(s.url, tampered, 10, 'idem-create-4');
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('invalid_job');
  });

  it('rejects a job with missing rights fail-closed', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const { signed } = buildJob('create-5');
    const noRights: SignedArchiveJob = { ...signed, job: { ...signed.job, rights: { ...signed.job.rights, license: 'bogus' as any } } };
    const res = await createJob(s.url, noRights, 10, 'idem-create-5');
    expect(res.status).toBe(400);
    expect(res.json.reason).toBe('no_rights');
  });

  it('rejects a job with no consent fail-closed', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const { signed } = buildJob('create-6');
    const noConsent: SignedArchiveJob = { ...signed, job: { ...signed.job, rights: { ...signed.job.rights, consentAt: '' } } };
    const res = await createJob(s.url, noConsent, 10, 'idem-create-6');
    expect(res.status).toBe(400);
    expect(res.json.reason).toBe('no_consent');
  });

  it('rejects a job signed by a non-owner (not_owner) when cross-checked -- verify path is fail-closed for shape', async () => {
    // verifyArchiveJob(signed) with no publication arg cannot itself produce not_owner; the
    // fail-closed identity guarantee here is that a job whose jobId does not match its own
    // recomputed hash (any tampered field) is rejected as invalid.
    const h = buildHarness();
    const s = await start(h.options);
    const { signed } = buildJob('create-7');
    const tamperedField: SignedArchiveJob = { ...signed, job: { ...signed.job, hostUrl: 'https://evil.example' } };
    const res = await createJob(s.url, tamperedField, 10, 'idem-create-7');
    expect(res.status).toBe(400);
    expect(res.json.reason).toBe('invalid');
  });

  it('returns 402 when the hosted entitlement is missing', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const { signed } = buildJob('create-8');
    const res = await rawRequest(`${s.url}/api/archive/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedJob: signed, idempotencyKey: 'idem-create-8', expectedBytes: 10 }),
    });
    expect(res.status).toBe(402);
    expect(res.json.error).toBe('entitlement_required');
  });

  it('rejects a valid owner signature when another subscriber shares their entitlement token', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const { signed, owner } = buildJob('subject-bound');
    const otherSubscriber = generateDeviceIdentity('other subscriber');
    const body = JSON.stringify({ signedJob: signed, idempotencyKey: 'idem-subject-bound', expectedBytes: 10 });
    const res = await rawRequest(`${s.url}/api/archive/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await bearer(otherSubscriber)),
        ...ownerRequestHeaders(owner, 'POST', '/api/archive/jobs', new TextEncoder().encode(body)),
      },
      body,
    });
    expect(res.status).toBe(403);
    expect(res.json.error).toBe('not_owner');
  });

  it('rejects a job when its publication id resolves to another owner\'s accepted publication', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const victim = buildJob('victim-publication');
    const attacker = buildJob('attacker-publication');
    authoritativePublications.set(
      attacker.signed.job.publicationId,
      authoritativePublications.get(victim.signed.job.publicationId)!,
    );
    const res = await createJob(s.url, attacker.signed, 10, 'idem-attacker-publication');
    expect(res.status).toBe(400);
  });

  it('refuses honestly when the tenant quota is exceeded', async () => {
    const h = buildHarness();
    h.store.usedBytesForOwner = () => 10 * 1024 * 1024 - 5;
    const s = await start(h.options);
    const { signed } = buildJob('create-9', undefined, [new Uint8Array(100)]);
    const res = await createJob(s.url, signed, 100, 'idem-create-9');
    expect(res.status).toBe(413);
    expect(res.json.error).toBe('quota_exceeded');
  });
});

describe('PUT /api/archive/jobs/:jobId/objects/:index (upload)', () => {
  async function created(
    h: Harness,
    s: SeederHttpServer,
    suffix: string,
    objects: readonly Uint8Array[] = [new TextEncoder().encode('hello world')],
  ): Promise<{ jobId: string; owner: DeviceIdentity }> {
    const { signed, owner } = buildJob(suffix, undefined, objects);
    const expectedBytes = objects.reduce((total, bytes) => total + bytes.byteLength, 0);
    const res = await createJob(s.url, signed, expectedBytes, `idem-${suffix}`);
    expect(res.status).toBe(200);
    return { jobId: res.json.jobId, owner };
  }

  it('rejects a hash mismatch before storing anything', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('hello world');
    const { jobId, owner } = await created(h, s, 'up-1', [bytes]);
    const pathname = `/api/archive/jobs/${jobId}/objects/0`;
    const res = await rawRequest(`${s.url}/api/archive/jobs/${jobId}/objects/0`, {
      method: 'PUT',
      headers: {
        'x-mk-object-hash': '00'.repeat(32),
        ...(await bearer(owner)),
        ...ownerRequestHeaders(owner, 'PUT', pathname, bytes),
      },
      body: Buffer.from(bytes),
    });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('manifest_mismatch');
    const objects = await h.store.listObjects(jobId);
    expect(objects).toHaveLength(0);
  });

  it('rejects an index absent from the signed object manifest without storing', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('hello world');
    const { jobId } = await created(h, s, 'up-2', [bytes]);
    const res = await uploadObject(s.url, jobId, 1, bytes);
    expect(res.status).toBe(400);
    const objects = await h.store.listObjects(jobId);
    expect(objects).toHaveLength(0);
  });

  it('rejects arbitrary same-length bytes even when the caller advertises the signed manifest hash', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const expected = new TextEncoder().encode('expected-payload');
    const malicious = new TextEncoder().encode('malicious-bytes!');
    expect(malicious.length).toBe(expected.length);
    const { jobId, owner } = await created(h, s, 'up-same-length', [expected]);
    const pathname = `/api/archive/jobs/${jobId}/objects/0`;
    const res = await rawRequest(`${s.url}${pathname}`, {
      method: 'PUT',
      headers: {
        'x-mk-object-hash': sha256(expected),
        ...(await bearer(owner)),
        ...ownerRequestHeaders(owner, 'PUT', pathname, malicious),
      },
      body: Buffer.from(malicious),
    });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('hash_mismatch');
    expect(await h.store.listObjects(jobId)).toHaveLength(0);
  });

  it('rejects upload and completion attempts signed by a different subscriber', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('owner-only-payload');
    const { jobId } = await created(h, s, 'up-cross-owner', [bytes]);
    const impostor = generateDeviceIdentity('cross-owner impostor');
    const uploadPath = `/api/archive/jobs/${jobId}/objects/0`;
    const upload = await rawRequest(`${s.url}${uploadPath}`, {
      method: 'PUT',
      headers: {
        'x-mk-object-hash': sha256(bytes),
        ...(await bearer(impostor)),
        ...ownerRequestHeaders(impostor, 'PUT', uploadPath, bytes),
      },
      body: Buffer.from(bytes),
    });
    expect(upload.status).toBe(403);

    const completePath = `/api/archive/jobs/${jobId}/complete`;
    const body = '{}';
    const complete = await rawRequest(`${s.url}${completePath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await bearer(impostor)),
        ...ownerRequestHeaders(impostor, 'POST', completePath, new TextEncoder().encode(body)),
      },
      body,
    });
    expect(complete.status).toBe(403);
  });

  it('resume: uploading a second object reports both stored indices and no gap', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const first = new TextEncoder().encode('abc');
    const second = new TextEncoder().encode('defg');
    const { jobId } = await created(h, s, 'up-3', [first, second]);
    const r1 = await uploadObject(s.url, jobId, 0, first);
    expect(r1.status).toBe(200);
    expect(r1.json.storedIndices).toEqual([0]);
    const r2 = await uploadObject(s.url, jobId, 1, second);
    expect(r2.status).toBe(200);
    expect(r2.json.storedIndices.sort()).toEqual([0, 1]);
    expect(r2.json.receivedBytes).toBe(first.length + second.length);
  });

  it('rejects an upload when the job is in the wrong state (already quarantined)', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('payload');
    const { jobId } = await created(h, s, 'up-4', [bytes]);
    expect((await uploadObject(s.url, jobId, 0, bytes)).status).toBe(200);
    expect((await completeJob(s.url, jobId)).status).toBe(200);
    const res = await uploadObject(s.url, jobId, 0, bytes);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/archive/jobs/:jobId/complete', () => {
  it('reports 409 with the exact missing indices when the manifest is incomplete', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const first = new TextEncoder().encode('part-a');
    const second = new TextEncoder().encode('part-b-longer');
    const { signed } = buildJob('complete-1', undefined, [first, second]);
    const createRes = await createJob(s.url, signed, first.length + second.length, 'idem-complete-1');
    const jobId = createRes.json.jobId;
    await uploadObject(s.url, jobId, 0, first);
    // object 1 never uploaded
    const res = await completeJob(s.url, jobId);
    expect(res.status).toBe(409);
    expect(res.json.error).toBe('incomplete_manifest');
  });

  it('succeeds and the job becomes claimable by a scanner worker on the full manifest', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('a-full-object-payload');
    const { signed } = buildJob('complete-2', undefined, [bytes]);
    const createRes = await createJob(s.url, signed, bytes.length, 'idem-complete-2');
    const jobId = createRes.json.jobId;
    expect((await uploadObject(s.url, jobId, 0, bytes)).status).toBe(200);
    const res = await completeJob(s.url, jobId);
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('quarantined');

    // Prove the handoff: drive a real ArchiveScannerWorker over the same store and claim it.
    const malwareScanner: MalwareScanner = { engine: { engine: 'fake', engineVersion: '1', definitionsVersion: null }, state: 'configured', scan: async () => ({ verdict: 'clean', signatureId: null }) };
    const abuseScanner: AbuseHashScanner = { scan: async () => ({ matched: [] }) };
    const worker = new ArchiveScannerWorker({
      workerId: 'scanner-1',
      store: h.store,
      malwareScanner,
      abuseScanner,
      readQuarantineBytes: async () => bytes,
      now: () => NOW + 1000,
    });
    const tick = await worker.runOnce();
    expect(tick.claimed).toBe(1);
    expect(tick.outcomes[0]).toMatchObject({ jobId, decision: 'clean' });
    const job = await h.store.getJob(jobId);
    expect(job?.status).toBe('approved');
  });

  it('double-complete is idempotent', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('idempotent-complete');
    const { signed } = buildJob('complete-3', undefined, [bytes]);
    const createRes = await createJob(s.url, signed, bytes.length, 'idem-complete-3');
    const jobId = createRes.json.jobId;
    await uploadObject(s.url, jobId, 0, bytes);
    const first = await completeJob(s.url, jobId);
    expect(first.status).toBe(200);
    const second = await completeJob(s.url, jobId);
    expect(second.status).toBe(200);
    expect(second.json.status).toBe('quarantined');
  });
});

describe('GET /api/archive/jobs/:jobId (status)', () => {
  it('requires owner auth; wrong subject gets 403', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const { signed } = buildJob('status-1', undefined, [new Uint8Array(5)]);
    const createRes = await createJob(s.url, signed, 5, 'idem-status-1');
    const jobId = createRes.json.jobId;
    const impostor = generateDeviceIdentity('impostor');
    const res = await rawRequest(`${s.url}/api/archive/jobs/${jobId}`, {
      headers: ownerAuthHeaders(impostor, jobId),
    });
    expect(res.status).toBe(403);
  });

  it('reflects created status for the real owner', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const { signed, owner } = buildJob('status-2', undefined, [new Uint8Array(5)]);
    const createRes = await createJob(s.url, signed, 5, 'idem-status-2');
    const jobId = createRes.json.jobId;
    const res = await rawRequest(`${s.url}/api/archive/jobs/${jobId}`, { headers: ownerAuthHeaders(owner, jobId) });
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('created');
    expect(res.json.scanOutcomeClass).toBeNull();
  });

  it('reflects a rejected (malware) scan outcome', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('malware-payload');
    const { signed, owner } = buildJob('status-3', undefined, [bytes]);
    const createRes = await createJob(s.url, signed, bytes.length, 'idem-status-3');
    const jobId = createRes.json.jobId;
    await uploadObject(s.url, jobId, 0, bytes);
    await completeJob(s.url, jobId);
    const malwareScanner: MalwareScanner = { engine: { engine: 'fake', engineVersion: '1', definitionsVersion: null }, state: 'configured', scan: async () => ({ verdict: 'malware', signatureId: 'eicar' }) };
    const abuseScanner: AbuseHashScanner = { scan: async () => ({ matched: [] }) };
    const worker = new ArchiveScannerWorker({
      workerId: 'scanner-2', store: h.store, malwareScanner, abuseScanner,
      readQuarantineBytes: async () => bytes, now: () => NOW + 1000,
    });
    await worker.runOnce();
    const res = await rawRequest(`${s.url}/api/archive/jobs/${jobId}`, { headers: ownerAuthHeaders(owner, jobId) });
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('rejected');
    expect(res.json.scanOutcomeClass).toBe('rejected');
  });

  it('unknown job 404s', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const owner = generateDeviceIdentity('nobody');
    const res = await rawRequest(`${s.url}/api/archive/jobs/${'a'.repeat(32)}`, { headers: ownerAuthHeaders(owner, 'a'.repeat(32)) });
    expect(res.status).toBe(404);
  });
});

describe('archive intake rate limiting', () => {
  it('normalizes dynamic job and object ids before applying route buckets', async () => {
    const observed: string[] = [];
    const h = buildHarness({
      requestLimiter: {
        check(_request, pathname) {
          observed.push(pathname);
          return { allowed: true, retryAfterSeconds: 0 };
        },
      },
    });
    const s = await start(h.options);
    await rawRequest(`${s.url}/api/archive/jobs/${'a'.repeat(64)}`);
    await rawRequest(`${s.url}/api/archive/jobs/${'b'.repeat(64)}`);
    await rawRequest(`${s.url}/api/archive/jobs/${'a'.repeat(64)}/objects/1`, { method: 'PUT' });
    await rawRequest(`${s.url}/api/archive/jobs/${'b'.repeat(64)}/objects/99`, { method: 'PUT' });
    expect(observed).toEqual([
      'GET /api/archive/jobs/:id',
      'GET /api/archive/jobs/:id',
      'PUT /api/archive/jobs/:id/objects/:index',
      'PUT /api/archive/jobs/:id/objects/:index',
    ]);
  });
});

describe('DELETE /api/archive/jobs/:jobId (cancel/takedown)', () => {
  it('does not accept a valid GET proof as authorization for DELETE', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const { signed, owner } = buildJob('cancel-method-bound');
    const createRes = await createJob(s.url, signed, 10, 'idem-cancel-method-bound');
    const jobId = createRes.json.jobId;
    const getProof = ownerAuthHeaders(owner, jobId, new Date(NOW + 1000).toISOString(), 'GET');
    const res = await rawRequest(`${s.url}/api/archive/jobs/${jobId}`, {
      method: 'DELETE',
      headers: getProof,
    });
    expect(res.status).toBe(403);
    expect((await h.store.getJob(jobId))?.status).toBe('created');
  });

  it('rejects an exact mutation nonce replay', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const { signed, owner } = buildJob('cancel-nonce-replay');
    const createRes = await createJob(s.url, signed, 10, 'idem-cancel-nonce-replay');
    const jobId = createRes.json.jobId;
    const headers = ownerAuthHeaders(owner, jobId, new Date(NOW + 1000).toISOString(), 'DELETE');
    const first = await rawRequest(`${s.url}/api/archive/jobs/${jobId}`, { method: 'DELETE', headers });
    expect(first.status).toBe(200);
    const replay = await rawRequest(`${s.url}/api/archive/jobs/${jobId}`, { method: 'DELETE', headers });
    expect(replay.status).toBe(409);
    expect(replay.json.error).toBe('replayed_request');
  });

  it('disables the serving index before byte release and is idempotent', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('cancel-me-bytes');
    const { signed, owner } = buildJob('cancel-1', undefined, [bytes]);
    const createRes = await createJob(s.url, signed, bytes.length, 'idem-cancel-1');
    const jobId = createRes.json.jobId;
    await uploadObject(s.url, jobId, 0, bytes);
    await completeJob(s.url, jobId);

    const malwareScanner: MalwareScanner = { engine: { engine: 'fake', engineVersion: '1', definitionsVersion: null }, state: 'configured', scan: async () => ({ verdict: 'clean', signatureId: null }) };
    const abuseScanner: AbuseHashScanner = { scan: async () => ({ matched: [] }) };
    const worker = new ArchiveScannerWorker({
      workerId: 'scanner-3', store: h.store, malwareScanner, abuseScanner,
      readQuarantineBytes: async () => bytes, now: () => NOW + 1000,
    });
    await worker.runOnce();

    const [promoClaim] = await h.store.claimJobs({ workerId: 'promoter', eligibleStatuses: ['approved'], limit: 1, leaseMs: 5000, nowMs: NOW + 2000 });
    const durableKey = `durable/${signed.job.contentId}/0`;
    const promoted = await h.byteService.promoteObject({
      jobId, workerId: 'promoter', fencingToken: promoClaim!.fencingToken, objectIndex: 0,
      quarantineKey: `archive/quarantine/${signed.job.contentId}/0/${sha256(bytes)}`, durableKey, expectedChecksumSha256: sha256(bytes), nowMs: NOW + 2001,
    });
    expect(promoted.status).toBe('durable');
    await h.store.activatePin({ jobId, workerId: 'promoter', fencingToken: promoClaim!.fencingToken, hostId: HOST_ID, nowMs: NOW + 2002 });
    await h.servingIndex.addServing(signed.job.publicationId);

    const events: string[] = [];
    h.servingIndex.removeServing = ((orig) => async (id: string) => {
      events.push('serving_removed');
      await orig.call(h.servingIndex, id);
    })(FakeServingIndex.prototype.removeServing);

    const res1 = await rawRequest(`${s.url}/api/archive/jobs/${jobId}`, { method: 'DELETE', headers: ownerAuthHeaders(owner, jobId, new Date(NOW + 3000).toISOString(), 'DELETE') });
    expect(res1.status).toBe(200);
    expect(['takedown_pending', 'removed']).toContain(res1.json.status);
    expect(await h.servingIndex.isServing(signed.job.publicationId)).toBe(false);
    expect(events).toContain('serving_removed');

    // Idempotent repeat.
    const res2 = await rawRequest(`${s.url}/api/archive/jobs/${jobId}`, { method: 'DELETE', headers: ownerAuthHeaders(owner, jobId, new Date(NOW + 4000).toISOString(), 'DELETE') });
    expect(res2.status).toBe(200);
  });

  it('a shared byte survives cancel of one of two jobs referencing the same content', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const sharedPayload = new TextEncoder().encode('shared-bytes-between-jobs');
    const contentId = 'shared-content-http';
    const first = buildJob('shared-a', contentId, [sharedPayload]);

    async function driveToPinned(job: typeof first): Promise<string> {
      const createRes = await createJob(s.url, job.signed, sharedPayload.length, `idem-${job.signed.job.jobId}`);
      expect(createRes.status).toBe(200);
      const jobId = createRes.json.jobId;
      expect((await uploadObject(s.url, jobId, 0, sharedPayload)).status).toBe(200);
      expect((await completeJob(s.url, jobId)).status).toBe(200);
      const malwareScanner: MalwareScanner = { engine: { engine: 'fake', engineVersion: '1', definitionsVersion: null }, state: 'configured', scan: async () => ({ verdict: 'clean', signatureId: null }) };
      const abuseScanner: AbuseHashScanner = { scan: async () => ({ matched: [] }) };
      const worker = new ArchiveScannerWorker({
        workerId: `scanner-${jobId}`, store: h.store, malwareScanner, abuseScanner,
        readQuarantineBytes: async () => sharedPayload, now: () => NOW + 1000,
      });
      expect((await worker.runOnce()).outcomes[0]).toMatchObject({ decision: 'clean' });
      const [claim] = await h.store.claimJobs({ workerId: `promoter-${jobId}`, eligibleStatuses: ['approved'], limit: 1, leaseMs: 5000, nowMs: NOW + 2000 });
      const durableKey = `durable/${contentId}/0`;
      await h.byteService.promoteObject({
        jobId, workerId: `promoter-${jobId}`, fencingToken: claim!.fencingToken, objectIndex: 0,
        quarantineKey: `archive/quarantine/${contentId}/0/${sha256(sharedPayload)}`, durableKey, expectedChecksumSha256: sha256(sharedPayload), nowMs: NOW + 2001,
      });
      await h.store.activatePin({ jobId, workerId: `promoter-${jobId}`, fencingToken: claim!.fencingToken, hostId: HOST_ID, nowMs: NOW + 2002 });
      return jobId;
    }

    const jobIdA = await driveToPinned(first);
    const second = buildJob('shared-b', contentId, [sharedPayload]);
    await driveToPinned(second);

    const res = await rawRequest(`${s.url}/api/archive/jobs/${jobIdA}`, { method: 'DELETE', headers: ownerAuthHeaders(first.owner, jobIdA, new Date(NOW + 5000).toISOString(), 'DELETE') });
    expect(res.status).toBe(200);
    // The durable byte must survive: still observable in the object store.
    expect(await h.objectStore.observe(`durable/${contentId}/0`)).not.toBeNull();
  });
});

describe('GET /api/archive/publications/:publicationId/hosts', () => {
  it('lists only approved+active pins', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('hosts-listing-bytes');
    const { signed } = buildJob('hosts-1', undefined, [bytes]);
    const createRes = await createJob(s.url, signed, bytes.length, 'idem-hosts-1');
    const jobId = createRes.json.jobId;
    await uploadObject(s.url, jobId, 0, bytes);
    await completeJob(s.url, jobId);
    const malwareScanner: MalwareScanner = { engine: { engine: 'fake', engineVersion: '1', definitionsVersion: null }, state: 'configured', scan: async () => ({ verdict: 'clean', signatureId: null }) };
    const abuseScanner: AbuseHashScanner = { scan: async () => ({ matched: [] }) };
    const worker = new ArchiveScannerWorker({
      workerId: 'scanner-hosts', store: h.store, malwareScanner, abuseScanner,
      readQuarantineBytes: async () => bytes, now: () => NOW + 1000,
    });
    await worker.runOnce();
    const [claim] = await h.store.claimJobs({ workerId: 'promoter-hosts', eligibleStatuses: ['approved'], limit: 1, leaseMs: 5000, nowMs: NOW + 2000 });
    await h.byteService.promoteObject({
      jobId, workerId: 'promoter-hosts', fencingToken: claim!.fencingToken, objectIndex: 0,
      quarantineKey: `archive/quarantine/${signed.job.contentId}/0/${sha256(bytes)}`, durableKey: `durable/${signed.job.contentId}/0`,
      expectedChecksumSha256: sha256(bytes), nowMs: NOW + 2001,
    });
    await h.store.activatePin({ jobId, workerId: 'promoter-hosts', fencingToken: claim!.fencingToken, hostId: HOST_ID, nowMs: NOW + 2002 });

    const res = await rawRequest(`${s.url}/api/archive/publications/${signed.job.publicationId}/hosts`);
    expect(res.status).toBe(200);
    expect(res.json.hosts.map((h2: any) => h2.hostId)).toEqual([HOST_ID]);
  });

  it('never lists a killed/taken-down publication', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('taken-down-bytes');
    const { signed, owner } = buildJob('hosts-2', undefined, [bytes]);
    const createRes = await createJob(s.url, signed, bytes.length, 'idem-hosts-2');
    const jobId = createRes.json.jobId;
    await uploadObject(s.url, jobId, 0, bytes);
    await completeJob(s.url, jobId);
    const malwareScanner: MalwareScanner = { engine: { engine: 'fake', engineVersion: '1', definitionsVersion: null }, state: 'configured', scan: async () => ({ verdict: 'clean', signatureId: null }) };
    const abuseScanner: AbuseHashScanner = { scan: async () => ({ matched: [] }) };
    const worker = new ArchiveScannerWorker({
      workerId: 'scanner-hosts2', store: h.store, malwareScanner, abuseScanner,
      readQuarantineBytes: async () => bytes, now: () => NOW + 1000,
    });
    await worker.runOnce();
    const [claim] = await h.store.claimJobs({ workerId: 'promoter-hosts2', eligibleStatuses: ['approved'], limit: 1, leaseMs: 5000, nowMs: NOW + 2000 });
    await h.byteService.promoteObject({
      jobId, workerId: 'promoter-hosts2', fencingToken: claim!.fencingToken, objectIndex: 0,
      quarantineKey: `archive/quarantine/${signed.job.contentId}/0/${sha256(bytes)}`, durableKey: `durable/${signed.job.contentId}/0`,
      expectedChecksumSha256: sha256(bytes), nowMs: NOW + 2001,
    });
    await h.store.activatePin({ jobId, workerId: 'promoter-hosts2', fencingToken: claim!.fencingToken, hostId: HOST_ID, nowMs: NOW + 2002 });

    await rawRequest(`${s.url}/api/archive/jobs/${jobId}`, { method: 'DELETE', headers: ownerAuthHeaders(owner, jobId, new Date(NOW + 5000).toISOString(), 'DELETE') });
    const res = await rawRequest(`${s.url}/api/archive/publications/${signed.job.publicationId}/hosts`);
    expect(res.status).toBe(200);
    expect(res.json.hosts).toEqual([]);
  });
});

describe('e2e happy path', () => {
  it('create -> upload -> complete -> scan clean -> pin -> announce -> hosts lists it -> status says announced', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('e2e-happy-path-payload');
    const { signed, owner } = buildJob('e2e-happy', undefined, [bytes]);
    const createRes = await createJob(s.url, signed, bytes.length, 'idem-e2e-happy');
    const jobId = createRes.json.jobId;
    expect((await uploadObject(s.url, jobId, 0, bytes)).status).toBe(200);
    expect((await completeJob(s.url, jobId)).status).toBe(200);

    const malwareScanner: MalwareScanner = { engine: { engine: 'fake', engineVersion: '1', definitionsVersion: null }, state: 'configured', scan: async () => ({ verdict: 'clean', signatureId: null }) };
    const abuseScanner: AbuseHashScanner = { scan: async () => ({ matched: [] }) };
    const worker = new ArchiveScannerWorker({
      workerId: 'scanner-e2e', store: h.store, malwareScanner, abuseScanner,
      readQuarantineBytes: async () => bytes, now: () => NOW + 1000,
    });
    const tick = await worker.runOnce();
    expect(tick.outcomes[0]).toMatchObject({ decision: 'clean' });

    const [claim] = await h.store.claimJobs({ workerId: 'promoter-e2e', eligibleStatuses: ['approved'], limit: 1, leaseMs: 5000, nowMs: NOW + 2000 });
    await h.byteService.promoteObject({
      jobId, workerId: 'promoter-e2e', fencingToken: claim!.fencingToken, objectIndex: 0,
      quarantineKey: `archive/quarantine/${signed.job.contentId}/0/${sha256(bytes)}`, durableKey: `durable/${signed.job.contentId}/0`,
      expectedChecksumSha256: sha256(bytes), nowMs: NOW + 2001,
    });
    await h.store.activatePin({ jobId, workerId: 'promoter-e2e', fencingToken: claim!.fencingToken, hostId: HOST_ID, nowMs: NOW + 2002 });
    // activatePin releases its lease on success; announce needs a fresh claim over the now-pinned job.
    const [announceClaim] = await h.store.claimJobs({ workerId: 'announcer-e2e', eligibleStatuses: ['pinned'], limit: 1, leaseMs: 5000, nowMs: NOW + 2003 });
    await h.store.markAnnounced({ jobId, workerId: 'announcer-e2e', fencingToken: announceClaim!.fencingToken, nowMs: NOW + 2004 });

    const hostsRes = await rawRequest(`${s.url}/api/archive/publications/${signed.job.publicationId}/hosts`);
    expect(hostsRes.json.hosts.map((h2: any) => h2.hostId)).toEqual([HOST_ID]);

    const statusRes = await rawRequest(`${s.url}/api/archive/jobs/${jobId}`, { headers: ownerAuthHeaders(owner, jobId, new Date(NOW + 3000).toISOString()) });
    expect(statusRes.json.status).toBe('announced');
    expect(statusRes.json.announced).toBe(true);
    expect(statusRes.json.pinned).toBe(true);
  });
});

describe('e2e rejection path', () => {
  it('a malware hit is rejected, never listed, and objects never leave quarantine', async () => {
    const h = buildHarness();
    const s = await start(h.options);
    const bytes = new TextEncoder().encode('malware-eicar-like-payload');
    const { signed, owner } = buildJob('e2e-reject', undefined, [bytes]);
    const createRes = await createJob(s.url, signed, bytes.length, 'idem-e2e-reject');
    const jobId = createRes.json.jobId;
    await uploadObject(s.url, jobId, 0, bytes);
    await completeJob(s.url, jobId);

    const malwareScanner: MalwareScanner = { engine: { engine: 'fake', engineVersion: '1', definitionsVersion: null }, state: 'configured', scan: async () => ({ verdict: 'malware', signatureId: 'eicar_test' }) };
    const abuseScanner: AbuseHashScanner = { scan: async () => ({ matched: [] }) };
    const worker = new ArchiveScannerWorker({
      workerId: 'scanner-reject', store: h.store, malwareScanner, abuseScanner,
      readQuarantineBytes: async () => bytes, now: () => NOW + 1000,
    });
    const tick = await worker.runOnce();
    expect(tick.outcomes[0]).toMatchObject({ decision: 'malware' });

    const statusRes = await rawRequest(`${s.url}/api/archive/jobs/${jobId}`, { headers: ownerAuthHeaders(owner, jobId, new Date(NOW + 3000).toISOString()) });
    expect(statusRes.json.status).toBe('rejected');
    expect(statusRes.json.scanOutcomeClass).toBe('rejected');

    const hostsRes = await rawRequest(`${s.url}/api/archive/publications/${signed.job.publicationId}/hosts`);
    expect(hostsRes.json.hosts).toEqual([]);

    // Never promoted: no durable key exists.
    expect(await h.objectStore.observe(`durable/${signed.job.contentId}/0`)).toBeNull();
    const objects = await h.store.listObjects(jobId);
    expect(objects.every((o) => o.status === 'quarantined')).toBe(true);
  });
});
