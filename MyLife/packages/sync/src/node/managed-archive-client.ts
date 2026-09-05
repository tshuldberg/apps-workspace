import type { DeviceIdentity } from '../types';
import { bytesToHex } from '../encryption/keys';
import { sha256Hex } from '../encryption/sha256';
import { extractSigningPrivateKeyHex, signMessage } from '../identity/device-identity';
import type { SignedArchiveJob } from '../protocol/public-archive';

const JOB_AUTH_DOMAIN = 'meerkat-archive-request-auth-v2';
const MAX_ERROR_BODY_BYTES = 64 * 1024;
const JOB_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/u;
const MANAGED_ARCHIVE_STATUSES = new Set<ManagedArchiveStatus>([
  'created', 'uploading', 'quarantined', 'scanning', 'review_required', 'approved',
  'pinned', 'announced', 'rejected', 'takedown_pending', 'removed', 'failed',
]);
const SCAN_OUTCOMES = new Set(['clean', 'rejected', 'review_required']);
const ERROR_CODE = /^[A-Za-z0-9_.:-]{1,128}$/u;

export type ManagedArchiveStatus =
  | 'created' | 'uploading' | 'quarantined' | 'scanning' | 'review_required'
  | 'approved' | 'pinned' | 'announced' | 'rejected' | 'takedown_pending'
  | 'removed' | 'failed';

export interface ManagedArchiveStatusRecord {
  jobId: string;
  status: ManagedArchiveStatus;
  lastErrorCode: string | null;
  expectedBytes: number;
  receivedBytes: number;
  scanOutcomeClass: 'clean' | 'rejected' | 'review_required' | null;
  pinned: boolean;
  announced: boolean;
}

export interface ManagedArchiveClientOptions {
  baseUrl: string;
  /** Required only for submit. Owner-signed status and cancel remain usable after entitlement expiry. */
  entitlementToken?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export class ManagedArchiveHttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`Managed archive request failed: ${code} (${status})`);
    this.name = 'ManagedArchiveHttpError';
  }
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('Managed archive base URL is invalid');
  }
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new TypeError('Managed archive base URL must use HTTPS');
  }
  return url.toString().replace(/\/+$/u, '');
}

async function errorCode(response: Response): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_ERROR_BODY_BYTES) return 'http_error';
  try {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_ERROR_BODY_BYTES) return 'http_error';
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { error?: unknown };
    return typeof parsed.error === 'string' ? parsed.error : 'http_error';
  } catch {
    return 'http_error';
  }
}

async function requireOk(response: Response): Promise<Response> {
  if (!response.ok) throw new ManagedArchiveHttpError(response.status, await errorCode(response));
  return response;
}

function requireJobId(jobId: string): string {
  if (!JOB_ID.test(jobId)) throw new TypeError('Managed archive job id is invalid');
  return jobId;
}

async function jsonRecord(response: Response): Promise<Record<string, unknown>> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_ERROR_BODY_BYTES) {
    throw new TypeError('Managed archive response is too large');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_ERROR_BODY_BYTES) throw new TypeError('Managed archive response is too large');
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // The stable boundary error below deliberately does not echo an untrusted response.
  }
  throw new TypeError('Managed archive response is invalid');
}

function statusValue(value: unknown): ManagedArchiveStatus {
  if (typeof value !== 'string' || !MANAGED_ARCHIVE_STATUSES.has(value as ManagedArchiveStatus)) {
    throw new TypeError('Managed archive status is invalid');
  }
  return value as ManagedArchiveStatus;
}

function parseStatusRecord(body: Record<string, unknown>, expectedJobId: string): ManagedArchiveStatusRecord {
  const status = statusValue(body.status);
  const scanOutcome = body.scanOutcomeClass;
  if (body.jobId !== expectedJobId
    || (body.lastErrorCode !== null
      && (typeof body.lastErrorCode !== 'string' || !ERROR_CODE.test(body.lastErrorCode)))
    || !Number.isSafeInteger(body.expectedBytes) || (body.expectedBytes as number) < 0
    || !Number.isSafeInteger(body.receivedBytes) || (body.receivedBytes as number) < 0
    || (body.receivedBytes as number) > (body.expectedBytes as number)
    || (scanOutcome !== null && (typeof scanOutcome !== 'string' || !SCAN_OUTCOMES.has(scanOutcome)))
    || typeof body.pinned !== 'boolean' || typeof body.announced !== 'boolean'
    || body.announced !== (status === 'announced')
    || body.pinned !== (status === 'pinned' || status === 'announced')
    || scanOutcome !== (status === 'rejected' ? 'rejected'
      : status === 'review_required' ? 'review_required'
        : status === 'approved' || status === 'pinned' || status === 'announced' ? 'clean' : null)) {
    throw new TypeError('Managed archive status response is invalid');
  }
  return {
    jobId: expectedJobId,
    status,
    lastErrorCode: body.lastErrorCode as string | null,
    expectedBytes: body.expectedBytes as number,
    receivedBytes: body.receivedBytes as number,
    scanOutcomeClass: scanOutcome as ManagedArchiveStatusRecord['scanOutcomeClass'],
    pinned: body.pinned,
    announced: body.announced,
  };
}

let authNonceCounter = 0;

function ownerAuth(
  identity: DeviceIdentity,
  method: string,
  pathname: string,
  body: Uint8Array,
  now: Date,
): Record<string, string> {
  const timestamp = now.toISOString();
  authNonceCounter = (authNonceCounter + 1) % Number.MAX_SAFE_INTEGER;
  const nonce = sha256Hex(new TextEncoder().encode(JSON.stringify([
    identity.publicKey,
    timestamp,
    authNonceCounter,
  ])));
  const message = new TextEncoder().encode(JSON.stringify([
    JOB_AUTH_DOMAIN,
    method.toUpperCase(),
    pathname,
    timestamp,
    nonce,
    sha256Hex(body),
  ]));
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(identity.privateKeyRef), message));
  return { 'X-Mk-Ts': timestamp, 'X-Mk-Nonce': nonce, 'X-Mk-Owner-Sig': signature };
}

export class ManagedArchiveClient {
  private readonly baseUrl: string;
  private readonly entitlementToken: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(options: ManagedArchiveClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.entitlementToken = options.entitlementToken?.trim() || null;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  /** Create, hash-verify upload, and complete one signed archive job. */
  async submit(
    signedJob: SignedArchiveJob,
    identity: DeviceIdentity,
    objects: readonly Uint8Array[],
  ): Promise<ManagedArchiveStatusRecord> {
    const expectedBytes = objects.reduce((total, object) => total + object.byteLength, 0);
    if (!Number.isSafeInteger(expectedBytes)) throw new TypeError('Managed archive payload is too large');
    const jobId = requireJobId(signedJob.job.jobId);
    if (identity.publicKey.toLowerCase() !== signedJob.job.ownerDeviceId.toLowerCase()) {
      throw new TypeError('Managed archive identity does not own the signed job');
    }
    const expectedManifestBytes = signedJob.job.objects.reduce((total, object) => total + object.size, 0);
    if (objects.length !== signedJob.job.objects.length || expectedBytes !== expectedManifestBytes) {
      throw new TypeError('Managed archive objects do not match the signed manifest');
    }
    const createUrl = `${this.baseUrl}/api/archive/jobs`;
    const createBody = JSON.stringify({ signedJob, idempotencyKey: jobId, expectedBytes });
    await requireOk(await this.fetchImpl(createUrl, {
      method: 'POST',
      headers: this.entitlementHeaders({
        'Content-Type': 'application/json',
        ...ownerAuth(identity, 'POST', new URL(createUrl).pathname, new TextEncoder().encode(createBody), this.now()),
      }),
      body: createBody,
    }));
    for (let index = 0; index < objects.length; index += 1) {
      const object = objects[index]!;
      const manifestObject = signedJob.job.objects[index]!;
      if (sha256Hex(object) !== manifestObject.hash || object.byteLength !== manifestObject.size) {
        throw new TypeError('Managed archive object does not match the signed manifest');
      }
      const objectUrl = `${this.baseUrl}/api/archive/jobs/${jobId}/objects/${index}`;
      await requireOk(await this.fetchImpl(objectUrl, {
        method: 'PUT',
        headers: this.entitlementHeaders({
          'X-Mk-Object-Hash': manifestObject.hash,
          ...ownerAuth(identity, 'PUT', new URL(objectUrl).pathname, object, this.now()),
        }),
        // React Native accepts Uint8Array while the relay's Node-only TS lib omits DOM BodyInit.
        body: object as never,
      }));
    }
    const completeUrl = `${this.baseUrl}/api/archive/jobs/${jobId}/complete`;
    const completeBody = '{}';
    const completed = await requireOk(await this.fetchImpl(completeUrl, {
      method: 'POST',
      headers: this.entitlementHeaders({
        'Content-Type': 'application/json',
        ...ownerAuth(identity, 'POST', new URL(completeUrl).pathname, new TextEncoder().encode(completeBody), this.now()),
      }),
      body: completeBody,
    }));
    const body = await jsonRecord(completed);
    return {
      jobId,
      status: statusValue(body.status),
      lastErrorCode: null,
      expectedBytes,
      receivedBytes: expectedBytes,
      scanOutcomeClass: null,
      pinned: false,
      announced: false,
    };
  }

  async status(jobId: string, identity: DeviceIdentity): Promise<ManagedArchiveStatusRecord> {
    requireJobId(jobId);
    const url = `${this.baseUrl}/api/archive/jobs/${jobId}`;
    const response = await requireOk(await this.fetchImpl(url, {
      headers: ownerAuth(identity, 'GET', new URL(url).pathname, new Uint8Array(0), this.now()),
    }));
    return parseStatusRecord(await jsonRecord(response), jobId);
  }

  async cancel(jobId: string, identity: DeviceIdentity): Promise<{ jobId: string; status: ManagedArchiveStatus }> {
    requireJobId(jobId);
    const url = `${this.baseUrl}/api/archive/jobs/${jobId}`;
    const response = await requireOk(await this.fetchImpl(url, {
      method: 'DELETE',
      headers: ownerAuth(identity, 'DELETE', new URL(url).pathname, new Uint8Array(0), this.now()),
    }));
    const body = await jsonRecord(response);
    if (body.jobId !== jobId) throw new TypeError('Managed archive cancel response is invalid');
    return { jobId, status: statusValue(body.status) };
  }

  private entitlementHeaders(extra: Record<string, string>): Record<string, string> {
    if (!this.entitlementToken) throw new TypeError('Managed archive entitlement is missing');
    return { Authorization: `Bearer ${this.entitlementToken}`, ...extra };
  }
}
