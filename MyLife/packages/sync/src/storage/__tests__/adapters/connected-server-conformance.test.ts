import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../../encryption/sha256';
import { sha512Hex } from '../../../node/hkdf';
import {
  STORAGE_AUTH_DOMAIN,
  STORAGE_V1_SUPPORTED_OPERATIONS,
  signStorageCapabilityDescriptor,
  signStorageChallengeResponse,
  storageOperatorPublicKeyFromPrivateKey,
  type StorageCapabilityDescriptor,
  type UnsignedStorageCapabilityDescriptor,
} from '../../connected-descriptor';
import { runStorageAdapterConformance } from '../../conformance';
import type { InMemoryVerificationMode } from '../../fakes';
import type { EncryptedStorageObject, StorageAuthorizationInput } from '../../types';
import {
  ConnectedServerStorageAdapter,
  type ConnectedServerAuthorizationProvider,
} from '../../adapters/connected-server';
import type { HttpTransportRequest, HttpTransportResponse } from '../../adapters/http';
import {
  copyRequest,
  header,
  jsonResponse,
  parseRequestObject,
  response,
} from './provider-test-support';
import { createProviderConformanceFixture } from './provider-test-support';

const NOW = Date.parse('2026-07-14T16:00:00.000Z');
const ENDPOINT = 'https://storage.example.test/api/storage/v1';
const DESCRIPTOR_URL = `${ENDPOINT}/descriptor`;
const OPERATOR_SEED = '31'.repeat(32);
const OTHER_OPERATOR_SEED = '42'.repeat(32);
const OPERATOR_KEY = storageOperatorPublicKeyFromPrivateKey(OPERATOR_SEED);
const CREDENTIAL_REF = 'securestore://storage/connected-test';
const AUTHORIZATION = 'Bearer connected-test';
const ENTITLEMENT = 'entitlement-test';
const MAXIMUM_OBJECT_BYTES = 1_024;
const UPLOAD_BLOCK_BYTES = 257;

runStorageAdapterConformance(
  'ConnectedServerStorageAdapter',
  () => createConnectedFixture(),
  {
    testApi: { describe, it },
    authorizeInput: { kind: 'stored_credential', credentialRef: CREDENTIAL_REF },
  },
);

describe('ConnectedServerStorageAdapter descriptor gate', () => {
  it('authorizes only after descriptor, challenge, authenticated health, and quota in order', async () => {
    const server = new FakeConnectedStorageServer();
    const adapter = adapterFor(server);

    await expect(adapter.authorize(storedAuthorization())).resolves.toMatchObject({ kind: 'authorized' });

    expect(server.log.slice(0, 4).map((request) => new URL(request.url).pathname)).toEqual([
      '/api/storage/v1/descriptor',
      '/api/storage/v1/challenge',
      '/api/storage/v1/health',
      '/api/storage/v1/quota',
    ]);
    expect(header(server.log[0]?.headers ?? {}, 'authorization')).toBeNull();
    expect(header(server.log[1]?.headers ?? {}, 'authorization')).toBeNull();
    expect(header(server.log[2]?.headers ?? {}, 'authorization')).toBe(AUTHORIZATION);
    expect(server.log.some((request) => request.url.endsWith('/objects'))).toBe(false);
  });

  it('never authorizes or uploads to a reachable but unsigned server', async () => {
    const server = new FakeConnectedStorageServer();
    const unsigned: Partial<StorageCapabilityDescriptor> = { ...server.descriptor };
    delete unsigned.signature;
    server.descriptorBody = unsigned;
    const adapter = adapterFor(server);

    await expect(adapter.authorize(storedAuthorization()))
      .rejects.toMatchObject({ code: 'provider_error', retryable: false });
    expect((await adapter.health()).state).toBe('auth_required');
    await expect(adapter.putObject(object('blocked', new Uint8Array([1]))))
      .rejects.toMatchObject({ code: 'auth_required' });
    expect(server.log).toHaveLength(1);
  });

  it.each([
    ['expired', (server: FakeConnectedStorageServer) => {
      server.descriptor = signDescriptor({
        issuedAt: '2026-07-14T15:00:00.000Z',
        expiresAt: '2026-07-14T15:30:00.000Z',
      });
    }],
    ['tampered', (server: FakeConnectedStorageServer) => {
      server.descriptor = { ...server.descriptor, maximumObjectBytes: 99 };
    }],
    ['http endpoint', (server: FakeConnectedStorageServer) => {
      server.descriptor = signDescriptor(
        { endpoint: 'http://192.168.1.20/api/storage/v1' },
        true,
      );
    }],
  ] as const)('rejects an %s descriptor before challenge or health', async (_label, mutate) => {
    const server = new FakeConnectedStorageServer();
    mutate(server);
    const adapter = adapterFor(server);

    await expect(adapter.authorize(storedAuthorization()))
      .rejects.toMatchObject({ code: 'provider_error', retryable: false });
    expect(server.log).toHaveLength(1);
  });

  it('rejects a valid descriptor signed by a different pinned operator', async () => {
    const server = new FakeConnectedStorageServer();
    const adapter = adapterFor(server, {
      expectedOperatorKey: storageOperatorPublicKeyFromPrivateKey(OTHER_OPERATOR_SEED),
    });

    await expect(adapter.authorize(storedAuthorization()))
      .rejects.toMatchObject({ code: 'provider_error', retryable: false });
    expect(server.log).toHaveLength(1);
  });

  it('rejects a challenge signed by the wrong operator and does not send credentials', async () => {
    const server = new FakeConnectedStorageServer();
    server.tamperChallengeSignature = true;
    const adapter = adapterFor(server);

    await expect(adapter.authorize(storedAuthorization()))
      .rejects.toMatchObject({ code: 'provider_error', retryable: false });
    expect(server.log).toHaveLength(2);
    expect(server.log.every((request) => header(request.headers, 'authorization') === null)).toBe(true);
  });

  it('server-enforced nonce replay prevents a second adapter from authorizing', async () => {
    const server = new FakeConnectedStorageServer();
    const fixedNonce = 'ef'.repeat(32);
    const first = adapterFor(server, { nonceFactory: () => fixedNonce });
    const second = adapterFor(server, { nonceFactory: () => fixedNonce });

    await expect(first.authorize(storedAuthorization())).resolves.toMatchObject({ kind: 'authorized' });
    await expect(second.authorize(storedAuthorization()))
      .rejects.toMatchObject({ code: 'provider_error', retryable: false });
    expect(server.challengeAttempts).toBe(2);
  });

  it('health failure and signed quota mismatch both fail before readiness', async () => {
    const unhealthy = new FakeConnectedStorageServer();
    unhealthy.healthy = false;
    await expect(adapterFor(unhealthy).authorize(storedAuthorization()))
      .rejects.toMatchObject({ code: 'provider_error' });

    const wrongQuota = new FakeConnectedStorageServer();
    wrongQuota.quotaCapBytes = 2_048;
    await expect(adapterFor(wrongQuota).authorize(storedAuthorization()))
      .rejects.toMatchObject({ code: 'provider_error' });
  });

  it('permits private-network HTTP only when both descriptor and adapter opt in', async () => {
    const server = new FakeConnectedStorageServer();
    server.descriptor = signDescriptor({ endpoint: 'http://192.168.1.20/api/storage/v1' }, true);
    const adapter = adapterFor(server, {
      descriptorUrl: 'http://192.168.1.20/api/storage/v1/descriptor',
      allowInsecureLocalNetwork: true,
    });

    await expect(adapter.authorize(storedAuthorization())).resolves.toMatchObject({ kind: 'authorized' });
  });
});

describe('ConnectedServerStorageAdapter wire hardening', () => {
  it('accepts only the API sha512 checksum or an exact read-back as verification evidence', async () => {
    const checksummed = new FakeConnectedStorageServer();
    const checksumAdapter = adapterFor(checksummed);
    await checksumAdapter.authorize(storedAuthorization());
    const input = object('checksum', new Uint8Array([7, 8, 9]));
    await expect(putToCompletion(checksumAdapter, input)).resolves.toMatchObject({
      verified: true,
      verification: { kind: 'provider_checksum', algorithm: 'sha512', value: input.ciphertextHash },
    });

    const readBack = new FakeConnectedStorageServer();
    readBack.verificationMode = 'read_back';
    const readBackAdapter = adapterFor(readBack);
    await readBackAdapter.authorize(storedAuthorization());
    await expect(putToCompletion(readBackAdapter, object('read-back', new Uint8Array([1, 2, 3]))))
      .resolves.toMatchObject({ verified: true, verification: { kind: 'read_back' } });

    const unverified = new FakeConnectedStorageServer();
    unverified.verificationMode = 'none';
    const unverifiedAdapter = adapterFor(unverified);
    await unverifiedAdapter.authorize(storedAuthorization());
    await expect(putToCompletion(unverifiedAdapter, object('none', new Uint8Array([4, 5, 6]))))
      .resolves.toMatchObject({ verified: false, verification: { kind: 'none' } });
  });

  it('rejects a mismatched completion checksum without trusting object metadata', async () => {
    const server = new FakeConnectedStorageServer();
    server.corruptCompletionChecksum = true;
    const adapter = adapterFor(server);
    await adapter.authorize(storedAuthorization());

    await expect(putToCompletion(adapter, object('bad-checksum', new Uint8Array([8, 8, 8]))))
      .rejects.toMatchObject({ code: 'corrupt_ciphertext', retryable: false });
  });

  it('rejects an existing object whose data class differs', async () => {
    const server = new FakeConnectedStorageServer();
    const adapter = adapterFor(server);
    await adapter.authorize(storedAuthorization());
    const input = object('data-class-conflict', new Uint8Array([3, 1, 4]));
    await putToCompletion(adapter, input);

    await expect(adapter.putObject({ ...input, dataClass: 'different-class' }))
      .rejects.toMatchObject({ code: 'corrupt_ciphertext', retryable: false });
  });

  it('rejects ranged bytes whose content-range does not match the request', async () => {
    const server = new FakeConnectedStorageServer();
    const adapter = adapterFor(server);
    await adapter.authorize(storedAuthorization());
    const input = object('bad-content-range', new Uint8Array([5, 8, 13]));
    await putToCompletion(adapter, input);
    server.corruptContentRange = true;

    await expect(adapter.getObject(
      { objectId: input.objectId },
      { offset: 1, length: 1 },
    )).rejects.toMatchObject({ code: 'provider_error', retryable: false });
  });
});

interface FakeObject {
  bytes: Uint8Array;
  dataClass: string;
  version: string;
  createdAt: string;
}

interface FakeUpload {
  totalBlocks: number;
  blocks: Map<number, Uint8Array>;
}

class FakeConnectedStorageServer {
  readonly log: HttpTransportRequest[] = [];
  readonly objects = new Map<string, FakeObject>();
  readonly uploads = new Map<string, FakeUpload>();
  readonly usedChallengeNonces = new Set<string>();
  descriptor: StorageCapabilityDescriptor = signDescriptor();
  descriptorBody: unknown | null = null;
  verificationMode: InMemoryVerificationMode = 'provider_checksum';
  quotaUsedBytes = 0;
  quotaCapBytes = MAXIMUM_OBJECT_BYTES;
  healthy = true;
  provisioned = true;
  tamperChallengeSignature = false;
  corruptCompletionChecksum = false;
  corruptContentRange = false;
  challengeAttempts = 0;
  private version = 0;
  private hideNextVerificationRead = false;

  readonly send = async (request: HttpTransportRequest): Promise<HttpTransportResponse> => {
    this.log.push(copyRequest(request));
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.endsWith('/descriptor')) return jsonResponse(200, this.descriptorBody ?? this.descriptor);
    if (path.endsWith('/challenge')) return this.challenge(request);
    if (!this.isAuthorized(request)) return jsonResponse(401, { error: 'auth_required' });
    if (path.endsWith('/health')) {
      return jsonResponse(this.healthy ? 200 : 503, { ok: this.healthy, provisioned: this.provisioned });
    }
    if (path.endsWith('/quota')) {
      return jsonResponse(200, { usedBytes: this.quotaUsedBytes, capBytes: this.quotaCapBytes });
    }
    if (path.endsWith('/account/delete')) {
      this.objects.clear();
      this.uploads.clear();
      return jsonResponse(200, { deleted: { objects: 0, blocks: 0 } });
    }
    if (path.endsWith('/objects') && request.method === 'POST') return this.upload(request);
    if (path.endsWith('/objects') && request.method === 'GET') return this.list(url);

    const complete = /\/objects\/([A-Za-z0-9_-]+)\/complete$/u.exec(path);
    if (complete?.[1] && request.method === 'POST') return this.complete(complete[1], request);
    const objectMatch = /\/objects\/([A-Za-z0-9_-]+)$/u.exec(path);
    if (!objectMatch?.[1]) return jsonResponse(404, { error: 'not_found' });
    const objectId = decodeURIComponent(objectMatch[1]);
    if (request.method === 'HEAD') return this.head(objectId);
    if (request.method === 'GET') return this.get(objectId, request);
    if (request.method === 'DELETE') return this.delete(objectId);
    return jsonResponse(405, { error: 'method_not_allowed' });
  };

  setQuota(usedBytes: number | null, capBytes: number | null): void {
    this.quotaUsedBytes = usedBytes ?? 0;
    this.quotaCapBytes = capBytes ?? MAXIMUM_OBJECT_BYTES;
  }

  setVerificationMode(mode: InMemoryVerificationMode): void {
    this.verificationMode = mode;
  }

  setPartialPutBytes(_bytes: number | null): void {}

  private challenge(request: HttpTransportRequest): HttpTransportResponse {
    this.challengeAttempts += 1;
    const body = parseRequestObject(request.body);
    const nonce = typeof body.nonce === 'string' ? body.nonce : '';
    if (this.usedChallengeNonces.has(nonce)) return jsonResponse(409, { error: 'replayed_nonce' });
    this.usedChallengeNonces.add(nonce);
    const responseValue = signStorageChallengeResponse({
      version: 1,
      authDomain: STORAGE_AUTH_DOMAIN,
      endpoint: this.descriptor.endpoint,
      operatorKey: this.descriptor.operatorKey,
      nonce,
      issuedAt: new Date(NOW - 1_000).toISOString(),
      expiresAt: new Date(NOW + 30_000).toISOString(),
    }, OPERATOR_SEED, {
      allowInsecureLocalNetwork: this.descriptor.endpoint.startsWith('http://'),
    });
    return jsonResponse(200, this.tamperChallengeSignature
      ? { ...responseValue, signature: `00${responseValue.signature.slice(2)}` }
      : responseValue);
  }

  private upload(request: HttpTransportRequest): HttpTransportResponse {
    const objectId = header(request.headers, 'x-mk-content-id');
    const blockIndex = Number(header(request.headers, 'x-mk-block-index'));
    const totalBlocks = Number(header(request.headers, 'x-mk-total-blocks'));
    const blockHash = header(request.headers, 'x-mk-block-hash');
    const bytes = request.body?.slice() ?? new Uint8Array(0);
    if (!objectId
      || !Number.isInteger(blockIndex)
      || !Number.isInteger(totalBlocks)
      || blockIndex < 0
      || blockIndex >= totalBlocks
      || sha256Hex(bytes) !== blockHash) return jsonResponse(400, { error: 'bad_request' });
    const upload = this.uploads.get(objectId) ?? { totalBlocks, blocks: new Map<number, Uint8Array>() };
    if (upload.totalBlocks !== totalBlocks) return jsonResponse(409, { error: 'upload_conflict' });
    upload.blocks.set(blockIndex, bytes);
    this.uploads.set(objectId, upload);
    const stored = Array.from({ length: totalBlocks }, (_, index) => upload.blocks.has(index));
    const nextMissing = stored.findIndex((value) => !value);
    return jsonResponse(200, {
      ok: true,
      contentId: objectId,
      stored,
      nextMissing: nextMissing < 0 ? null : nextMissing,
      complete: nextMissing < 0,
      usedBytes: this.quotaUsedBytes,
      capBytes: this.quotaCapBytes,
    });
  }

  private complete(objectId: string, request: HttpTransportRequest): HttpTransportResponse {
    const upload = this.uploads.get(objectId);
    if (!upload) return jsonResponse(404, { error: 'upload_not_found' });
    const body = parseRequestObject(request.body);
    const parts: Uint8Array[] = [];
    for (let index = 0; index < upload.totalBlocks; index += 1) {
      const part = upload.blocks.get(index);
      if (!part) return jsonResponse(409, { error: 'missing_blocks' });
      parts.push(part);
    }
    const bytes = concatParts(parts);
    if (body.encryptedBytes !== bytes.length || body.ciphertextHash !== sha512Hex(bytes)) {
      return jsonResponse(409, { error: 'ciphertext_mismatch' });
    }
    const existing = this.objects.get(objectId);
    if (existing && !equalBytes(existing.bytes, bytes)) return jsonResponse(409, { error: 'object_conflict' });
    const stored: FakeObject = existing ?? {
      bytes,
      dataClass: typeof body.dataClass === 'string' ? body.dataClass : 'encrypted_object',
      version: `connected-v${this.version += 1}`,
      createdAt: new Date(NOW).toISOString(),
    };
    this.objects.set(objectId, stored);
    if (this.verificationMode === 'none') this.hideNextVerificationRead = true;
    const checksumValue = this.corruptCompletionChecksum ? '0'.repeat(128) : sha512Hex(stored.bytes);
    return jsonResponse(existing ? 200 : 201, {
      object: this.publicObject(objectId, stored),
      ...(this.verificationMode === 'provider_checksum'
        ? { checksum: { algorithm: 'sha512', value: checksumValue } }
        : {}),
    });
  }

  private head(objectId: string): HttpTransportResponse {
    const stored = this.objects.get(objectId);
    if (!stored) return jsonResponse(404, { error: 'not_found' });
    return response(200, {
      'X-Mk-Encrypted-Bytes': String(stored.bytes.length),
      'X-Mk-Ciphertext-Hash': sha512Hex(stored.bytes),
      'X-Mk-Object-Version': stored.version,
      'X-Mk-Data-Class': stored.dataClass,
    });
  }

  private get(objectId: string, request: HttpTransportRequest): HttpTransportResponse {
    if (this.hideNextVerificationRead) {
      this.hideNextVerificationRead = false;
      return jsonResponse(404, { error: 'not_found' });
    }
    const stored = this.objects.get(objectId);
    if (!stored) return jsonResponse(404, { error: 'not_found' });
    const checksum = sha512Hex(stored.bytes);
    const range = header(request.headers, 'range');
    if (range === null) return response(200, { 'X-Mk-Ciphertext-Hash': checksum }, stored.bytes.slice());
    const match = /^bytes=(\d+)-(\d+)$/u.exec(range);
    if (!match) return jsonResponse(416, { error: 'range_not_satisfiable' });
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start >= stored.bytes.length || end < start) return jsonResponse(416, { error: 'range_not_satisfiable' });
    const actualEnd = Math.min(end, stored.bytes.length - 1);
    return response(206, {
      'X-Mk-Ciphertext-Hash': checksum,
      'Content-Range': this.corruptContentRange
        ? `bytes 0-${actualEnd}/${stored.bytes.length}`
        : `bytes ${start}-${actualEnd}/${stored.bytes.length}`,
    }, stored.bytes.slice(start, actualEnd + 1));
  }

  private list(url: URL): HttpTransportResponse {
    const sorted = [...this.objects.entries()].sort(([left], [right]) => left.localeCompare(right));
    const cursor = url.searchParams.get('cursor');
    const start = cursor?.startsWith('connected-cursor:')
      ? Number(cursor.slice('connected-cursor:'.length))
      : 0;
    const pageSize = Math.min(2, Number(url.searchParams.get('limit') ?? 2));
    const page = sorted.slice(start, start + pageSize);
    return jsonResponse(200, {
      items: page.map(([objectId, stored]) => this.publicObject(objectId, stored)),
      nextCursor: start + page.length < sorted.length ? `connected-cursor:${start + page.length}` : null,
    });
  }

  private delete(objectId: string): HttpTransportResponse {
    const deleted = this.objects.delete(objectId);
    this.uploads.delete(objectId);
    return jsonResponse(200, {
      deleted,
      objectId,
      freedBytes: 0,
      deletedBlocks: 0,
      deletedBackupRecords: 0,
    });
  }

  private publicObject(objectId: string, stored: FakeObject): Record<string, unknown> {
    return {
      id: objectId,
      encryptedBytes: stored.bytes.length,
      ciphertextHash: sha512Hex(stored.bytes),
      dataClass: stored.dataClass,
      version: stored.version,
      createdAt: stored.createdAt,
    };
  }

  private isAuthorized(request: HttpTransportRequest): boolean {
    return header(request.headers, 'authorization') === AUTHORIZATION
      && header(request.headers, 'x-mk-entitlement') === ENTITLEMENT;
  }
}

function createConnectedFixture() {
  const server = new FakeConnectedStorageServer();
  const adapter = adapterFor(server);
  return createProviderConformanceFixture(adapter, server);
}

function adapterFor(
  server: FakeConnectedStorageServer,
  overrides: Partial<ConstructorParameters<typeof ConnectedServerStorageAdapter>[0]> = {},
): ConnectedServerStorageAdapter {
  let revoked = false;
  const authorizationProvider: ConnectedServerAuthorizationProvider = {
    async getRequestHeaders() {
      return revoked ? null : { Authorization: AUTHORIZATION, 'X-Mk-Entitlement': ENTITLEMENT };
    },
    async revoke() {
      revoked = true;
    },
  };
  return new ConnectedServerStorageAdapter({
    descriptorUrl: DESCRIPTOR_URL,
    expectedOperatorKey: OPERATOR_KEY,
    transport: server.send,
    authorizationProvider,
    credentialRef: CREDENTIAL_REF,
    uploadBlockBytes: UPLOAD_BLOCK_BYTES,
    pageSize: 2,
    now: () => NOW,
    nonceFactory: nonceSequence(),
    ...overrides,
  });
}

function nonceSequence(): () => string {
  let value = 0;
  return () => (value += 1).toString(16).padStart(64, '0');
}

function storedAuthorization(): StorageAuthorizationInput {
  return { kind: 'stored_credential', credentialRef: CREDENTIAL_REF };
}

function signDescriptor(
  overrides: Partial<UnsignedStorageCapabilityDescriptor> = {},
  allowInsecureLocalNetwork = false,
): StorageCapabilityDescriptor {
  return signStorageCapabilityDescriptor({
    version: 1,
    endpoint: ENDPOINT,
    operatorKey: OPERATOR_KEY,
    supportedOperations: [...STORAGE_V1_SUPPORTED_OPERATIONS],
    maximumObjectBytes: MAXIMUM_OBJECT_BYTES,
    quotaBytes: MAXIMUM_OBJECT_BYTES,
    retention: 'rolling30',
    authDomain: STORAGE_AUTH_DOMAIN,
    issuedAt: new Date(NOW - 5 * 60_000).toISOString(),
    expiresAt: new Date(NOW + 5 * 60_000).toISOString(),
    ...overrides,
  }, OPERATOR_SEED, { allowInsecureLocalNetwork });
}

function object(objectId: string, ciphertext: Uint8Array): EncryptedStorageObject {
  return {
    objectId,
    dataClass: 'conformance',
    ciphertext,
    ciphertextHash: sha512Hex(ciphertext),
    encryptedBytes: ciphertext.length,
  };
}

async function putToCompletion(
  adapter: ConnectedServerStorageAdapter,
  input: EncryptedStorageObject,
) {
  let result = await adapter.putObject(input);
  while (!result.complete) result = await adapter.putObject(input, result.resumeToken);
  return result;
}

function concatParts(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
