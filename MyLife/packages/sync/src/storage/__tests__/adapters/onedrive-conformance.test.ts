import { describe, expect, it } from 'vitest';
import { sha512Hex } from '../../../node/hkdf';
import {
  OneDriveStorageAdapter,
  quickXorHashBase64,
  type AccessTokenProvider,
} from '../../adapters/onedrive';
import type { HttpTransportRequest, HttpTransportResponse } from '../../adapters/http';
import { runStorageAdapterConformance } from '../../conformance';
import type { EncryptedStorageObject, StorageDestinationAdapter } from '../../types';
import {
  concat,
  copyRequest,
  createProviderConformanceFixture,
  header,
  jsonBytes,
  jsonResponse,
  parseRequestObject,
  response,
  type ProviderConformanceControls,
} from './provider-test-support';

const encoder = new TextEncoder();

runStorageAdapterConformance(
  'OneDriveStorageAdapter',
  () => {
    const provider = new FakeOneDriveTransport();
    return createProviderConformanceFixture(adapterFor(provider), provider);
  },
  {
    testApi: { describe, it },
    authorizeInput: { kind: 'interactive', credentialRef: 'broker://oauth/onedrive-vault' },
  },
);

describe('OneDriveStorageAdapter protocol', () => {
  it('matches independent QuickXorHash known answers', () => {
    const vectors = [
      { bytes: encoder.encode('a'), expected: 'YQAAAAAAAAAAAAAAAQAAAAAAAAA=' },
      { bytes: encoder.encode('hello world'), expected: 'aCgDG9jwBhDc4Q1yawMZAAAAAAA=' },
      {
        bytes: Uint8Array.from({ length: 257 }, (_, index) => (index * 17 + 3) & 0xff),
        expected: 'qowQ3DlkR9sKiVbnpl5Xuj0+Vlo=',
      },
    ];
    for (const vector of vectors) {
      expect(independentQuickXorHash(vector.bytes)).toBe(vector.expected);
      expect(quickXorHashBase64(vector.bytes)).toBe(vector.expected);
    }
  });

  it('resumes from nextExpectedRanges without authorizing the preauthorized upload URL', async () => {
    const provider = new FakeOneDriveTransport();
    provider.partialPutBytes = 3;
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('graph-resume', new Uint8Array([0, 1, 2, 3, 4, 5, 6]));

    let result = await adapter.putObject(input);
    expect(result).toMatchObject({ complete: false, encryptedBytes: 3, resumeToken: { offset: 3 } });
    while (!result.complete) result = await adapter.putObject(input, result.resumeToken);
    expect(result).toMatchObject({ complete: true, verified: true });
    const uploads = provider.log.filter((request) => new URL(request.url).origin === 'https://upload.onedrive.test');
    expect(uploads.length).toBeGreaterThan(1);
    expect(uploads.every((request) => header(request.headers, 'authorization') === null)).toBe(true);
    const downloads = provider.log.filter((request) => new URL(request.url).origin === 'https://download.onedrive.test');
    expect(downloads).toHaveLength(1);
    expect(downloads.every((request) => header(request.headers, 'authorization') === null)).toBe(true);
  });

  it('uses QuickXorHash as provider evidence but never exposes it as ciphertextHash metadata', async () => {
    const provider = new FakeOneDriveTransport();
    provider.verificationMode = 'provider_checksum';
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('quickxor', encoder.encode('provider-verified bytes'));
    const result = await adapter.putObject(input);
    expect(result).toMatchObject({
      complete: true,
      verified: true,
      verification: { kind: 'provider_checksum', algorithm: 'quickxorhash' },
    });
    await expect(adapter.headObject({ objectId: input.objectId })).resolves.toMatchObject({
      ciphertextHash: null,
    });
  });

  it('fails closed when an approot name conflict has different bytes', async () => {
    const provider = new FakeOneDriveTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    await adapter.putObject(object('same-name', new Uint8Array([1, 2, 3])));
    await expect(adapter.putObject(object('same-name', new Uint8Array([3, 2, 1])))).rejects.toMatchObject({
      code: 'corrupt_ciphertext',
      retryable: false,
    });

    const racingProvider = new FakeOneDriveTransport();
    racingProvider.raceConflictOnCreate = new Uint8Array([9, 9, 9]);
    const racingAdapter = adapterFor(racingProvider);
    await authorize(racingAdapter);
    await expect(racingAdapter.putObject(object('raced-name', new Uint8Array([1, 2, 3])))).rejects.toMatchObject({
      code: 'corrupt_ciphertext',
      retryable: false,
    });
  });

  it('refreshes once after 401, then requires authorization', async () => {
    const provider = new FakeOneDriveTransport();
    let calls = 0;
    const invalidated: string[] = [];
    const adapter = adapterFor(provider, {
      getAccessToken: async () => `onedrive-token-${++calls}`,
      invalidateAccessToken: (token) => { invalidated.push(token); },
    });
    await authorize(adapter);
    calls = 0;
    provider.acceptTokens = false;
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'auth_required', retryable: false });
    expect(calls).toBe(2);
    expect(invalidated).toEqual(['onedrive-token-1']);
  });

  it('maps Retry-After and refuses cross-origin redirects', async () => {
    const provider = new FakeOneDriveTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    provider.forcedDriveResponse = response(429, { 'Retry-After': '19' }, jsonBytes({ error: { code: 'throttled' } }));
    await expect(adapter.quota()).rejects.toMatchObject({
      code: 'rate_limited', retryable: true, retryAfterSeconds: 19,
    });
    provider.forcedDriveResponse = response(302, { Location: 'https://attacker.example.test/token' });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'unsafe_redirect', retryable: false });
    expect(provider.log.some((request) => new URL(request.url).hostname === 'attacker.example.test')).toBe(false);
  });

  it('splits quota and permission failures and keeps server errors retryable', async () => {
    const provider = new FakeOneDriveTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    provider.forcedDriveResponse = jsonResponse(403, { error: { code: 'storage_limit_reached' } });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'quota_exceeded', retryable: false });
    provider.forcedDriveResponse = jsonResponse(403, { error: { code: 'accessDenied' } });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'provider_error', retryable: false });
    provider.forcedDriveResponse = jsonResponse(503, { error: { code: 'serviceNotAvailable' } });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'provider_error', retryable: true });
  });
});

interface FakeGraphFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  version: number;
}

interface FakeGraphSession {
  id: string;
  name: string;
  total: number;
  accepted: Uint8Array;
}

class FakeOneDriveTransport implements ProviderConformanceControls {
  readonly log: HttpTransportRequest[] = [];
  readonly files = new Map<string, FakeGraphFile>();
  readonly sessions = new Map<string, FakeGraphSession>();
  verificationMode: 'read_back' | 'provider_checksum' | 'none' = 'read_back';
  partialPutBytes: number | null = null;
  quotaUsedBytes: number | null = 0;
  quotaCapBytes: number | null = 4_096;
  acceptTokens = true;
  forcedDriveResponse: HttpTransportResponse | null = null;
  raceConflictOnCreate: Uint8Array | null = null;
  private hideNextDownload = false;
  private nextFile = 1;
  private nextSession = 1;

  async send(request: HttpTransportRequest): Promise<HttpTransportResponse> {
    this.log.push(copyRequest(request));
    const url = new URL(request.url);
    if (url.origin === 'https://upload.onedrive.test') return this.uploadSession(request, url);
    if (url.origin === 'https://download.onedrive.test') return this.download(request, url);
    if (!this.acceptTokens || !header(request.headers, 'authorization')) {
      return jsonResponse(401, { error: { code: 'InvalidAuthenticationToken' } });
    }
    const route = decodeURIComponent(url.pathname.replace(/^\/v1\.0\//u, ''));
    if (route === 'me/drive') return this.drive();
    if (route === 'me/drive/special/approot') return jsonResponse(200, { id: 'approot_1', name: 'App Root' });
    if (route === 'me/drive/special/approot/children') return this.children(url);
    const match = /^me\/drive\/special\/approot:\/(.+?)(?::\/(createUploadSession))?$/u.exec(route);
    if (!match?.[1]) return jsonResponse(404, { error: { code: 'itemNotFound' } });
    const name = match[1];
    if (match[2] === 'createUploadSession') return this.createSession(request, name);
    if (request.method === 'DELETE') return this.delete(name);
    const file = this.fileByName(name);
    return file ? jsonResponse(200, this.itemJson(file)) : jsonResponse(404, { error: { code: 'itemNotFound' } });
  }

  setQuota(usedBytes: number | null, capBytes: number | null): void {
    this.quotaUsedBytes = usedBytes;
    this.quotaCapBytes = capBytes;
  }

  setVerificationMode(mode: 'read_back' | 'provider_checksum' | 'none'): void {
    this.verificationMode = mode;
  }

  setPartialPutBytes(bytes: number | null): void {
    this.partialPutBytes = bytes;
  }

  private drive(): HttpTransportResponse {
    const forced = this.forcedDriveResponse;
    this.forcedDriveResponse = null;
    return forced ?? jsonResponse(200, { quota: { used: this.quotaUsedBytes, total: this.quotaCapBytes } });
  }

  private createSession(request: HttpTransportRequest, name: string): HttpTransportResponse {
    const item = parseRequestObject(request.body).item;
    const record = typeof item === 'object' && item !== null && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    const total = typeof record.fileSize === 'number' ? record.fileSize : 0;
    if (this.fileByName(name)) return jsonResponse(409, { error: { code: 'nameAlreadyExists' } });
    if (this.raceConflictOnCreate) {
      const file: FakeGraphFile = {
        id: `file_${this.nextFile++}`,
        name,
        bytes: this.raceConflictOnCreate,
        version: 1,
      };
      this.raceConflictOnCreate = null;
      this.files.set(file.id, file);
      return jsonResponse(409, { error: { code: 'nameAlreadyExists' } });
    }
    const id = `session_${this.nextSession++}`;
    this.sessions.set(id, { id, name, total, accepted: new Uint8Array() });
    return jsonResponse(200, { uploadUrl: `https://upload.onedrive.test/${id}` });
  }

  private uploadSession(request: HttpTransportRequest, url: URL): HttpTransportResponse {
    if (header(request.headers, 'authorization')) return jsonResponse(400, { error: 'authorization_not_allowed' });
    const id = url.pathname.slice(1);
    const session = this.sessions.get(id);
    if (!session) return jsonResponse(404, { error: { code: 'itemNotFound' } });
    if (request.method === 'GET') return jsonResponse(200, { nextExpectedRanges: [`${session.accepted.length}-`] });
    const range = header(request.headers, 'content-range');
    const parsed = range ? /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(range) : null;
    if (!parsed?.[1] || !parsed[2] || !parsed[3]) return jsonResponse(400, { error: { code: 'invalidRange' } });
    const start = Number(parsed[1]);
    const body = request.body ?? new Uint8Array();
    if (start !== session.accepted.length || Number(parsed[3]) !== session.total) {
      return jsonResponse(416, { error: { code: 'fragmentOutOfOrder' } });
    }
    const accepted = Math.min(body.length, this.partialPutBytes ?? body.length);
    session.accepted = concat(session.accepted, body.slice(0, accepted));
    if (session.accepted.length < session.total) {
      return jsonResponse(202, { nextExpectedRanges: [`${session.accepted.length}-`] });
    }
    const file: FakeGraphFile = {
      id: `file_${this.nextFile++}`,
      name: session.name,
      bytes: session.accepted.slice(),
      version: 1,
    };
    this.files.set(file.id, file);
    this.sessions.delete(id);
    if (this.verificationMode === 'none') this.hideNextDownload = true;
    return jsonResponse(201, this.itemJson(file));
  }

  private download(request: HttpTransportRequest, url: URL): HttpTransportResponse {
    if (header(request.headers, 'authorization')) {
      return jsonResponse(400, { error: 'authorization_not_allowed' });
    }
    const file = this.files.get(url.pathname.replace(/^\/files\//u, ''));
    if (!file || this.hideNextDownload) {
      this.hideNextDownload = false;
      return jsonResponse(404, { error: { code: 'itemNotFound' } });
    }
    const range = header(request.headers, 'range');
    if (!range) return response(200, {}, file.bytes.slice());
    const match = /^bytes=(\d+)-(\d+)$/u.exec(range);
    if (!match?.[1] || !match[2]) return response(416);
    return response(206, {}, file.bytes.slice(Number(match[1]), Number(match[2]) + 1));
  }

  private children(url: URL): HttpTransportResponse {
    const offset = Number(url.searchParams.get('$skiptoken') ?? '0');
    const limit = Number(url.searchParams.get('$top') ?? '2');
    const files = [...this.files.values()].sort((left, right) => left.name.localeCompare(right.name));
    const page = files.slice(offset, offset + limit);
    const next = offset + limit;
    return jsonResponse(200, {
      value: page.map((file) => this.itemJson(file)),
      ...(next < files.length
        ? { '@odata.nextLink': `https://graph.microsoft.test/v1.0/me/drive/special/approot/children?$skiptoken=${next}&$top=${limit}` }
        : {}),
    });
  }

  private delete(name: string): HttpTransportResponse {
    const file = this.fileByName(name);
    if (!file) return jsonResponse(404, { error: { code: 'itemNotFound' } });
    this.files.delete(file.id);
    return response(204);
  }

  private fileByName(name: string): FakeGraphFile | null {
    return [...this.files.values()].find((file) => file.name === name) ?? null;
  }

  private itemJson(file: FakeGraphFile): Record<string, unknown> {
    return {
      id: file.id,
      name: file.name,
      size: file.bytes.length,
      eTag: `"etag-${file.version}"`,
      cTag: `"ctag-${file.version}"`,
      lastModifiedDateTime: '2026-07-14T12:00:00.000Z',
      file: {
        hashes: this.verificationMode === 'provider_checksum'
          ? { quickXorHash: quickXorHashBase64(file.bytes) }
          : {},
      },
      '@microsoft.graph.downloadUrl': `https://download.onedrive.test/files/${file.id}`,
    };
  }
}

function adapterFor(
  provider: FakeOneDriveTransport,
  accessTokenProvider: AccessTokenProvider = { getAccessToken: async () => 'onedrive-access-token' },
): OneDriveStorageAdapter {
  return new OneDriveStorageAdapter({
    transport: (request) => provider.send(request),
    accessTokenProvider,
    credentialRef: 'broker://oauth/onedrive-vault',
    apiBaseUrl: 'https://graph.microsoft.test/v1.0/',
    uploadSessionAllowedOrigins: [
      'https://upload.onedrive.test',
      'https://download.onedrive.test',
    ],
    maximumObjectBytes: 1_024,
    pageSize: 2,
    now: () => '2026-07-14T12:00:00.000Z',
  });
}

async function authorize(adapter: StorageDestinationAdapter): Promise<void> {
  expect((await adapter.authorize({ kind: 'interactive', credentialRef: 'broker://oauth/onedrive-vault' })).kind)
    .toBe('authorized');
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

function independentQuickXorHash(bytes: Uint8Array): string {
  const width = 160n;
  const mask = (1n << width) - 1n;
  let state = 0n;
  for (let index = 0; index < bytes.length; index += 1) {
    const shift = BigInt((index * 11) % 160);
    const shifted = BigInt(bytes[index] ?? 0) << shift;
    state ^= (shifted & mask) | (shifted >> width);
  }
  state ^= BigInt(bytes.length) << 96n;
  const output = new Uint8Array(20);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number((state >> BigInt(index * 8)) & 0xffn);
  }
  return Buffer.from(output).toString('base64');
}
