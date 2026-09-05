/**
 * Plan 51 P2/P4: the anonymous-credential gate on managed archive intake, running
 * ALONGSIDE the existing owner proof (never replacing it), and the enforcement
 * chain over a captured archive serial.
 *
 * Real /api/archive/jobs surface over a real node:http listener with the in-memory
 * lifecycle substrate; real credential issuance/verification. Coverage:
 *  - owner proof + valid credential -> created; serial captured as evidence;
 *  - owner proof present but credential forged/expired/revoked -> refused;
 *  - owner proof present, NO credential presented while a verifier is wired ->
 *    refused (the credential is required when configured);
 *  - with NO verifier wired, legacy behavior is byte-identical (owner proof only);
 *  - enforcement chain: create with credential -> revoke serial -> the same
 *    credential refused on a later create; no account-shaped field anywhere.
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
  publicPostNodeKeypairFromSeed,
  credentialEpochWindow,
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
  archiveOwnerSubjectHash,
  type ArchiveIntakeOptions,
} from '../archive-intake-http';
import { InMemoryObjectStore } from '../object-store-memory';
import { InMemoryArchiveLifecycleStore } from '../archive-lifecycle';
import { InMemoryObjectReferenceLedger } from '../object-reference-ledger-memory';
import { InMemoryObjectDeletionJobStore } from '../object-deletion-jobs-memory';
import { ArchiveObjectByteService } from '../archive-object-bytes';
import { FakeServingIndex } from './support/archive-pin-fixtures';
import {
  InMemoryCredentialEvidenceSink,
  InMemoryCredentialRevocationSink,
  OperatorConsoleService,
  InMemoryOperatorConsoleStore,
} from '../index';
import {
  CredentialTestAuthority,
  EPOCH_0,
  NOW_MS_IN_EPOCH_0,
} from './support/credential-test-harness';

const NOW = Date.parse('2026-07-12T00:00:00.000Z');
const ENTITLEMENT_SECRET = 'archive-intake-secret';
const HOST_ID = 'archive-host-1';
const OPERATOR = publicPostNodeKeypairFromSeed('99'.repeat(32));

interface RawResponse { status: number; json: any }
function rawRequest(url: string, init: { method?: string; headers?: Record<string, string>; body?: Buffer | string } = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers ?? {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json: any = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = text; }
        resolve({ status: res.statusCode ?? 500, json });
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

const authoritativePublications = new Map<string, { signed: ReturnType<typeof createPublication>; objects: SignedArchiveJob['job']['objects'] }>();
const ownersByJobId = new Map<string, DeviceIdentity>();
let nonceCounter = 0;

async function bearer(owner: DeviceIdentity): Promise<Record<string, string>> {
  const issued = await issueMeerkatHostedEntitlement({ secret: ENTITLEMENT_SECRET, subjectId: owner.publicKey, features: [MEERKAT_HOSTED_STORAGE_FEATURE] });
  return { Authorization: `Bearer ${issued.token}` };
}

function ownerRequestHeaders(owner: DeviceIdentity, method: string, pathname: string, body: Uint8Array): Record<string, string> {
  const ts = new Date(NOW).toISOString();
  nonceCounter += 1;
  const nonce = sha256(new TextEncoder().encode(`${owner.publicKey}:${ts}:${nonceCounter}`));
  const bytes = new TextEncoder().encode(JSON.stringify(['meerkat-archive-request-auth-v2', method, pathname, ts, nonce, sha256(body)]));
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(owner.privateKeyRef), bytes));
  return { 'x-mk-ts': ts, 'x-mk-nonce': nonce, 'x-mk-owner-sig': signature };
}

function buildJob(suffix: string): { owner: DeviceIdentity; signed: SignedArchiveJob } {
  const owner = generateDeviceIdentity(`Archive owner ${suffix}`);
  const publication = createPublication(owner, {
    kind: 'channel', communityId: `community-${suffix}`, channelId: `channel-${suffix}`, postId: null,
    title: `Archive ${suffix}`, description: 'test', category: 'technology', contentId: `content-${suffix}`,
    publicKeyHex: 'aabbccddeeff00', hostUrls: ['https://archive.example'], joinPolicy: 'open', now: new Date(NOW).toISOString(),
  });
  const objectBytes = [new Uint8Array(10)];
  const signed = createArchiveJob(owner, publication, {
    tier: 'managed', hostUrl: 'https://archive.example',
    objects: objectBytes.map((b, index) => ({ index, hash: sha256(b), size: b.byteLength })),
    rights: { license: 'cc_by', rightsAssertion: 'i_own', provenance: 'owner-created', consentAt: new Date(NOW).toISOString() },
    now: new Date(NOW).toISOString(),
  });
  authoritativePublications.set(publication.descriptor.publicationId, { signed: publication, objects: signed.job.objects });
  ownersByJobId.set(signed.job.jobId, owner);
  return { owner, signed };
}

let server: SeederHttpServer | null = null;
afterEach(async () => {
  if (server) await server.close();
  server = null;
  authoritativePublications.clear();
  ownersByJobId.clear();
});

function buildOptions(overrides: Partial<ArchiveIntakeOptions> = {}): ArchiveIntakeOptions {
  const objectStore = new InMemoryObjectStore();
  const store = new InMemoryArchiveLifecycleStore();
  const ledger = new InMemoryObjectReferenceLedger();
  const deletionJobs = new InMemoryObjectDeletionJobStore();
  const byteService = new ArchiveObjectByteService(objectStore, store, ledger);
  return {
    store, byteService, servingIndex: new FakeServingIndex(), referenceLedger: ledger, deletionJobs,
    probeAbsence: async (durableKey) => (await objectStore.observe(durableKey)) === null,
    entitlementSecret: ENTITLEMENT_SECRET,
    quota: { capBytes: () => 10 * 1024 * 1024 },
    resolvePublication: (publicationId) => authoritativePublications.get(publicationId) ?? null,
    nonceStore: new InMemoryArchiveRequestNonceStore(() => NOW),
    hostId: HOST_ID, now: () => NOW,
    ...overrides,
  };
}

async function start(options: ArchiveIntakeOptions): Promise<SeederHttpServer> {
  server = await startCommunityNodeHttp({ node: new CommunityNode({ now: () => NOW }), host: '127.0.0.1', archiveIntake: options });
  return server;
}

async function createJob(base: string, signed: SignedArchiveJob, idem: string, extraHeaders: Record<string, string> = {}): Promise<RawResponse> {
  const owner = ownersByJobId.get(signed.job.jobId)!;
  const body = JSON.stringify({ signedJob: signed, idempotencyKey: idem, expectedBytes: 10 });
  return rawRequest(`${base}/api/archive/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await bearer(owner)),
      ...ownerRequestHeaders(owner, 'POST', '/api/archive/jobs', new TextEncoder().encode(body)),
      ...extraHeaders,
    },
    body,
  });
}

describe('Plan 51 P2: credential gate on archive intake (alongside owner proof)', () => {
  it('owner proof + valid credential -> created; serial captured as evidence', async () => {
    const evidence = new InMemoryCredentialEvidenceSink();
    const authority = new CredentialTestAuthority();
    const s = await start(buildOptions({ credentialVerifier: authority.verifier(NOW_MS_IN_EPOCH_0), credentialEvidence: evidence }));
    const { owner, signed } = buildJob('cred-1');
    const { bearer: cred, serial } = authority.mint(EPOCH_0);
    const res = await createJob(s.url, signed, 'idem-cred-1', { 'x-mk-credential': cred });
    expect(res.status).toBe(200);
    expect(res.json.jobId).toBe(signed.job.jobId);
    const rows = evidence.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.serial).toBe(serial);
    expect(rows[0]!.subject).toBe(archiveOwnerSubjectHash(owner.publicKey));
    expect(rows[0]!.surface).toBe('archive_intake');
  });

  it('owner proof present but a MISSING credential (verifier wired) -> refused', async () => {
    const authority = new CredentialTestAuthority();
    const s = await start(buildOptions({ credentialVerifier: authority.verifier(NOW_MS_IN_EPOCH_0) }));
    const { signed } = buildJob('cred-2');
    const res = await createJob(s.url, signed, 'idem-cred-2'); // no x-mk-credential
    expect(res.status).toBe(401);
    expect(res.json.error).toBe('credential_invalid');
    expect(res.json.reason).toBe('missing');
  });

  it('forged / revoked credentials are refused with honest reasons', async () => {
    const authority = new CredentialTestAuthority();
    const s = await start(buildOptions({ credentialVerifier: authority.verifier(NOW_MS_IN_EPOCH_0) }));
    const forged = await createJob(s.url, buildJob('cred-3a').signed, 'idem-cred-3a', { 'x-mk-credential': 'garbage' });
    expect(forged.status).toBe(401);
    expect(forged.json.reason).toBe('invalid');

    const { bearer: cred, serial } = authority.mint(EPOCH_0);
    authority.revoke(serial, EPOCH_0, 'test');
    const revoked = await createJob(s.url, buildJob('cred-3b').signed, 'idem-cred-3b', { 'x-mk-credential': cred });
    expect(revoked.status).toBe(401);
    expect(revoked.json.reason).toBe('revoked');
  });

  it('expired credential -> refused', async () => {
    const wayLater = credentialEpochWindow(EPOCH_0).notAfterMs + 60_000;
    const authority = new CredentialTestAuthority();
    const s = await start(buildOptions({ credentialVerifier: authority.verifier(wayLater) }));
    const { bearer: cred } = authority.mint(EPOCH_0);
    const res = await createJob(s.url, buildJob('cred-4').signed, 'idem-cred-4', { 'x-mk-credential': cred });
    expect(res.status).toBe(401);
    expect(res.json.reason).toBe('expired');
  });

  it('with NO verifier wired, legacy behavior is byte-identical (owner proof only, no credential needed)', async () => {
    const s = await start(buildOptions()); // no credentialVerifier
    const { signed } = buildJob('legacy-1');
    // The same create with no credential header succeeds exactly as before.
    const res = await createJob(s.url, signed, 'idem-legacy-1');
    expect(res.status).toBe(200);
    expect(res.json.jobId).toBe(signed.job.jobId);
    // And an ignored credential header does not change the outcome.
    const withHeader = await createJob(s.url, signed, 'idem-legacy-1', { 'x-mk-credential': 'ignored' });
    expect(withHeader.status).toBe(200);
  });
});

describe('Plan 51 P4 (AC-3): archive enforcement chain', () => {
  it('create with credential -> revoke serial -> the same credential refused; no account field', async () => {
    const evidence = new InMemoryCredentialEvidenceSink();
    const authority = new CredentialTestAuthority();
    const s = await start(buildOptions({ credentialVerifier: authority.verifier(NOW_MS_IN_EPOCH_0), credentialEvidence: evidence }));
    const { bearer: cred, serial } = authority.mint(EPOCH_0);

    const first = await createJob(s.url, buildJob('enf-1').signed, 'idem-enf-1', { 'x-mk-credential': cred });
    expect(first.status).toBe(200);
    const captured = evidence.list();
    expect(captured).toHaveLength(1);
    expect(captured[0]!.serial).toBe(serial);

    const revocationSink = new InMemoryCredentialRevocationSink();
    const console_ = new OperatorConsoleService({
      node: {
        recordPublicPostTombstone: async () => ({ ok: true }),
        recordPostingFreeze: async () => ({ ok: true }),
        recordPublicationKill: async () => true,
      },
      publications: { get: async () => null, list: async () => [] },
      reports: { get: async () => [] },
      posts: { listPosts: async () => [], listTombstones: async () => [], getFreeze: async () => null },
      store: new InMemoryOperatorConsoleStore(),
      operator: { publicKeyHex: OPERATOR.publicKeyHex, privateKeyHex: OPERATOR.privateKeyHex },
      credentialRevocation: { revokeSerial: (sr, e, r) => { revocationSink.revokeSerial(sr, e, r); authority.revoke(sr, e, r); } },
    });
    const revoke = await console_.revokeCredentialSerial({ serial, epoch: captured[0]!.epoch, reasonCode: 'repeat_infringer' });
    expect(revoke.ok).toBe(true);

    // The same credential presented on a NEW job is now refused 'revoked'.
    const refused = await createJob(s.url, buildJob('enf-2').signed, 'idem-enf-2', { 'x-mk-credential': cred });
    expect(refused.status).toBe(401);
    expect(refused.json.reason).toBe('revoked');

    const scanForAccountKeys = (value: unknown): void => {
      const keys = (JSON.stringify(value).match(/"([^"]+)"\s*:/g) ?? []);
      for (const key of keys) expect(key).not.toMatch(/account/i);
    };
    scanForAccountKeys(evidence.list());
    scanForAccountKeys(revoke.audit);
  });
});
