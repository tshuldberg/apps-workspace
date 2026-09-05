import { describe, expect, it } from 'vitest';
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
} from '../../types';
import { StorageAdapterError } from '../../types';
import type {
  HttpTransportRequest,
  HttpTransportResponse,
} from '../../adapters/http';
import { responseHeader } from '../../adapters/http';
import {
  WebdavStorageAdapter,
  type WebdavCredentials,
} from '../../adapters/webdav';

const encoder = new TextEncoder();

runStorageAdapterConformance(
  'WebdavStorageAdapter',
  () => createWebdavFixture(),
  {
    testApi: { describe, it },
    authorizeInput: {
      kind: 'interactive',
      credentialRef: 'securestore://storage/webdav-test',
    },
  },
);

describe('WebdavStorageAdapter hardening', () => {
  it('requires HTTPS except for an explicitly allowed private or local host', () => {
    expect(() => adapterFor(new FakeWebdavTransport(), { baseUrl: 'http://storage.example.test/dav/' }))
      .toThrowError(StorageAdapterError);
    expect(() => adapterFor(new FakeWebdavTransport(), { baseUrl: 'http://192.168.1.20/dav/' }))
      .toThrowError(StorageAdapterError);
    expect(() => adapterFor(new FakeWebdavTransport(), {
      baseUrl: 'http://192.168.1.20/dav/',
      allowInsecureLocalNetwork: true,
    })).not.toThrow();
    expect(() => adapterFor(new FakeWebdavTransport(), {
      baseUrl: 'http://nas.local/dav/',
      allowInsecureLocalNetwork: true,
    })).not.toThrow();
    expect(() => adapterFor(new FakeWebdavTransport(), {
      baseUrl: 'http://storage.example.test/dav/',
      allowInsecureLocalNetwork: true,
    })).toThrowError(StorageAdapterError);
  });

  it('rejects object traversal and remote references outside the app root', async () => {
    const provider = new FakeWebdavTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('../escape', new Uint8Array([1]));
    await expect(adapter.putObject(input)).rejects.toMatchObject({ code: 'provider_error' });
    await expect(adapter.headObject({
      objectId: 'safe-id',
      remoteRef: 'https://dav.example.test/dav/outside/safe-id',
    })).rejects.toMatchObject({ code: 'provider_error' });
    expect(provider.log).toHaveLength(0);
  });

  it('never treats an ETag as verification evidence or a SHA-512 hash', async () => {
    const provider = new FakeWebdavTransport();
    provider.verificationMode = 'none';
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('etag-is-version-only', new Uint8Array([4, 5, 6]));
    const result = await adapter.putObject(input);
    const metadata = await adapter.headObject({ objectId: input.objectId });

    expect(result).toMatchObject({
      complete: true,
      verified: false,
      verification: { kind: 'none' },
    });
    expect(result.remoteVersion).toMatch(/^"dav-v/);
    expect(metadata?.ciphertextHash).toBeNull();
    const verificationGet = provider.log.find((request) => (
      request.method === 'GET' && header(request.headers, 'if-match') !== null
    ));
    expect(header(verificationGet?.headers ?? {}, 'if-match')).toBe(result.remoteVersion);
  });

  it('parses RFC 4331 quota properties and reports absent properties honestly', async () => {
    const provider = new FakeWebdavTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    provider.quotaUsedBytes = 384;
    provider.quotaAvailableBytes = 640;
    await expect(adapter.quota()).resolves.toEqual({ usedBytes: 384, capBytes: 1024, estimated: false });

    provider.exposeQuota = false;
    await expect(adapter.quota()).resolves.toEqual({ usedBytes: null, capBytes: null, estimated: false });
  });

  it.each(['PUT', 'GET'] as const)(
    'refuses a cross-origin %s redirect before credentials reach a second request',
    async (method) => {
      const provider = new FakeWebdavTransport();
      const adapter = adapterFor(provider);
      await authorize(adapter);
      const input = object(`redirect-${method.toLowerCase()}`, new Uint8Array([7, 8, 9]));
      if (method === 'GET') await adapter.putObject(input);
      provider.redirectOnce(method, `https://attacker.example.test/stolen/${input.objectId}`);

      const operation = method === 'PUT'
        ? adapter.putObject(input)
        : adapter.getObject({ objectId: input.objectId });
      await expect(operation).rejects.toMatchObject({ code: 'unsafe_redirect', retryable: false });
      expect(provider.log.some((request) => new URL(request.url).hostname === 'attacker.example.test')).toBe(false);
      const redirectedMethodRequests = provider.log.filter((request) => request.method === method);
      expect(redirectedMethodRequests.at(-1)?.headers.Authorization).toMatch(/^Basic /);
    },
  );

  it('follows one same-origin redirect with authorization intact', async () => {
    const provider = new FakeWebdavTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('same-origin', new Uint8Array([1, 3, 5, 7]));
    provider.redirectOnce('PUT', 'https://dav.example.test/dav/Meerkat/same-origin?redirected=1');

    const result = await adapter.putObject(input);

    expect(result.verified).toBe(true);
    const puts = provider.log.filter((request) => request.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts.every((request) => request.headers.Authorization?.startsWith('Basic '))).toBe(true);
  });

  it.each([
    [401, 'auth_required', false],
    [403, 'revoked', false],
    [429, 'rate_limited', true],
    [503, 'provider_error', true],
  ] as const)('maps HTTP %i to %s with an honest retry flag', async (status, code, retryable) => {
    const provider = new FakeWebdavTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    provider.forceStatusOnce('HEAD', status);
    await expect(adapter.headObject({ objectId: 'error-map' })).rejects.toMatchObject({ code, retryable });
  });

  it('maps a PUT 404 to not_found and a network throw to retryable unreachable', async () => {
    const provider = new FakeWebdavTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    provider.forceStatusOnce('PUT', 404);
    await expect(adapter.putObject(object('missing-parent', new Uint8Array([1]))))
      .rejects.toMatchObject({ code: 'not_found', retryable: false });

    provider.throwNetworkOnce('HEAD');
    await expect(adapter.headObject({ objectId: 'offline' }))
      .rejects.toMatchObject({ code: 'unreachable', retryable: true });
  });
});

interface StoredWebdavObject {
  bytes: Uint8Array;
  dataClass: string;
  etag: string;
}

class FakeWebdavTransport {
  readonly log: HttpTransportRequest[] = [];
  readonly objects = new Map<string, StoredWebdavObject>();
  verificationMode: InMemoryVerificationMode = 'read_back';
  quotaUsedBytes: number | null = 0;
  quotaAvailableBytes: number | null = 4096;
  exposeQuota = true;
  private readonly forcedStatuses = new Map<string, number[]>();
  private readonly networkThrows = new Map<string, number>();
  private redirect: { method: string; location: string; remaining: number } | null = null;
  private rootExists = false;
  private version = 0;
  private hideNextGet = false;

  async send(request: HttpTransportRequest): Promise<HttpTransportResponse> {
    this.log.push({
      ...request,
      headers: { ...request.headers },
      ...(request.body === undefined ? {} : { body: request.body.slice() }),
    });
    const networkCount = this.networkThrows.get(request.method) ?? 0;
    if (networkCount > 0) {
      this.networkThrows.set(request.method, networkCount - 1);
      throw new Error('simulated transport failure');
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

    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return response(200, { DAV: '1, 2' });
    if (request.method === 'MKCOL') {
      if (this.rootExists) return response(405);
      this.rootExists = true;
      return response(201);
    }
    if (request.method === 'PROPFIND') {
      return header(request.headers, 'depth') === '1'
        ? response(207, { 'Content-Type': 'application/xml' }, encoder.encode(this.listXml()))
        : response(207, { 'Content-Type': 'application/xml' }, encoder.encode(this.quotaXml()));
    }
    const objectId = objectIdFromWebdavPath(url.pathname);
    if (objectId === null) return response(404);
    const stored = this.objects.get(objectId);
    if (request.method === 'HEAD') {
      if (stored === undefined) return response(404);
      return response(200, {
        'Content-Length': String(stored.bytes.length),
        ETag: stored.etag,
        'X-Meerkat-Data-Class': stored.dataClass,
      });
    }
    if (request.method === 'PUT') {
      if (stored !== undefined && header(request.headers, 'if-none-match') === '*') return response(412);
      const bytes = request.body?.slice() ?? new Uint8Array(0);
      const next: StoredWebdavObject = {
        bytes,
        dataClass: header(request.headers, 'x-meerkat-data-class') ?? 'encrypted_object',
        etag: `"dav-v${this.version += 1}"`,
      };
      this.objects.set(objectId, next);
      if (this.verificationMode === 'none') this.hideNextGet = true;
      return response(stored === undefined ? 201 : 204, { ETag: next.etag });
    }
    if (request.method === 'GET') {
      if (this.hideNextGet) {
        this.hideNextGet = false;
        return response(404);
      }
      if (stored === undefined) return response(404);
      const ifMatch = header(request.headers, 'if-match');
      if (ifMatch !== null && ifMatch !== stored.etag) return response(412);
      const range = header(request.headers, 'range');
      if (range === null) return response(200, {}, stored.bytes.slice());
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      if (match === null) return response(416);
      const start = Number.parseInt(match[1] ?? '', 10);
      const end = Number.parseInt(match[2] ?? '', 10);
      return response(206, {}, stored.bytes.slice(start, end + 1));
    }
    if (request.method === 'DELETE') {
      if (stored === undefined) return response(404);
      if (header(request.headers, 'if-match') !== null && header(request.headers, 'if-match') !== stored.etag) {
        return response(412);
      }
      this.objects.delete(objectId);
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

  setQuota(usedBytes: number | null, capBytes: number | null): void {
    this.quotaUsedBytes = usedBytes;
    this.quotaAvailableBytes = usedBytes !== null && capBytes !== null ? capBytes - usedBytes : null;
    this.exposeQuota = usedBytes !== null || capBytes !== null;
  }

  private quotaXml(): string {
    const quota = this.exposeQuota
      ? `${this.quotaUsedBytes === null ? '' : `<d:quota-used-bytes>${this.quotaUsedBytes}</d:quota-used-bytes>`}`
        + `${this.quotaAvailableBytes === null ? '' : `<d:quota-available-bytes>${this.quotaAvailableBytes}</d:quota-available-bytes>`}`
      : '';
    return '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">'
      + '<d:response><d:href>/dav/Meerkat/</d:href><d:propstat><d:prop>'
      + quota
      + '</d:prop></d:propstat></d:response></d:multistatus>';
  }

  private listXml(): string {
    const entries = [...this.objects.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([objectId, stored]) => '<d:response>'
        + `<d:href>/dav/Meerkat/${encodeURIComponent(objectId)}</d:href>`
        + '<d:propstat><d:prop>'
        + `<d:getcontentlength>${stored.bytes.length}</d:getcontentlength>`
        + `<d:getetag>${escapeXml(stored.etag)}</d:getetag>`
        + `<m:data-class>${stored.dataClass}</m:data-class>`
        + '</d:prop></d:propstat></d:response>')
      .join('');
    return '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:m="urn:mylife:storage">'
      + '<d:response><d:href>/dav/Meerkat/</d:href><d:propstat><d:prop>'
      + '<d:resourcetype><d:collection/></d:resourcetype>'
      + '</d:prop></d:propstat></d:response>'
      + entries
      + '</d:multistatus>';
  }
}

function createWebdavFixture(): {
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
  const provider = new FakeWebdavTransport();
  const core = adapterFor(provider);
  const faults = new Map<StorageAdapterOperation, StorageAdapterError[]>();
  let healthOverride: StorageHealth['state'] | null = null;
  let healthErrorCode: string | undefined;
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
        checkedAt: '2026-07-14T12:00:00.000Z',
        ...(healthErrorCode === undefined ? {} : { errorCode: healthErrorCode }),
      }),
    quota: () => invoke('quota', () => core.quota()),
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
        provider.setQuota(usedBytes, capBytes);
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

function adapterFor(
  provider: FakeWebdavTransport,
  overrides: Partial<{
    baseUrl: string;
    allowInsecureLocalNetwork: boolean;
  }> = {},
): WebdavStorageAdapter {
  const credentials: WebdavCredentials = { username: 'test-user', password: 'test-password' };
  return new WebdavStorageAdapter({
    baseUrl: overrides.baseUrl ?? 'https://dav.example.test/dav/',
    appRoot: 'Meerkat',
    transport: (request) => provider.send(request),
    credentialProvider: { get: async () => credentials },
    maximumObjectBytes: 1024,
    pageSize: 2,
    now: () => '2026-07-14T12:00:00.000Z',
    ...(overrides.allowInsecureLocalNetwork === undefined
      ? {}
      : { allowInsecureLocalNetwork: overrides.allowInsecureLocalNetwork }),
  });
}

async function authorize(adapter: StorageDestinationAdapter): Promise<void> {
  const result = await adapter.authorize({
    kind: 'interactive',
    credentialRef: 'securestore://storage/webdav-test',
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

function objectIdFromWebdavPath(pathname: string): string | null {
  const prefix = '/dav/Meerkat/';
  if (!pathname.startsWith(prefix)) return null;
  const suffix = pathname.slice(prefix.length);
  if (suffix.length === 0 || suffix.includes('/')) return null;
  return decodeURIComponent(suffix);
}

function response(
  status: number,
  headers: Record<string, string> = {},
  body: Uint8Array = new Uint8Array(0),
): HttpTransportResponse {
  return { status, headers, body };
}

function header(headers: Readonly<Record<string, string>>, name: string): string | null {
  return responseHeader(headers, name);
}

function hasHeader(headers: Readonly<Record<string, string>>, name: string): boolean {
  return header(headers, name) !== null;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
