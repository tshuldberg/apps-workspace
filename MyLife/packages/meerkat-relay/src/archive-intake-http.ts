/**
 * Managed archive job intake HTTP surface (Plan 43 WP-43E).
 *
 * Binds a client's signed archive job (protocol/public-archive.ts) to the durable hosted
 * lifecycle (archive-lifecycle.ts) over HTTP. The lifecycle store, storage ingest byte path
 * (archive-object-bytes.ts), scanner worker, and takedown propagator already exist; this module is
 * the missing HTTP glue: create a job, bind resumable uploads to it, complete it into scanning,
 * poll authoritative status, and cancel/takedown it. Mounted on the community-node HTTP surface
 * (community-node-http.ts) -- NOT the slim relay image (bin/meerkat-relay-server.mjs ->
 * src/server.ts), which must gain no new imports from this graph (/healthz is never extended).
 *
 * Routes (mounted under /api/archive):
 *   POST   /api/archive/jobs                              create (idempotent)
 *   PUT    /api/archive/jobs/:jobId/objects/:index         resumable quarantine upload
 *   POST   /api/archive/jobs/:jobId/complete               manifest-complete -> quarantined
 *   GET    /api/archive/jobs/:jobId                        owner-authenticated status
 *   DELETE /api/archive/jobs/:jobId                        owner cancel/takedown
 *   GET    /api/archive/publications/:publicationId/hosts  public: approved+active pins only
 *
 * Invariants enforced here (mirrored in archive-intake-http.test.ts):
 *  - NC-43.1: no route here ever makes a pending/scanning/review_required/failed object serveable;
 *    only the scanner worker's fenced completeScan decides that (this module never calls it).
 *  - NC-43.2: status responses carry ONLY store-derived state -- the client's claimed status in the
 *    signed job is never echoed back as fact.
 *  - No fabricated status: an unavailable store/object backend surfaces an honest 5xx with a stable
 *    error code, never a fake success (thrown ObjectStoreUnavailableError / PostgresStoreUnavailableError
 *    propagate to the shared community-node-http 503 handler).
 *  - Zero-knowledge: logs carry counts/codes/opaque ids only, never member/device identity or bytes.
 */

import type http from 'node:http';
import { createHash } from 'node:crypto';
import {
  hexToBytes,
  deriveArchiveObjectManifestRoot,
  verifyArchiveJob,
  verifySignature,
  type SignedArchiveJob,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import {
  MEERKAT_HOSTED_STORAGE_FEATURE,
  verifyHostedFeatureEntitlement,
} from '@mylife/entitlements/server';
import type {
  ArchiveJobRecord,
  ArchiveLifecycleStore,
  ArchiveObjectRecord,
} from './archive-lifecycle';
import { ArchiveObjectByteService } from './archive-object-bytes';
import { ArchiveTakedownPropagator, type ObjectAbsenceProbe, type TakedownLease } from './archive-takedown-propagator';
import type { PinServingIndex } from './archive-pin-reconciler';
import type { ObjectReferenceLedger } from './object-reference-ledger';
import type { ObjectDeletionJobStore } from './object-deletion-jobs';
import { OBJECT_STORE_SHA256_HEX } from './object-store';
import type { CredentialVerifier, CredentialPresentationReason } from './credential-verify';
import type { CredentialEvidenceSink } from './credential-evidence';

const JOB_AUTH_DOMAIN = 'meerkat-archive-request-auth-v2';
const JOB_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/u;
const SAFE_ID = /^[A-Za-z0-9_.:@/-]{1,512}$/u;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{1,256}$/u;
const REQUEST_NONCE = /^[a-f0-9]{64}$/u;
const OWNER_AUTH_WINDOW_MS = 5 * 60 * 1000;
const TAKEDOWN_LEASE_MS = 5 * 60 * 1000;
const TAKEDOWN_WORKER_ID = 'archive-intake-http';
const DEFAULT_MAX_OBJECT_BYTES = 64 * 1024 * 1024;
const MAX_JOB_BODY_BYTES = 64 * 1024;
const MAX_COMPLETE_BODY_BYTES = 4 * 1024;

const encoder = new TextEncoder();

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Canonical bytes the request digest is computed over (server-recomputed, never client-supplied). */
function canonicalSignedJobDigest(signedJob: SignedArchiveJob): string {
  return sha256Hex(encoder.encode(JSON.stringify(signedJob)));
}

/** Canonical request proof binds action, route, freshness, nonce, and exact body bytes. */
function canonicalJobAuth(
  method: string,
  pathname: string,
  ts: string,
  nonce: string,
  bodyDigestHex: string,
): Uint8Array {
  return encoder.encode(JSON.stringify([
    JOB_AUTH_DOMAIN,
    method.toUpperCase(),
    pathname,
    ts,
    nonce,
    bodyDigestHex,
  ]));
}

/** Verify a request-bound owner proof against the job's real signer, fail-closed. */
function verifyOwnerAuth(
  ownerDeviceId: string,
  method: string,
  pathname: string,
  ts: string,
  nonce: string,
  body: Uint8Array,
  signature: string,
  nowMs: number,
): boolean {
  if (typeof signature !== 'string' || signature.length === 0) return false;
  if (!REQUEST_NONCE.test(nonce)) return false;
  const tsMs = Date.parse(ts);
  if (!Number.isFinite(tsMs) || Math.abs(nowMs - tsMs) > OWNER_AUTH_WINDOW_MS) return false;
  try {
    return verifySignature(
      ownerDeviceId,
      canonicalJobAuth(method, pathname, ts, nonce, sha256Hex(body)),
      hexToBytes(signature),
    );
  } catch {
    return false;
  }
}

/** Privacy-preserving index for a job's owner: sha256 of the lowercased Ed25519 pubkey (never the raw key). */
export function archiveOwnerSubjectHash(ownerDeviceId: string): string {
  return sha256Hex(encoder.encode(ownerDeviceId.toLowerCase()));
}

/** Map a credential presentation refusal to an honest HTTP status (Plan 51 P2). */
function credentialStatus(reason: CredentialPresentationReason): number {
  return reason === 'not_configured' ? 503 : 401;
}

/**
 * Verify the `x-mk-credential` presentation on the create route and, on success,
 * record its serial as moderation evidence co-located with the owner subject hash
 * (persona-side identifier, never an account). A dead evidence sink fails closed
 * so an unrevocable presentation is never accepted.
 */
async function verifyArchiveCredential(
  req: http.IncomingMessage,
  options: ArchiveIntakeOptions,
  ownerSubjectHashHex: string,
): Promise<{ ok: true } | { ok: false; reason: CredentialPresentationReason }> {
  const verifier = options.credentialVerifier!;
  const header = options.credentialHeader ?? 'x-mk-credential';
  const verdict = await verifier.verifyPresentation(headerValue(req, header));
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  if (options.credentialEvidence) {
    try {
      await options.credentialEvidence.record({
        serial: verdict.serial,
        epoch: verdict.epoch,
        subject: ownerSubjectHashHex,
        surface: 'archive_intake',
      });
    } catch {
      return { ok: false, reason: 'not_configured' };
    }
  }
  return { ok: true };
}

function headerValue(req: http.IncomingMessage, name: string): string | null {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === 'string' ? value : null;
}

function readBearerToken(req: http.IncomingMessage): string | null {
  const authorization = headerValue(req, 'authorization');
  if (!authorization) return null;
  const [scheme, ...rest] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function parseJsonBytes(bytes: Uint8Array): unknown {
  if (bytes.byteLength === 0) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}

/** Read the raw (non-JSON) body for the object upload route, capped at maxBytes (413 on overflow). */
async function readRawBody(req: http.IncomingMessage, maxBytes: number): Promise<Uint8Array | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > maxBytes) return null;
    chunks.push(buf);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/** Per-tenant intake byte quota, mirroring StorageIngestStore's cap shape (storage-ingest.ts). */
export interface ArchiveIntakeQuotaSource {
  capBytes(ownerSubjectHashHex: string): number | Promise<number>;
}

export interface ArchiveIntakeRateLimiter {
  check(req: http.IncomingMessage, pathname: string): { allowed: boolean; retryAfterSeconds: number };
}

export interface ArchiveRequestNonceStore {
  /** Atomically returns false when the owner+nonce is already live. */
  consume(ownerSubjectHashHex: string, nonce: string, expiresAtMs: number): boolean | Promise<boolean>;
}

/** Bounded replay cache for the single composed community-node archive listener. */
export class InMemoryArchiveRequestNonceStore implements ArchiveRequestNonceStore {
  private readonly entries = new Map<string, number>();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly capacity = 100_000,
  ) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new TypeError('Archive nonce capacity is invalid');
  }

  consume(ownerSubjectHashHex: string, nonce: string, expiresAtMs: number): boolean {
    const nowMs = this.now();
    for (const [key, expiry] of this.entries) {
      if (expiry <= nowMs) this.entries.delete(key);
    }
    const key = `${ownerSubjectHashHex}:${nonce}`;
    if (this.entries.has(key)) return false;
    if (this.entries.size >= this.capacity) throw new Error('Archive nonce capacity is exhausted');
    this.entries.set(key, expiresAtMs);
    return true;
  }
}

export interface ArchiveIntakeOptions {
  store: ArchiveLifecycleStore;
  byteService: ArchiveObjectByteService;
  servingIndex: PinServingIndex;
  referenceLedger: Pick<ObjectReferenceLedger, 'referenceCount'>;
  deletionJobs: Pick<ObjectDeletionJobStore, 'enqueue'>;
  probeAbsence: ObjectAbsenceProbe;
  /** Verifies the SAME x-mk-entitlement bearer the storage-ingest path verifies (S0.6). */
  entitlementSecret: string;
  quota: ArchiveIntakeQuotaSource;
  /** Authoritative publication already accepted by this serving community node. */
  resolvePublication(
    publicationId: string,
  ): ArchiveAuthoritativePublication | null | Promise<ArchiveAuthoritativePublication | null>;
  nonceStore: ArchiveRequestNonceStore;
  /**
   * Plan 51 P2 anonymous-credential gate. OPTIONAL and ALONGSIDE the existing
   * owner proof (never a replacement): when present, a job create must ALSO carry
   * a valid credential presentation in `x-mk-credential`. Absent => byte-identical
   * legacy behavior (owner proof only). Fail-closed: a wired verifier that cannot
   * load its epoch key refuses (503), and a missing/invalid/expired/revoked
   * presentation refuses with the verifier's honest reason.
   */
  credentialVerifier?: CredentialVerifier;
  /** Header carrying the credential presentation. Defaults to x-mk-credential. */
  credentialHeader?: string;
  /**
   * Records an accepted credential's serial as moderation evidence (Plan 51 P4),
   * co-located with the archive owner subject hash (a persona-side identifier),
   * never an account identifier.
   */
  credentialEvidence?: CredentialEvidenceSink;
  /** This host's stable id for pin/takedown scoping. */
  hostId: string;
  /** Per-request body cap for a quarantine object PUT. Default 64 MiB. */
  maxObjectBytes?: number;
  requestLimiter?: ArchiveIntakeRateLimiter;
  now?: () => number;
  log?: (event: string, detail?: Record<string, unknown>) => void;
}

export interface ArchiveAuthoritativePublication {
  signed: SignedPublicationDescriptor;
  objects: SignedArchiveJob['job']['objects'];
}

export type ArchiveRouteResult = 'handled' | 'unmatched';

const JOBS_PATH = /^\/api\/archive\/jobs$/;
const JOB_PATH = /^\/api\/archive\/jobs\/([^/]+)$/;
const OBJECT_PATH = /^\/api\/archive\/jobs\/([^/]+)\/objects\/(\d+)$/;
const COMPLETE_PATH = /^\/api\/archive\/jobs\/([^/]+)\/complete$/;
const HOSTS_PATH = /^\/api\/archive\/publications\/([^/]+)\/hosts$/;

function normalizedArchiveRatePath(method: string, pathname: string): string {
  if (JOBS_PATH.test(pathname)) return `${method} /api/archive/jobs`;
  if (OBJECT_PATH.test(pathname)) return `${method} /api/archive/jobs/:id/objects/:index`;
  if (COMPLETE_PATH.test(pathname)) return `${method} /api/archive/jobs/:id/complete`;
  if (JOB_PATH.test(pathname)) return `${method} /api/archive/jobs/:id`;
  if (HOSTS_PATH.test(pathname)) return `${method} /api/archive/publications/:id/hosts`;
  return `${method} /api/archive/*`;
}

/** Public, store-derived job status projection (NC-43.2: never echoes client-claimed state). */
function statusPayload(job: ArchiveJobRecord, scanOutcomeClass: 'clean' | 'rejected' | 'review_required' | null) {
  return {
    jobId: job.jobId,
    status: job.status,
    lastErrorCode: job.lastErrorCode,
    expectedBytes: job.expectedBytes,
    receivedBytes: job.receivedBytes,
    scanOutcomeClass,
    pinned: job.status === 'pinned' || job.status === 'announced',
    announced: job.status === 'announced',
  };
}

function scanOutcomeClassFor(job: ArchiveJobRecord): 'clean' | 'rejected' | 'review_required' | null {
  if (job.status === 'rejected') return 'rejected';
  if (job.status === 'review_required') return 'review_required';
  if (job.status === 'approved' || job.status === 'pinned' || job.status === 'announced') return 'clean';
  return null;
}

/**
 * Handles one request against the /api/archive surface. Returns 'unmatched' (writes nothing) for
 * any path outside this module's routes, so the caller (community-node-http.ts) can fall through
 * to its own 404. Every matched route writes exactly one response.
 */
export async function handleArchiveRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ArchiveIntakeOptions,
): Promise<ArchiveRouteResult> {
  const url = req.url ?? '/';
  const pathname = url.split('?')[0] ?? url;
  const method = req.method ?? 'GET';
  const log = options.log ?? (() => {});
  const now = options.now ?? (() => Date.now());
  const maxObjectBytes = options.maxObjectBytes ?? DEFAULT_MAX_OBJECT_BYTES;

  if (!pathname.startsWith('/api/archive/')) return 'unmatched';

  const rate = options.requestLimiter?.check(req, normalizedArchiveRatePath(method, pathname));
  if (rate && !rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    sendJson(res, 429, { error: 'rate_limited' });
    return 'handled';
  }

  // ---- POST /api/archive/jobs ----
  if (JOBS_PATH.test(pathname)) {
    if (method !== 'POST') { res.writeHead(405).end(); return 'handled'; }
    await createJob(req, res, options, now(), log);
    return 'handled';
  }

  // ---- PUT /api/archive/jobs/:jobId/objects/:index ----
  const object = OBJECT_PATH.exec(pathname);
  if (object) {
    if (method !== 'PUT') { res.writeHead(405).end(); return 'handled'; }
    const jobId = object[1]!;
    const index = Number(object[2]);
    await uploadObject(req, res, options, jobId, index, maxObjectBytes, now(), log);
    return 'handled';
  }

  // ---- POST /api/archive/jobs/:jobId/complete ----
  const complete = COMPLETE_PATH.exec(pathname);
  if (complete) {
    if (method !== 'POST') { res.writeHead(405).end(); return 'handled'; }
    await completeJob(req, res, options, complete[1]!, now(), log);
    return 'handled';
  }

  // ---- GET /api/archive/publications/:publicationId/hosts (OPEN, public) ----
  const hosts = HOSTS_PATH.exec(pathname);
  if (hosts) {
    if (method !== 'GET') { res.writeHead(405).end(); return 'handled'; }
    await listHosts(req, res, options, decodeURIComponent(hosts[1]!));
    return 'handled';
  }

  // ---- GET/DELETE /api/archive/jobs/:jobId (owner-authenticated) ----
  const job = JOB_PATH.exec(pathname);
  if (job) {
    const jobId = job[1]!;
    if (method === 'GET') { await getJobStatus(req, res, options, jobId, now(), log); return 'handled'; }
    if (method === 'DELETE') { await cancelJob(req, res, options, jobId, now(), log); return 'handled'; }
    res.writeHead(405).end();
    return 'handled';
  }

  return 'unmatched';
}

/** Fail-closed hosted-storage entitlement gate shared by the write routes. */
async function requireIntakeEntitlement(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ArchiveIntakeOptions,
  action: string,
  log: (event: string, detail?: Record<string, unknown>) => void,
): Promise<string | null> {
  const verdict = await verifyHostedFeatureEntitlement(
    readBearerToken(req),
    options.entitlementSecret,
    MEERKAT_HOSTED_STORAGE_FEATURE,
  );
  if (!verdict.ok) {
    const status = verdict.reason === 'missing' ? 402 : 403;
    log('archive_intake_reject', { action, reason: 'entitlement_required' });
    sendJson(res, status, { error: 'entitlement_required', reason: verdict.reason });
    return null;
  }
  const subjectId = verdict.entitlements.subjectId?.toLowerCase() ?? null;
  if (!subjectId) {
    log('archive_intake_reject', { action, reason: 'subject_bound_entitlement_required' });
    sendJson(res, 403, { error: 'entitlement_required', reason: 'subject_missing' });
    return null;
  }
  return subjectId;
}

async function requireOwnerRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ArchiveIntakeOptions,
  input: {
    ownerDeviceId: string;
    method: string;
    pathname: string;
    body: Uint8Array;
    nowMs: number;
    consumeNonce: boolean;
  },
): Promise<boolean> {
  const ts = headerValue(req, 'x-mk-ts');
  const nonce = headerValue(req, 'x-mk-nonce');
  const signature = headerValue(req, 'x-mk-owner-sig');
  if (!ts || !nonce || !signature) {
    sendJson(res, 401, { error: 'missing_auth' });
    return false;
  }
  if (!verifyOwnerAuth(
    input.ownerDeviceId,
    input.method,
    input.pathname,
    ts,
    nonce,
    input.body,
    signature,
    input.nowMs,
  )) {
    sendJson(res, 403, { error: 'not_owner' });
    return false;
  }
  if (input.consumeNonce) {
    try {
      const consumed = await options.nonceStore.consume(
        archiveOwnerSubjectHash(input.ownerDeviceId),
        nonce,
        input.nowMs + OWNER_AUTH_WINDOW_MS,
      );
      if (!consumed) {
        sendJson(res, 409, { error: 'replayed_request' });
        return false;
      }
    } catch {
      sendJson(res, 503, { error: 'auth_unavailable' });
      return false;
    }
  }
  return true;
}

async function createJob(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ArchiveIntakeOptions,
  nowMs: number,
  log: (event: string, detail?: Record<string, unknown>) => void,
): Promise<void> {
  const entitlementSubject = await requireIntakeEntitlement(req, res, options, 'create', log);
  if (!entitlementSubject) return;

  const rawBytes = await readRawBody(req, MAX_JOB_BODY_BYTES);
  if (!rawBytes) { sendJson(res, 413, { error: 'too_large' }); return; }
  const raw = parseJsonBytes(rawBytes);
  if (typeof raw !== 'object' || raw === null) { sendJson(res, 400, { error: 'bad_request' }); return; }
  const body = raw as { signedJob?: unknown; idempotencyKey?: unknown; expectedBytes?: unknown };
  if (
    typeof body.idempotencyKey !== 'string' || !IDEMPOTENCY_KEY.test(body.idempotencyKey)
    || !Number.isSafeInteger(body.expectedBytes) || (body.expectedBytes as number) < 0
    || typeof body.signedJob !== 'object' || body.signedJob === null
  ) {
    sendJson(res, 400, { error: 'bad_request' });
    return;
  }
  const signedJob = body.signedJob as SignedArchiveJob;

  if (entitlementSubject !== signedJob.job?.ownerDeviceId?.toLowerCase()) {
    log('archive_intake_reject', { action: 'create', reason: 'entitlement_subject_mismatch' });
    sendJson(res, 403, { error: 'not_owner' });
    return;
  }

  if (!await requireOwnerRequest(req, res, options, {
    ownerDeviceId: signedJob.job.ownerDeviceId,
    method: 'POST',
    pathname: '/api/archive/jobs',
    body: rawBytes,
    nowMs,
    consumeNonce: true,
  })) return;

  const publication = await options.resolvePublication(signedJob.job.publicationId);
  if (!publication || publication.signed.descriptor.status !== 'active') {
    log('archive_intake_reject', { action: 'create', reason: 'unknown_publication' });
    sendJson(res, 404, { error: 'unknown_publication' });
    return;
  }

  // Fail-closed verdict gate (NC-8): only 'ok' proceeds. Every other verdict is a rights/consent/
  // identity refusal, never a partial admit.
  const verdict = verifyArchiveJob(signedJob, publication.signed);
  if (verdict !== 'ok') {
    log('archive_intake_reject', { action: 'create', reason: verdict });
    sendJson(res, 400, { error: 'invalid_job', reason: verdict });
    return;
  }
  if (deriveArchiveObjectManifestRoot(publication.objects) !== signedJob.job.objectManifestRoot) {
    log('archive_intake_reject', { action: 'create', reason: 'publication_manifest_mismatch' });
    sendJson(res, 400, { error: 'invalid_job', reason: 'publication_manifest_mismatch' });
    return;
  }

  const requestDigestHex = canonicalSignedJobDigest(signedJob);
  const ownerSubjectHashHex = archiveOwnerSubjectHash(entitlementSubject);

  // Plan 51 P2 credential gate: ALONGSIDE the owner proof above (never a
  // replacement). Only enforced when a verifier is wired; a bad/missing/revoked
  // presentation refuses honestly. The accepted serial is recorded as moderation
  // evidence co-located with the owner subject hash (never an account id).
  if (options.credentialVerifier) {
    const outcome = await verifyArchiveCredential(req, options, ownerSubjectHashHex);
    if (!outcome.ok) {
      log('archive_intake_reject', { action: 'create', reason: `credential_${outcome.reason}` });
      sendJson(res, credentialStatus(outcome.reason), { error: 'credential_invalid', reason: outcome.reason });
      return;
    }
  }

  const expectedBytes = body.expectedBytes as number;
  const signedExpectedBytes = signedJob.job.objects.reduce((total, object) => total + object.size, 0);
  if (!Number.isSafeInteger(signedExpectedBytes) || expectedBytes !== signedExpectedBytes) {
    sendJson(res, 400, { error: 'invalid_job', reason: 'manifest_size_mismatch' });
    return;
  }

  const ownerCapBytes = await options.quota.capBytes(ownerSubjectHashHex);

  let result: Awaited<ReturnType<ArchiveLifecycleStore['enqueue']>>;
  try {
    result = await options.store.enqueue({
      signedJob,
      idempotencyKey: body.idempotencyKey,
      requestDigestHex,
      ownerSubjectHashHex,
      expectedBytes,
      ownerCapBytes,
      nowMs,
    });
  } catch {
    sendJson(res, 400, { error: 'bad_request' });
    return;
  }
  if (result.status === 'conflict') {
    log('archive_intake_reject', { action: 'create', reason: 'idempotency_conflict' });
    sendJson(res, 409, { error: 'idempotency_conflict' });
    return;
  }
  if (result.status === 'quota_exceeded') {
    log('archive_intake_reject', { action: 'create', reason: 'quota_exceeded' });
    sendJson(res, 413, { error: 'quota_exceeded' });
    return;
  }
  log('archive_job_create', { jobId: result.job.jobId, replay: result.status === 'replay' });
  sendJson(res, 200, {
    jobId: result.job.jobId,
    status: result.job.status,
    expectedBytes: result.job.expectedBytes,
    receivedBytes: result.job.receivedBytes,
  });
}

async function uploadObject(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ArchiveIntakeOptions,
  jobId: string,
  index: number,
  maxObjectBytes: number,
  nowMs: number,
  log: (event: string, detail?: Record<string, unknown>) => void,
): Promise<void> {
  const entitlementSubject = await requireIntakeEntitlement(req, res, options, 'upload', log);
  if (!entitlementSubject) return;
  if (!JOB_ID.test(jobId) || !Number.isInteger(index) || index < 0) {
    sendJson(res, 400, { error: 'bad_request' });
    return;
  }
  const objectHash = headerValue(req, 'x-mk-object-hash');
  if (!objectHash || !OBJECT_STORE_SHA256_HEX.test(objectHash)) {
    sendJson(res, 400, { error: 'bad_request', reason: 'missing_object_hash' });
    return;
  }

  const job = await options.store.getJob(jobId);
  if (!job) { sendJson(res, 404, { error: 'unknown_job' }); return; }
  const signedJob = job.signedJob;
  if (!signedJob || entitlementSubject !== signedJob.job.ownerDeviceId.toLowerCase()) {
    sendJson(res, 403, { error: 'not_owner' });
    return;
  }
  if (job.status !== 'created' && job.status !== 'uploading') {
    log('archive_intake_reject', { jobId, action: 'upload', reason: 'wrong_state' });
    sendJson(res, 409, { error: 'wrong_state', status: job.status });
    return;
  }
  if (job.identityStatus !== 'verified') {
    sendJson(res, 409, { error: 'wrong_state', status: job.status });
    return;
  }

  const manifestObject = signedJob.job.objects[index];
  if (!manifestObject || manifestObject.hash !== objectHash || manifestObject.size > maxObjectBytes) {
    sendJson(res, 400, { error: 'manifest_mismatch' });
    return;
  }

  const bytes = await readRawBody(req, Math.min(maxObjectBytes, manifestObject.size));
  if (!bytes) { sendJson(res, 413, { error: 'too_large' }); return; }
  if (bytes.byteLength !== manifestObject.size) {
    sendJson(res, 400, { error: 'manifest_mismatch' });
    return;
  }

  const pathname = `/api/archive/jobs/${jobId}/objects/${index}`;
  if (!await requireOwnerRequest(req, res, options, {
    ownerDeviceId: signedJob.job.ownerDeviceId,
    method: 'PUT',
    pathname,
    body: bytes,
    nowMs,
    consumeNonce: true,
  })) return;

  // Hash verify BEFORE store (mirrors createStorageIngestHandler's per-block discipline).
  if (sha256Hex(bytes) !== objectHash) {
    log('archive_intake_reject', { jobId, action: 'upload', reason: 'hash_mismatch' });
    sendJson(res, 400, { error: 'hash_mismatch' });
    return;
  }

  // Content hash is part of the key. A conflicting upload therefore lands at a different key and
  // can never overwrite or delete a previously accepted quarantine object for the same content.
  const quarantineKey = `archive/quarantine/${job.contentId}/${index}/${objectHash}`;
  const intake = await options.byteService.intakeQuarantineObject({
    jobId,
    expectedJobVersion: job.lifecycleVersion,
    objectIndex: index,
    quarantineKey,
    objectHash,
    bytes,
    nowMs,
  });
  if (intake.status === 'checksum_mismatch') {
    sendJson(res, 400, { error: 'hash_mismatch' });
    return;
  }
  if (intake.status === 'rejected_by_lifecycle') {
    const current = await options.store.getJob(jobId);
    log('archive_intake_reject', { jobId, action: 'upload', reason: 'rejected_by_lifecycle' });
    sendJson(res, 409, { error: 'wrong_state', status: current?.status ?? job.status });
    return;
  }

  const updated = await options.store.getJob(jobId);
  const objects = updated ? await options.store.listObjects(jobId) : [];
  log('archive_object_upload', { jobId, index });
  sendJson(res, 200, {
    jobId,
    status: updated?.status ?? job.status,
    receivedBytes: updated?.receivedBytes ?? job.receivedBytes,
    expectedBytes: updated?.expectedBytes ?? job.expectedBytes,
    storedIndices: objects.map((o) => o.objectIndex),
  });
}

async function completeJob(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ArchiveIntakeOptions,
  jobId: string,
  nowMs: number,
  log: (event: string, detail?: Record<string, unknown>) => void,
): Promise<void> {
  const entitlementSubject = await requireIntakeEntitlement(req, res, options, 'complete', log);
  if (!entitlementSubject) return;
  if (!JOB_ID.test(jobId)) { sendJson(res, 400, { error: 'bad_request' }); return; }

  const rawBytes = await readRawBody(req, MAX_COMPLETE_BODY_BYTES);
  if (!rawBytes) { sendJson(res, 413, { error: 'too_large' }); return; }
  const raw = parseJsonBytes(rawBytes);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    sendJson(res, 400, { error: 'bad_request' });
    return;
  }

  const job = await options.store.getJob(jobId);
  if (!job) { sendJson(res, 404, { error: 'unknown_job' }); return; }
  if (!job.signedJob || entitlementSubject !== job.signedJob.job.ownerDeviceId.toLowerCase()) {
    sendJson(res, 403, { error: 'not_owner' });
    return;
  }
  if (!await requireOwnerRequest(req, res, options, {
    ownerDeviceId: job.signedJob.job.ownerDeviceId,
    method: 'POST',
    pathname: `/api/archive/jobs/${jobId}/complete`,
    body: rawBytes,
    nowMs,
    consumeNonce: true,
  })) return;
  if (job.status === 'quarantined' || job.status === 'scanning' || job.status === 'approved'
    || job.status === 'pinned' || job.status === 'announced') {
    // Double-complete is idempotent: already past the create/uploading gate.
    sendJson(res, 200, { jobId, status: job.status });
    return;
  }
  if (job.status !== 'created' && job.status !== 'uploading') {
    sendJson(res, 409, { error: 'wrong_state', status: job.status });
    return;
  }

  const objects = await options.store.listObjects(jobId);
  const missing = findMissingIndices(job, objects);
  if (missing.length > 0 || job.receivedBytes !== job.expectedBytes) {
    log('archive_intake_reject', { jobId, action: 'complete', reason: 'incomplete_manifest' });
    sendJson(res, 409, { error: 'incomplete_manifest', missingIndices: missing });
    return;
  }

  const updated = await options.store.markQuarantined(jobId, job.lifecycleVersion, nowMs);
  if (!updated) {
    const current = await options.store.getJob(jobId);
    sendJson(res, 409, { error: 'wrong_state', status: current?.status ?? job.status });
    return;
  }
  log('archive_job_complete', { jobId });
  sendJson(res, 200, { jobId, status: updated.status });
}

/**
 * Every signed manifest index without an exact verified lifecycle row.
 */
function findMissingIndices(job: ArchiveJobRecord, objects: readonly ArchiveObjectRecord[]): number[] {
  const manifest = job.signedJob?.job.objects ?? [];
  const byIndex = new Map(objects.map((object) => [object.objectIndex, object]));
  return manifest
    .filter((expected) => {
      const actual = byIndex.get(expected.index);
      return !actual
        || actual.metadataStatus !== 'verified'
        || actual.objectHash !== expected.hash
        || actual.objectBytes !== expected.size;
    })
    .map((object) => object.index);
}

async function getJobStatus(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ArchiveIntakeOptions,
  jobId: string,
  nowMs: number,
  log: (event: string, detail?: Record<string, unknown>) => void,
): Promise<void> {
  if (!JOB_ID.test(jobId)) { sendJson(res, 400, { error: 'bad_request' }); return; }
  const job = await options.store.getJob(jobId);
  if (!job || job.identityStatus !== 'verified' || !job.signedJob) {
    sendJson(res, 404, { error: 'unknown_job' });
    return;
  }
  if (!await requireOwnerRequest(req, res, options, {
    ownerDeviceId: job.signedJob.job.ownerDeviceId,
    method: 'GET',
    pathname: `/api/archive/jobs/${jobId}`,
    body: new Uint8Array(0),
    nowMs,
    consumeNonce: false,
  })) {
    log('archive_intake_reject', { jobId, action: 'status', reason: 'not_owner' });
    return;
  }
  sendJson(res, 200, statusPayload(job, scanOutcomeClassFor(job)));
}

async function cancelJob(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ArchiveIntakeOptions,
  jobId: string,
  nowMs: number,
  log: (event: string, detail?: Record<string, unknown>) => void,
): Promise<void> {
  if (!JOB_ID.test(jobId)) { sendJson(res, 400, { error: 'bad_request' }); return; }
  const job = await options.store.getJob(jobId);
  if (!job || job.identityStatus !== 'verified' || !job.signedJob) {
    sendJson(res, 404, { error: 'unknown_job' });
    return;
  }
  if (!await requireOwnerRequest(req, res, options, {
    ownerDeviceId: job.signedJob.job.ownerDeviceId,
    method: 'DELETE',
    pathname: `/api/archive/jobs/${jobId}`,
    body: new Uint8Array(0),
    nowMs,
    consumeNonce: true,
  })) {
    log('archive_intake_reject', { jobId, action: 'cancel', reason: 'not_owner' });
    return;
  }

  if (job.status === 'removed') {
    sendJson(res, 200, { jobId, status: 'removed' });
    return;
  }

  // requestTakedown is idempotent; a job not yet past created/uploading (never quarantined, no
  // bytes/pin to reclaim) is moved straight to takedown_pending and can complete with no lease work.
  const requested = await options.store.requestTakedown(jobId, nowMs);
  if (!requested) { sendJson(res, 404, { error: 'unknown_job' }); return; }

  const claims = await options.store.claimJobs({
    workerId: TAKEDOWN_WORKER_ID,
    eligibleStatuses: ['takedown_pending'],
    limit: 1,
    leaseMs: TAKEDOWN_LEASE_MS,
    nowMs,
  });
  const claim = claims.find((c) => c.job.jobId === jobId);
  if (!claim) {
    // Another worker holds a live lease on this job right now; the takedown request itself is
    // already durable (requestTakedown above), so this is a safe, retryable partial.
    log('archive_job_cancel', { jobId, status: 'takedown_pending', lease: 'contended' });
    sendJson(res, 200, { jobId, status: 'takedown_pending' });
    return;
  }

  const propagator = new ArchiveTakedownPropagator(
    options.store,
    options.servingIndex,
    options.byteService,
    options.referenceLedger,
    options.deletionJobs,
    options.probeAbsence,
  );
  const lease: TakedownLease = { jobId, workerId: TAKEDOWN_WORKER_ID, fencingToken: claim.fencingToken };
  const result = await propagator.propagate({ jobId, hostId: options.hostId, lease, nowMs });

  if (result.status === 'not_found') { sendJson(res, 404, { error: 'unknown_job' }); return; }
  if (result.status === 'lease_lost') {
    // A concurrent takedown pass won the fenced lease; the request itself is durable and idempotent
    // on the next call, so report the current authoritative status rather than a false failure.
    const current = await options.store.getJob(jobId);
    log('archive_job_cancel', { jobId, status: current?.status ?? 'takedown_pending', lease: 'lost' });
    sendJson(res, 200, { jobId, status: current?.status ?? 'takedown_pending' });
    return;
  }
  log('archive_job_cancel', { jobId, status: result.status === 'removed' ? 'removed' : 'takedown_pending' });
  sendJson(res, 200, { jobId, status: result.status === 'removed' ? 'removed' : 'takedown_pending' });
}

async function listHosts(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ArchiveIntakeOptions,
  publicationId: string,
): Promise<void> {
  if (!publicationId || !SAFE_ID.test(publicationId)) {
    sendJson(res, 400, { error: 'bad_request' });
    return;
  }
  const query = new URL(req.url ?? '/', 'http://internal').searchParams;
  const limitRaw = Number(query.get('limit'));
  const limit = Number.isSafeInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 100;
  const page = await options.store.listActiveHosts(publicationId, { limit });
  sendJson(res, 200, {
    hosts: page.records.map((pin) => ({ hostId: pin.hostId, lastVerifiedAt: pin.lastVerifiedAt })),
    nextCursor: page.nextCursor,
  });
}
