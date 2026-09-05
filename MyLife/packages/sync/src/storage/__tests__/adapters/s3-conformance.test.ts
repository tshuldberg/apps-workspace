import { describe, expect, it } from 'vitest';
import { sha256Bytes } from '../../../encryption/sha256';
import { sha512Hex } from '../../../node/hkdf';
import { runStorageAdapterConformance } from '../../conformance';
import type {
  InMemoryVerificationMode,
  StorageAdapterOperation,
} from '../../fakes';
import type {
  EncryptedStorageObject,
  StorageDestinationAdapter,
  StorageHealth,
  StorageQuota,
} from '../../types';
import { StorageAdapterError } from '../../types';
import type {
  HttpTransportRequest,
  HttpTransportResponse,
} from '../../adapters/http';
import { bytesToBase64, responseHeader } from '../../adapters/http';
import {
  S3StorageAdapter,
  type S3AddressingStyle,
  type S3Credentials,
} from '../../adapters/s3';

const encoder = new TextEncoder();
const TEST_BUCKET = 'test-bucket';
const TEST_PREFIX = 'Meerkat/';
const FIXED_NOW = new Date('2026-07-14T12:00:00.000Z');

runStorageAdapterConformance(
  'S3StorageAdapter',
  () => createS3Fixture(),
  {
    testApi: { describe, it },
    authorizeInput: {
      kind: 'interactive',
      credentialRef: 'securestore://storage/s3-test',
    },
  },
);

describe('S3StorageAdapter protocol behavior', () => {
  it('resumes from server ListParts state, including a part beyond the stale cursor', async () => {
    const provider = new FakeS3Transport();
    const adapter = adapterFor(provider, {
      multipartThresholdBytes: 4,
      partSizeBytes: 4,
      maximumPartsPerCall: 1,
    });
    await authorize(adapter);
    const input = object('multipart-resume', new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    const first = await adapter.putObject(input);
    expect(first).toMatchObject({ complete: false, encryptedBytes: 4, resumeToken: { offset: 4 } });
    if (first.complete) throw new Error('expected multipart checkpoint');

    provider.uploadNextPartOutOfBand(input.ciphertext.slice(4, 8));
    const completed = await adapter.putObject(input, first.resumeToken);

    expect(completed).toMatchObject({
      complete: true,
      verified: true,
      verification: { kind: 'provider_checksum', algorithm: 'sha256' },
    });
    expect(provider.log.filter((request) => (
      request.method === 'GET' && new URL(request.url).searchParams.has('uploadId')
    ))).toHaveLength(1);
    await expect(adapter.getObject({ objectId: input.objectId })).resolves.toEqual(input.ciphertext);
  });

  it('aborts the multipart upload when completion fails', async () => {
    const provider = new FakeS3Transport();
    provider.failCompletion = true;
    const adapter = adapterFor(provider, {
      multipartThresholdBytes: 2,
      partSizeBytes: 16,
      maximumPartsPerCall: 1,
    });
    await authorize(adapter);

    await expect(adapter.putObject(object('abort-completion', new Uint8Array([1, 2, 3]))))
      .rejects.toMatchObject({ code: 'provider_error', retryable: true });
    expect(provider.abortCount).toBe(1);
    expect(provider.activeUploadCount).toBe(0);
  });

  it('uses a validated checksum echo for PutObject evidence', async () => {
    const provider = new FakeS3Transport();
    provider.verificationMode = 'provider_checksum';
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('checksum-echo', new Uint8Array([2, 4, 6, 8]));
    const result = await adapter.putObject(input);

    expect(result.verification).toEqual({
      kind: 'provider_checksum',
      algorithm: 'sha256',
      value: bytesToBase64(sha256Bytes(input.ciphertext)),
    });
    expect(provider.log.filter((request) => request.method === 'GET')).toHaveLength(0);
  });

  it('never treats a tempting multipart ETag as a content hash', async () => {
    const provider = new FakeS3Transport();
    provider.verificationMode = 'read_back';
    const adapter = adapterFor(provider, {
      multipartThresholdBytes: 2,
      partSizeBytes: 3,
      maximumPartsPerCall: 10,
    });
    await authorize(adapter);
    const input = object('multipart-etag', new Uint8Array([9, 8, 7, 6, 5, 4]));
    const result = await adapter.putObject(input);
    const metadata = await adapter.headObject({ objectId: input.objectId });

    expect(result).toMatchObject({
      complete: true,
      verified: true,
      verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash },
    });
    expect(result.remoteVersion).toMatch(/^"d41d8cd98f00b204e9800998ecf8427e-2"$/);
    expect(metadata?.ciphertextHash).toBeNull();
  });

  it('constructs path and virtual-host URLs and falls back through HeadBucket', async () => {
    const pathProvider = new FakeS3Transport();
    const pathAdapter = adapterFor(pathProvider, { addressingStyle: 'path' });
    await authorize(pathAdapter);
    await pathAdapter.health();
    expect(pathProvider.log[0]?.url).toBe('https://s3.example.test/test-bucket');

    const virtualProvider = new FakeS3Transport();
    const virtualAdapter = adapterFor(virtualProvider, { addressingStyle: 'virtual' });
    await authorize(virtualAdapter);
    await virtualAdapter.health();
    expect(virtualProvider.log[0]?.url).toBe('https://test-bucket.s3.example.test/');

    const fallbackProvider = new FakeS3Transport();
    fallbackProvider.virtualHeadSupported = false;
    const fallbackAdapter = adapterFor(fallbackProvider, { addressingStyle: 'auto' });
    await authorize(fallbackAdapter);
    await expect(fallbackAdapter.health()).resolves.toMatchObject({ state: 'ok' });
    const hosts = fallbackProvider.log.map((request) => new URL(request.url).hostname);
    expect(hosts).toContain('test-bucket.s3.example.test');
    expect(hosts).toContain('s3.example.test');
  });

  it('signs and forwards temporary session tokens as signed headers', async () => {
    const provider = new FakeS3Transport();
    const adapter = adapterFor(provider, {
      credentials: {
        accessKeyId: 'ASIATESTACCESS',
        secretAccessKey: 'temporary-test-secret',
        sessionToken: 'temporary-session-token',
      },
    });
    await authorize(adapter);
    await adapter.health();
    const request = provider.log[0];

    expect(header(request?.headers ?? {}, 'x-amz-security-token')).toBe('temporary-session-token');
    expect(header(request?.headers ?? {}, 'authorization'))
      .toContain('SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-security-token');
  });

  it.each(['PUT', 'GET'] as const)(
    'refuses a cross-origin %s redirect without signing a second request',
    async (method) => {
      const provider = new FakeS3Transport();
      const adapter = adapterFor(provider);
      await authorize(adapter);
      const input = object(`redirect-${method.toLowerCase()}`, new Uint8Array([3, 1, 4]));
      if (method === 'GET') await adapter.putObject(input);
      provider.redirectOnce(method, `https://attacker.example.test/${TEST_BUCKET}/${TEST_PREFIX}${input.objectId}`);

      const operation = method === 'PUT'
        ? adapter.putObject(input)
        : adapter.getObject({ objectId: input.objectId });
      await expect(operation).rejects.toMatchObject({ code: 'unsafe_redirect', retryable: false });
      expect(provider.log.some((request) => new URL(request.url).hostname === 'attacker.example.test')).toBe(false);
    },
  );

  it('re-signs one same-origin redirect and completes the operation', async () => {
    const provider = new FakeS3Transport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('same-origin', new Uint8Array([5, 5, 5]));
    provider.redirectOnce(
      'PUT',
      `https://s3.example.test/${TEST_BUCKET}/${TEST_PREFIX}${input.objectId}?redirected=1`,
    );
    const result = await adapter.putObject(input);

    expect(result.verified).toBe(true);
    const puts = provider.log.filter((request) => request.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts.every((request) => header(request.headers, 'authorization')?.startsWith('AWS4-HMAC-SHA256 ')))
      .toBe(true);
  });

  it('estimates quota by summing bounded ListObjectsV2 pages', async () => {
    const provider = new FakeS3Transport();
    const adapter = adapterFor(provider, { pageSize: 2 });
    await authorize(adapter);
    for (const [id, bytes] of [
      ['quota-a', new Uint8Array([1])],
      ['quota-b', new Uint8Array([1, 2])],
      ['quota-c', new Uint8Array([1, 2, 3])],
    ] as const) {
      await adapter.putObject(object(id, bytes));
    }
    await expect(adapter.quota()).resolves.toEqual({ usedBytes: 6, capBytes: null, estimated: true });
    expect(provider.log.filter((request) => new URL(request.url).searchParams.get('list-type') === '2').length)
      .toBeGreaterThanOrEqual(2);
  });

  it.each([
    [401, 'auth_required', false],
    [403, 'revoked', false],
    [429, 'rate_limited', true],
    [503, 'provider_error', true],
  ] as const)('maps HTTP %i to %s with an honest retry flag', async (status, code, retryable) => {
    const provider = new FakeS3Transport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    provider.forceStatusOnce('HEAD', status);
    await expect(adapter.headObject({ objectId: 'error-map' })).rejects.toMatchObject({ code, retryable });
  });

  it('maps a PUT 404 and sanitizes network failures as retryable unreachable', async () => {
    const provider = new FakeS3Transport();
    const credentials: S3Credentials = {
      accessKeyId: 'AKIATESTACCESS',
      secretAccessKey: 'do-not-leak-this-secret',
    };
    const adapter = adapterFor(provider, { credentials });
    await authorize(adapter);
    provider.forceStatusOnce('PUT', 404);
    await expect(adapter.putObject(object('put-not-found', new Uint8Array([1]))))
      .rejects.toMatchObject({ code: 'not_found', retryable: false });

    provider.throwNetworkOnce('HEAD');
    try {
      await adapter.headObject({ objectId: 'offline' });
      throw new Error('expected unreachable error');
    } catch (error) {
      expect(error).toMatchObject({ code: 'unreachable', retryable: true });
      expect(String(error)).not.toContain(credentials.secretAccessKey);
    }
  });
});

interface StoredS3Object {
  bytes: Uint8Array;
  dataClass: string;
  etag: string;
}

interface FakeUploadedPart {
  bytes: Uint8Array;
  etag: string;
  checksum: string;
}

interface FakeMultipartUpload {
  key: string;
  dataClass: string;
  parts: Map<number, FakeUploadedPart>;
}

class FakeS3Transport {
  readonly log: HttpTransportRequest[] = [];
  readonly objects = new Map<string, StoredS3Object>();
  verificationMode: InMemoryVerificationMode = 'provider_checksum';
  virtualHeadSupported = true;
  failCompletion = false;
  abortCount = 0;
  private readonly uploads = new Map<string, FakeMultipartUpload>();
  private readonly forcedStatuses = new Map<string, number[]>();
  private readonly networkThrows = new Map<string, number>();
  private redirect: { method: string; location: string; remaining: number } | null = null;
  private objectVersion = 0;
  private uploadVersion = 0;
  private hideNextGet = false;

  get activeUploadCount(): number {
    return this.uploads.size;
  }

  async send(request: HttpTransportRequest): Promise<HttpTransportResponse> {
    this.log.push({
      ...request,
      headers: { ...request.headers },
      ...(request.body === undefined ? {} : { body: request.body.slice() }),
    });
    const networkCount = this.networkThrows.get(request.method) ?? 0;
    if (networkCount > 0) {
      this.networkThrows.set(request.method, networkCount - 1);
      throw new Error('network failed with an irrelevant provider detail');
    }
    if (this.redirect?.method === request.method && this.redirect.remaining > 0) {
      this.redirect.remaining -= 1;
      return response(307, { Location: this.redirect.location });
    }
    const statuses = this.forcedStatuses.get(request.method);
    const forcedStatus = statuses?.shift();
    if (statuses !== undefined && statuses.length === 0) this.forcedStatuses.delete(request.method);
    if (forcedStatus !== undefined) return response(forcedStatus);
    if (!hasHeader(request.headers, 'authorization')) return response(401);
    if (!hasHeader(request.headers, 'x-amz-content-sha256')) return response(400);

    const parsed = parseS3RequestUrl(new URL(request.url));
    if (parsed === null) return response(404);
    const { style, key, url } = parsed;
    if (request.method === 'HEAD' && key === null) {
      if (style === 'virtual' && !this.virtualHeadSupported) return response(400);
      return response(200);
    }
    if (url.searchParams.get('list-type') === '2' && request.method === 'GET') {
      return this.listObjects(url);
    }
    if (key === null) return response(404);
    const uploadId = url.searchParams.get('uploadId');
    if (request.method === 'POST' && url.searchParams.has('uploads')) {
      return this.createMultipart(key, request);
    }
    if (uploadId !== null && request.method === 'PUT') {
      return this.uploadPart(uploadId, url, request);
    }
    if (uploadId !== null && request.method === 'GET') {
      return this.listParts(uploadId);
    }
    if (uploadId !== null && request.method === 'POST') {
      return this.completeMultipart(uploadId);
    }
    if (uploadId !== null && request.method === 'DELETE') {
      const deleted = this.uploads.delete(uploadId);
      if (deleted) this.abortCount += 1;
      return response(deleted ? 204 : 404);
    }

    const stored = this.objects.get(key);
    if (request.method === 'HEAD') {
      if (stored === undefined) return response(404);
      return response(200, {
        'Content-Length': String(stored.bytes.length),
        ETag: stored.etag,
        'X-Amz-Meta-Mylife-Data-Class': stored.dataClass,
      });
    }
    if (request.method === 'PUT') {
      if (stored !== undefined && header(request.headers, 'if-none-match') === '*') return response(412);
      const bytes = request.body?.slice() ?? new Uint8Array(0);
      const expectedChecksum = bytesToBase64(sha256Bytes(bytes));
      if (header(request.headers, 'x-amz-checksum-sha256') !== expectedChecksum) {
        return s3Error(400, 'BadDigest');
      }
      const next: StoredS3Object = {
        bytes,
        dataClass: header(request.headers, 'x-amz-meta-mylife-data-class') ?? 'encrypted_object',
        etag: `"d41d8cd98f00b204e9800998ecf${String(this.objectVersion += 1).padStart(4, '0')}"`,
      };
      this.objects.set(key, next);
      if (this.verificationMode === 'none') this.hideNextGet = true;
      return response(200, {
        ETag: next.etag,
        ...(this.verificationMode === 'provider_checksum'
          ? { 'X-Amz-Checksum-Sha256': expectedChecksum }
          : {}),
      });
    }
    if (request.method === 'GET') {
      if (this.hideNextGet) {
        this.hideNextGet = false;
        return response(404);
      }
      if (stored === undefined) return response(404);
      const range = header(request.headers, 'range');
      if (range === null) return response(200, {}, stored.bytes.slice());
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      if (match === null) return response(416);
      const start = Number.parseInt(match[1] ?? '', 10);
      const end = Number.parseInt(match[2] ?? '', 10);
      return response(206, {}, stored.bytes.slice(start, end + 1));
    }
    if (request.method === 'DELETE') {
      this.objects.delete(key);
      return response(204);
    }
    return response(405);
  }

  redirectOnce(method: string, location: string): void {
    this.redirect = { method, location, remaining: 1 };
  }

  forceStatusOnce(method: string, status: number): void {
    const values = this.forcedStatuses.get(method) ?? [];
    values.push(status);
    this.forcedStatuses.set(method, values);
  }

  throwNetworkOnce(method: string): void {
    this.networkThrows.set(method, (this.networkThrows.get(method) ?? 0) + 1);
  }

  uploadNextPartOutOfBand(bytes: Uint8Array): void {
    const upload = [...this.uploads.values()][0];
    if (upload === undefined) throw new Error('no active upload');
    const partNumber = upload.parts.size + 1;
    upload.parts.set(partNumber, {
      bytes: bytes.slice(),
      etag: `"part-${partNumber}"`,
      checksum: bytesToBase64(sha256Bytes(bytes)),
    });
  }

  private createMultipart(key: string, request: HttpTransportRequest): HttpTransportResponse {
    const uploadId = `upload-${this.uploadVersion += 1}`;
    this.uploads.set(uploadId, {
      key,
      dataClass: header(request.headers, 'x-amz-meta-mylife-data-class') ?? 'encrypted_object',
      parts: new Map(),
    });
    return response(200, { 'Content-Type': 'application/xml' }, encoder.encode(
      `<InitiateMultipartUploadResult><Bucket>${TEST_BUCKET}</Bucket>`
      + `<Key>${escapeXml(key)}</Key><UploadId>${uploadId}</UploadId>`
      + '</InitiateMultipartUploadResult>',
    ));
  }

  private uploadPart(
    uploadId: string,
    url: URL,
    request: HttpTransportRequest,
  ): HttpTransportResponse {
    const upload = this.uploads.get(uploadId);
    const partNumber = Number.parseInt(url.searchParams.get('partNumber') ?? '', 10);
    if (upload === undefined) return s3Error(404, 'NoSuchUpload');
    if (!Number.isSafeInteger(partNumber) || partNumber <= 0) return s3Error(400, 'InvalidPart');
    const bytes = request.body?.slice() ?? new Uint8Array(0);
    const checksum = bytesToBase64(sha256Bytes(bytes));
    if (header(request.headers, 'x-amz-checksum-sha256') !== checksum) return s3Error(400, 'BadDigest');
    const part = { bytes, etag: `"part-${partNumber}"`, checksum };
    upload.parts.set(partNumber, part);
    return response(200, { ETag: part.etag, 'X-Amz-Checksum-Sha256': checksum });
  }

  private listParts(uploadId: string): HttpTransportResponse {
    const upload = this.uploads.get(uploadId);
    if (upload === undefined) return s3Error(404, 'NoSuchUpload');
    const parts = [...upload.parts.entries()]
      .sort(([left], [right]) => left - right)
      .map(([partNumber, part]) => '<Part>'
        + `<PartNumber>${partNumber}</PartNumber>`
        + `<ETag>${escapeXml(part.etag)}</ETag>`
        + `<Size>${part.bytes.length}</Size>`
        + `<ChecksumSHA256>${part.checksum}</ChecksumSHA256>`
        + '</Part>')
      .join('');
    return response(200, { 'Content-Type': 'application/xml' }, encoder.encode(
      `<ListPartsResult>${parts}<IsTruncated>false</IsTruncated></ListPartsResult>`,
    ));
  }

  private completeMultipart(uploadId: string): HttpTransportResponse {
    if (this.failCompletion) return s3Error(503, 'ServiceUnavailable');
    const upload = this.uploads.get(uploadId);
    if (upload === undefined) return s3Error(404, 'NoSuchUpload');
    const parts = [...upload.parts.entries()].sort(([left], [right]) => left - right);
    const bytes = concatenate(parts.map(([, part]) => part.bytes));
    const checksum = bytesToBase64(sha256Bytes(bytes));
    const etag = `"d41d8cd98f00b204e9800998ecf8427e-${parts.length}"`;
    this.objects.set(upload.key, { bytes, dataClass: upload.dataClass, etag });
    this.uploads.delete(uploadId);
    if (this.verificationMode === 'none') this.hideNextGet = true;
    const checksumXml = this.verificationMode === 'provider_checksum'
      ? `<ChecksumSHA256>${checksum}</ChecksumSHA256>`
      : '';
    return response(200, {
      ETag: etag,
      ...(this.verificationMode === 'provider_checksum' ? { 'X-Amz-Checksum-Sha256': checksum } : {}),
    }, encoder.encode(
      '<CompleteMultipartUploadResult>'
      + `<ETag>${escapeXml(etag)}</ETag>${checksumXml}`
      + '</CompleteMultipartUploadResult>',
    ));
  }

  private listObjects(url: URL): HttpTransportResponse {
    const prefix = url.searchParams.get('prefix') ?? '';
    const maxKeys = Number.parseInt(url.searchParams.get('max-keys') ?? '1000', 10);
    const cursor = url.searchParams.get('continuation-token');
    const offset = cursor === null ? 0 : Number.parseInt(cursor.replace(/^cursor-/, ''), 10);
    if (!Number.isSafeInteger(offset) || offset < 0) return s3Error(400, 'InvalidArgument');
    const values = [...this.objects.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .sort(([left], [right]) => left.localeCompare(right));
    const page = values.slice(offset, offset + maxKeys);
    const nextOffset = offset + page.length;
    const contents = page.map(([key, stored]) => '<Contents>'
      + `<Key>${escapeXml(key)}</Key>`
      + `<ETag>${escapeXml(stored.etag)}</ETag>`
      + `<Size>${stored.bytes.length}</Size>`
      + '</Contents>').join('');
    const truncated = nextOffset < values.length;
    return response(200, { 'Content-Type': 'application/xml' }, encoder.encode(
      '<ListBucketResult>'
      + `<IsTruncated>${truncated}</IsTruncated>${contents}`
      + (truncated ? `<NextContinuationToken>cursor-${nextOffset}</NextContinuationToken>` : '')
      + '</ListBucketResult>',
    ));
  }
}

function createS3Fixture(): {
  adapter: StorageDestinationAdapter;
  controls: {
    failNext(operation: StorageAdapterOperation, error: StorageAdapterError): void;
    setQuota(usedBytes: number | null, capBytes: number | null): void;
    setVerificationMode(mode: InMemoryVerificationMode): void;
    setPartialPutBytes(bytes: number | null): void;
    setConflictMode(code: 'conflict' | 'corrupt_ciphertext'): void;
    setHealthState(state: StorageHealth['state'] | null, errorCode?: string): void;
  };
} {
  const provider = new FakeS3Transport();
  const core = adapterFor(provider);
  const faults = new Map<StorageAdapterOperation, StorageAdapterError[]>();
  let healthOverride: StorageHealth['state'] | null = null;
  let healthErrorCode: string | undefined;
  let quotaOverride: StorageQuota | null = null;
  const invoke = async <Result>(
    operation: StorageAdapterOperation,
    callback: () => Promise<Result>,
  ): Promise<Result> => {
    const queued = faults.get(operation);
    const fault = queued?.shift();
    if (queued !== undefined && queued.length === 0) faults.delete(operation);
    if (fault !== undefined) throw fault;
    return callback();
  };
  const adapter: StorageDestinationAdapter = {
    authorize: (input) => invoke('authorize', () => core.authorize(input)),
    revoke: (options) => invoke('revoke', () => core.revoke(options)),
    capabilities: () => invoke('capabilities', () => core.capabilities()),
    health: () => invoke('health', async () => healthOverride === null
      ? core.health()
      : {
        state: healthOverride,
        verifiedReadWrite: false,
        checkedAt: FIXED_NOW.toISOString(),
        ...(healthErrorCode === undefined ? {} : { errorCode: healthErrorCode }),
      }),
    quota: () => invoke('quota', async () => quotaOverride ?? core.quota()),
    putObject: (input, resume) => invoke('putObject', () => core.putObject(input, resume)),
    headObject: (ref) => invoke('headObject', () => core.headObject(ref)),
    getObject: (ref, range) => invoke('getObject', () => core.getObject(ref, range)),
    listObjects: (cursor) => invoke('listObjects', () => core.listObjects(cursor)),
    deleteObject: (ref) => invoke('deleteObject', () => core.deleteObject(ref)),
  };
  return {
    adapter,
    controls: {
      failNext(operation, error) {
        const queued = faults.get(operation) ?? [];
        queued.push(error);
        faults.set(operation, queued);
      },
      setQuota(usedBytes, capBytes) {
        quotaOverride = { usedBytes, capBytes, estimated: false };
      },
      setVerificationMode(mode) {
        provider.verificationMode = mode;
      },
      setPartialPutBytes(bytes) {
        void bytes;
      },
      setConflictMode(code) {
        void code;
      },
      setHealthState(state, errorCode) {
        healthOverride = state;
        healthErrorCode = errorCode;
      },
    },
  };
}

interface AdapterOverrides {
  addressingStyle?: S3AddressingStyle;
  multipartThresholdBytes?: number;
  partSizeBytes?: number;
  maximumPartsPerCall?: number;
  pageSize?: number;
  credentials?: S3Credentials;
}

function adapterFor(provider: FakeS3Transport, overrides: AdapterOverrides = {}): S3StorageAdapter {
  const credentials = overrides.credentials ?? {
    accessKeyId: 'AKIATESTACCESS',
    secretAccessKey: 'test-secret-access-key',
  };
  return new S3StorageAdapter({
    endpoint: 'https://s3.example.test',
    bucket: TEST_BUCKET,
    region: 'us-east-1',
    prefix: TEST_PREFIX,
    addressingStyle: overrides.addressingStyle ?? 'path',
    transport: (request) => provider.send(request),
    credentialProvider: { get: async () => credentials },
    maximumObjectBytes: 1024,
    multipartThresholdBytes: overrides.multipartThresholdBytes ?? 2048,
    partSizeBytes: overrides.partSizeBytes ?? 512,
    maximumPartsPerCall: overrides.maximumPartsPerCall ?? 1,
    pageSize: overrides.pageSize ?? 2,
    now: () => new Date(FIXED_NOW),
  });
}

async function authorize(adapter: StorageDestinationAdapter): Promise<void> {
  const result = await adapter.authorize({
    kind: 'interactive',
    credentialRef: 'securestore://storage/s3-test',
  });
  expect(result.kind).toBe('authorized');
}

function object(objectId: string, bytes: Uint8Array): EncryptedStorageObject {
  return {
    objectId,
    dataClass: 'conformance',
    ciphertext: bytes,
    ciphertextHash: sha512Hex(bytes),
    encryptedBytes: bytes.length,
  };
}

function parseS3RequestUrl(url: URL): {
  style: Exclude<S3AddressingStyle, 'auto'>;
  key: string | null;
  url: URL;
} | null {
  if (url.hostname === `${TEST_BUCKET}.s3.example.test`) {
    const key = decodePathKey(url.pathname.slice(1));
    return { style: 'virtual', key, url };
  }
  if (url.hostname !== 's3.example.test') return null;
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments[0] !== TEST_BUCKET) return null;
  const key = decodePathKey(segments.slice(1).join('/'));
  return { style: 'path', key, url };
}

function decodePathKey(value: string): string | null {
  if (value.length === 0) return null;
  try {
    return value.split('/').map((segment) => decodeURIComponent(segment)).join('/');
  } catch {
    return null;
  }
}

function response(
  status: number,
  headers: Record<string, string> = {},
  body: Uint8Array = new Uint8Array(0),
): HttpTransportResponse {
  return { status, headers, body };
}

function s3Error(status: number, code: string): HttpTransportResponse {
  return response(status, { 'Content-Type': 'application/xml' }, encoder.encode(
    `<Error><Code>${code}</Code><Message>simulated</Message></Error>`,
  ));
}

function header(headers: Readonly<Record<string, string>>, name: string): string | null {
  return responseHeader(headers, name);
}

function hasHeader(headers: Readonly<Record<string, string>>, name: string): boolean {
  return header(headers, name) !== null;
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((length, part) => length + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
