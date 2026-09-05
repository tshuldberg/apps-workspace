import { describe, expect, it } from 'vitest';
import { md5Hex } from '../../../encryption/md5';
import { sha256Hex } from '../../../encryption/sha256';
import { sha512Hex } from '../../../node/hkdf';
import { runStorageAdapterConformance } from '../../conformance';
import type { InMemoryVerificationMode, StorageAdapterOperation } from '../../fakes';
import type {
  EncryptedStorageObject,
  StorageDestinationAdapter,
  StorageHealth,
} from '../../types';
import { StorageAdapterError } from '../../types';
import {
  GoogleDriveStorageAdapter,
  type AccessTokenProvider,
} from '../../adapters/google-drive';
import type { HttpTransportRequest, HttpTransportResponse } from '../../adapters/http';
import { responseHeader } from '../../adapters/http';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

runStorageAdapterConformance(
  'GoogleDriveStorageAdapter',
  () => createGoogleDriveFixture(),
  {
    testApi: { describe, it },
    authorizeInput: {
      kind: 'interactive',
      credentialRef: 'broker://oauth/vault-test',
    },
  },
);

describe('GoogleDriveStorageAdapter protocol', () => {
  it('persists the resumable session URI and advances offsets from 308 Range', async () => {
    const provider = new FakeGoogleDriveTransport();
    provider.partialPutBytes = 3;
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('resumable-308', new Uint8Array([0, 1, 2, 3, 4, 5, 6]));

    const first = await adapter.putObject(input);
    expect(first).toMatchObject({
      complete: false,
      encryptedBytes: 3,
      resumeToken: { offset: 3 },
    });
    if (first.complete) throw new Error('expected resumable upload state');
    expect(first.resumeToken.providerSession).toMatch(/^https:\/\/www\.googleapis\.com\/upload-session\//);

    const second = await adapter.putObject(input, first.resumeToken);
    expect(second).toMatchObject({ complete: false, encryptedBytes: 6, resumeToken: { offset: 6 } });
    if (second.complete) throw new Error('expected second resumable upload state');
    const completed = await adapter.putObject(input, second.resumeToken);
    expect(completed).toMatchObject({ complete: true, verified: true });
    await expect(adapter.getObject({ objectId: input.objectId })).resolves.toEqual(input.ciphertext);
  });

  it('probes the resumable session after a lost response and resumes from Drive committed bytes', async () => {
    const provider = new FakeGoogleDriveTransport();
    provider.partialPutBytes = 3;
    provider.dropNextUploadResponseAfterAccept = true;
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('lost-response', new Uint8Array([0, 1, 2, 3, 4, 5, 6]));

    const uncertain = await adapter.putObject(input);
    expect(uncertain).toMatchObject({ complete: false, encryptedBytes: 0, resumeToken: { offset: 0 } });
    if (uncertain.complete) throw new Error('expected uncertain resumable upload state');
    const resumed = await adapter.putObject(input, uncertain.resumeToken);
    expect(resumed).toMatchObject({ complete: false, encryptedBytes: 6, resumeToken: { offset: 6 } });
    if (resumed.complete) throw new Error('expected one final resumable chunk');
    await expect(adapter.putObject(input, resumed.resumeToken)).resolves.toMatchObject({
      complete: true,
      verified: true,
    });
    expect(provider.log.some((request) => (
      request.method === 'PUT' && header(request.headers, 'content-range') === `bytes */${input.encryptedBytes}`
    ))).toBe(true);
  });

  it('fails closed when one object id advertises a different appProperties ciphertext hash', async () => {
    const provider = new FakeGoogleDriveTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    await adapter.putObject(object('same-object', new Uint8Array([1, 2, 3])));

    await expect(adapter.putObject(object('same-object', new Uint8Array([3, 2, 1])))).rejects.toMatchObject({
      code: 'corrupt_ciphertext',
      retryable: false,
    });
    await expect(adapter.getObject({ objectId: 'same-object' })).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it('uses provider_checksum evidence only when Drive returns a computed checksum', async () => {
    const provider = new FakeGoogleDriveTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);

    provider.verificationMode = 'read_back';
    const readBack = await adapter.putObject(object('read-back-only', new Uint8Array([4, 5, 6])));
    expect(readBack.verification).toMatchObject({ kind: 'read_back' });

    provider.verificationMode = 'provider_checksum';
    const checksum = await adapter.putObject(object('provider-checksum', new Uint8Array([7, 8, 9])));
    expect(checksum.verification).toEqual({
      kind: 'provider_checksum',
      algorithm: 'sha256',
      value: sha256Hex(new Uint8Array([7, 8, 9])),
    });

    const metadata = await adapter.headObject({ objectId: 'provider-checksum' });
    expect(metadata?.ciphertextHash).toBeNull();
  });

  it('supports a provider-computed Drive MD5 checksum without treating MD5 as a security hash', async () => {
    expect(md5Hex(encoder.encode('abc'))).toBe('900150983cd24fb0d6963f7d28e17f72');
    const provider = new FakeGoogleDriveTransport();
    provider.verificationMode = 'provider_checksum';
    provider.checksumAlgorithm = 'md5';
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('provider-md5', new Uint8Array([2, 4, 6, 8]));

    await expect(adapter.putObject(input)).resolves.toMatchObject({
      verified: true,
      verification: { kind: 'provider_checksum', algorithm: 'md5', value: md5Hex(input.ciphertext) },
    });
  });

  it('asks for one replacement token after 401 and then returns auth_required', async () => {
    const provider = new FakeGoogleDriveTransport();
    let tokenCalls = 0;
    const invalidated: string[] = [];
    const tokenSource: AccessTokenProvider = {
      getAccessToken: async () => {
        tokenCalls += 1;
        return `rejected-token-${tokenCalls}`;
      },
      invalidateAccessToken: (token) => { invalidated.push(token); },
    };
    const adapter = adapterFor(provider, tokenSource);
    await authorize(adapter);
    tokenCalls = 0;
    provider.acceptTokens = false;

    await expect(adapter.headObject({ objectId: 'auth-failure' })).rejects.toMatchObject({
      code: 'auth_required',
      retryable: false,
    });
    expect(tokenCalls).toBe(2);
    expect(invalidated).toEqual(['rejected-token-1']);
    await expect(adapter.health()).resolves.toMatchObject({ state: 'auth_required', verifiedReadWrite: false });
  });

  it('maps Drive quota, rate, and provider failures with honest retry flags', async () => {
    const cases = [
      [403, 'storageQuotaExceeded', 'quota_exceeded', false],
      [403, 'userRateLimitExceeded', 'rate_limited', true],
      [404, null, 'not_found', false],
      [429, null, 'rate_limited', true],
      [503, null, 'provider_error', true],
    ] as const;
    for (const [status, reason, code, retryable] of cases) {
      const provider = new FakeGoogleDriveTransport();
      const adapter = adapterFor(provider);
      await authorize(adapter);
      provider.forceAboutStatus(status, reason);
      await expect(adapter.quota()).rejects.toMatchObject({ code, retryable });
    }
  });

  it('maps about.storageQuota as exact provider data', async () => {
    const provider = new FakeGoogleDriveTransport();
    provider.quotaUsedBytes = 512;
    provider.quotaCapBytes = 4_096;
    const adapter = adapterFor(provider);
    await authorize(adapter);

    await expect(adapter.quota()).resolves.toEqual({ usedBytes: 512, capBytes: 4_096, estimated: false });
  });

  it('queries appProperties for stable object-id resolution', async () => {
    const provider = new FakeGoogleDriveTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    await adapter.putObject(object('mapped-id', new Uint8Array([9, 9])));
    provider.log.length = 0;

    await adapter.headObject({ objectId: 'mapped-id' });
    const query = provider.log
      .filter((request) => request.method === 'GET')
      .map((request) => new URL(request.url).searchParams.get('q'))
      .find((value) => value?.includes("key='meerkatObjectId'") === true);
    expect(query).toContain("value='mapped-id'");
  });

  it('finds the app-created root by appProperties after a user renames it', async () => {
    const provider = new FakeGoogleDriveTransport();
    const first = adapterFor(provider);
    await authorize(first);
    await first.health();
    const root = [...provider.files.values()].find((file) => file.appProperties.meerkatRoot === '1');
    if (!root) throw new Error('expected the fake Drive root');
    root.name = 'Renamed by user';

    const reopened = adapterFor(provider);
    await authorize(reopened);
    await expect(reopened.putObject(object('after-root-rename', new Uint8Array([8, 6, 7]))))
      .resolves.toMatchObject({ complete: true, verified: true });
    expect([...provider.files.values()].filter((file) => file.appProperties.meerkatRoot === '1'))
      .toHaveLength(1);
  });

  it('fails closed when a remote file id is rebound outside its Meerkat object mapping', async () => {
    const provider = new FakeGoogleDriveTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const written = await adapter.putObject(object('bound-object', new Uint8Array([1, 3, 5])));
    const fileId = written.remoteRef.slice('gdrive:'.length);
    const file = provider.files.get(fileId);
    if (!file) throw new Error('expected the fake Drive file');
    file.appProperties.meerkatObjectId = 'different-object';

    await expect(adapter.getObject({
      objectId: 'bound-object',
      remoteRef: written.remoteRef,
    })).rejects.toMatchObject({ code: 'corrupt_ciphertext', retryable: false });
    await expect(adapter.deleteObject({
      objectId: 'bound-object',
      remoteRef: written.remoteRef,
    })).rejects.toMatchObject({ code: 'corrupt_ciphertext', retryable: false });
    expect(provider.files.has(fileId)).toBe(true);
  });
});

interface FakeDriveFile {
  id: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  version: number;
  modifiedTime: string;
  appProperties: Record<string, string>;
}

interface FakeUploadSession {
  id: string;
  metadata: {
    name: string;
    parents: string[];
    appProperties: Record<string, string>;
  };
  total: number;
  accepted: Uint8Array;
}

class FakeGoogleDriveTransport {
  readonly log: HttpTransportRequest[] = [];
  readonly files = new Map<string, FakeDriveFile>();
  readonly sessions = new Map<string, FakeUploadSession>();
  readonly completedSessions = new Map<string, FakeDriveFile>();
  verificationMode: InMemoryVerificationMode = 'read_back';
  checksumAlgorithm: 'sha256' | 'md5' = 'sha256';
  partialPutBytes: number | null = null;
  quotaUsedBytes: number | null = 0;
  quotaCapBytes: number | null = 4_096;
  acceptTokens = true;
  dropNextUploadResponseAfterAccept = false;
  private nextFile = 1;
  private nextSession = 1;
  private forcedAbout: { status: number; reason: string | null } | null = null;
  private hideNextVerificationRead = false;

  async send(request: HttpTransportRequest): Promise<HttpTransportResponse> {
    this.log.push(copyRequest(request));
    if (!this.acceptTokens || !authorization(request)) return response(401, {}, errorBody(401, 'authError'));
    const url = new URL(request.url);
    if (url.pathname.startsWith('/upload-session/')) return this.uploadChunk(url, request);
    if (url.pathname === '/upload/drive/v3/files') return this.createUploadSession(url, request);
    if (url.pathname === '/drive/v3/about') return this.about();
    if (url.pathname === '/drive/v3/files') {
      if (request.method === 'GET') return this.listFiles(url);
      if (request.method === 'POST') return this.createFolder(request);
    }
    if (url.pathname.startsWith('/drive/v3/files/')) return this.fileRequest(url, request);
    return response(404, {}, errorBody(404, 'notFound'));
  }

  forceAboutStatus(status: number, reason: string | null): void {
    this.forcedAbout = { status, reason };
  }

  setQuota(usedBytes: number | null, capBytes: number | null): void {
    this.quotaUsedBytes = usedBytes;
    this.quotaCapBytes = capBytes;
  }

  private about(): HttpTransportResponse {
    const forced = this.forcedAbout;
    this.forcedAbout = null;
    if (forced) return response(forced.status, {}, errorBody(forced.status, forced.reason));
    const storageQuota: Record<string, string> = {};
    if (this.quotaUsedBytes !== null) storageQuota.usage = String(this.quotaUsedBytes);
    if (this.quotaCapBytes !== null) storageQuota.limit = String(this.quotaCapBytes);
    return jsonResponse(200, { storageQuota, user: { displayName: 'Fake Drive' } });
  }

  private listFiles(url: URL): HttpTransportResponse {
    const query = url.searchParams.get('q') ?? '';
    let files = [...this.files.values()];
    if (query.includes("key='meerkatRoot'")) {
      files = files.filter((file) => file.appProperties.meerkatRoot === '1');
    } else {
      const objectId = queryValue(query, 'meerkatObjectId');
      if (objectId !== null) {
        files = files.filter((file) => file.appProperties.meerkatObjectId === objectId);
      } else {
        const parent = /^'([^']+)' in parents/u.exec(query)?.[1] ?? '';
        files = files.filter((file) => file.appProperties.parentId === parent
          && file.appProperties.meerkatManaged === '1');
      }
    }
    files.sort((left, right) => (left.appProperties.meerkatObjectId ?? left.name)
      .localeCompare(right.appProperties.meerkatObjectId ?? right.name));
    const offset = numericPageToken(url.searchParams.get('pageToken'));
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? '100'));
    const page = files.slice(offset, offset + pageSize);
    const next = offset + pageSize < files.length ? String(offset + pageSize) : undefined;
    return jsonResponse(200, {
      files: page.map((file) => this.fileJson(file)),
      ...(next === undefined ? {} : { nextPageToken: next }),
    });
  }

  private createFolder(request: HttpTransportRequest): HttpTransportResponse {
    const body = parseRequestObject(request.body);
    const name = stringValue(body.name);
    const mimeType = stringValue(body.mimeType);
    const appProperties = stringRecord(body.appProperties);
    if (!name || mimeType !== 'application/vnd.google-apps.folder') return response(400);
    const folder: FakeDriveFile = {
      id: `file-${this.nextFile += 1}`,
      name,
      mimeType,
      bytes: new Uint8Array(0),
      version: 1,
      modifiedTime: '2026-07-14T12:00:00.000Z',
      appProperties,
    };
    this.files.set(folder.id, folder);
    return jsonResponse(201, this.fileJson(folder));
  }

  private createUploadSession(url: URL, request: HttpTransportRequest): HttpTransportResponse {
    if (request.method !== 'POST' || url.searchParams.get('uploadType') !== 'resumable') return response(400);
    const body = parseRequestObject(request.body);
    const name = stringValue(body.name);
    const parents = stringList(body.parents);
    const appProperties = stringRecord(body.appProperties);
    const total = Number(header(request.headers, 'x-upload-content-length'));
    if (!name || parents.length !== 1 || !Number.isSafeInteger(total) || total <= 0) return response(400);
    const id = `session-${this.nextSession += 1}`;
    this.sessions.set(id, {
      id,
      metadata: { name, parents, appProperties },
      total,
      accepted: new Uint8Array(0),
    });
    return response(200, { Location: `https://www.googleapis.com/upload-session/${id}` });
  }

  private uploadChunk(url: URL, request: HttpTransportRequest): HttpTransportResponse {
    if (request.method !== 'PUT') return response(405);
    const id = url.pathname.slice('/upload-session/'.length);
    const statusMatch = /^bytes \*\/(\d+)$/u.exec(header(request.headers, 'content-range') ?? '');
    if (statusMatch) {
      const completed = this.completedSessions.get(id);
      if (completed) return jsonResponse(200, this.fileJson(completed));
      const current = this.sessions.get(id);
      if (!current || Number(statusMatch[1]) !== current.total) return response(404);
      return current.accepted.byteLength === 0
        ? response(308)
        : response(308, { Range: `bytes=0-${current.accepted.byteLength - 1}` });
    }
    const session = this.sessions.get(id);
    if (!session) return response(404);
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(header(request.headers, 'content-range') ?? '');
    const body = request.body ?? new Uint8Array(0);
    if (!match) return response(400);
    const start = Number(match[1]);
    const end = Number(match[2]);
    const total = Number(match[3]);
    if (start !== session.accepted.byteLength || end - start + 1 !== body.byteLength || total !== session.total) {
      return response(409);
    }
    const acceptedBytes = Math.min(body.byteLength, this.partialPutBytes ?? body.byteLength);
    session.accepted = concatBytes(session.accepted, body.slice(0, acceptedBytes));
    if (session.accepted.byteLength < session.total) {
      if (this.dropNextUploadResponseAfterAccept) {
        this.dropNextUploadResponseAfterAccept = false;
        throw new Error('simulated lost Drive upload response');
      }
      return response(308, { Range: `bytes=0-${session.accepted.byteLength - 1}` });
    }
    const file: FakeDriveFile = {
      id: `file-${this.nextFile += 1}`,
      name: session.metadata.name,
      mimeType: 'application/octet-stream',
      bytes: session.accepted.slice(),
      version: 1,
      modifiedTime: '2026-07-14T12:00:00.000Z',
      appProperties: {
        ...session.metadata.appProperties,
        parentId: session.metadata.parents[0] ?? '',
      },
    };
    this.files.set(file.id, file);
    this.sessions.delete(id);
    this.completedSessions.set(id, file);
    if (this.verificationMode === 'none') this.hideNextVerificationRead = true;
    if (this.dropNextUploadResponseAfterAccept) {
      this.dropNextUploadResponseAfterAccept = false;
      throw new Error('simulated lost Drive completion response');
    }
    return jsonResponse(201, this.fileJson(file));
  }

  private fileRequest(url: URL, request: HttpTransportRequest): HttpTransportResponse {
    const id = decodeURIComponent(url.pathname.slice('/drive/v3/files/'.length));
    const file = this.files.get(id);
    if (!file) return response(404, {}, errorBody(404, 'notFound'));
    if (request.method === 'DELETE') {
      this.files.delete(id);
      return response(204);
    }
    if (request.method !== 'GET') return response(405);
    if (url.searchParams.get('alt') !== 'media') return jsonResponse(200, this.fileJson(file));
    if (this.hideNextVerificationRead) {
      this.hideNextVerificationRead = false;
      return response(404);
    }
    const range = header(request.headers, 'range');
    if (!range) return response(200, {}, file.bytes.slice());
    const match = /^bytes=(\d+)-(\d+)$/u.exec(range);
    if (!match) return response(416);
    const start = Number(match[1]);
    const end = Number(match[2]);
    return response(206, {
      'Content-Range': `bytes ${start}-${Math.min(end, file.bytes.length - 1)}/${file.bytes.length}`,
    }, file.bytes.slice(start, end + 1));
  }

  private fileJson(file: FakeDriveFile): Record<string, unknown> {
    const checksum = this.verificationMode === 'provider_checksum' && file.bytes.length > 0
      ? this.checksumAlgorithm === 'sha256'
        ? { sha256Checksum: sha256Hex(file.bytes) }
        : { md5Checksum: md5Hex(file.bytes) }
      : {};
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: String(file.bytes.length),
      version: String(file.version),
      modifiedTime: file.modifiedTime,
      parents: file.appProperties.parentId ? [file.appProperties.parentId] : [],
      appProperties: { ...file.appProperties },
      ...checksum,
    };
  }
}

function createGoogleDriveFixture(): {
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
  const provider = new FakeGoogleDriveTransport();
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
    if (fault) throw fault;
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
        provider.partialPutBytes = bytes;
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
  provider: FakeGoogleDriveTransport,
  accessTokenProvider: AccessTokenProvider = { getAccessToken: async () => 'fake-drive-access-token' },
): GoogleDriveStorageAdapter {
  return new GoogleDriveStorageAdapter({
    transport: (request) => provider.send(request),
    accessTokenProvider,
    credentialRef: 'broker://oauth/vault-test',
    maximumObjectBytes: 1_024,
    pageSize: 2,
    now: () => '2026-07-14T12:00:00.000Z',
  });
}

async function authorize(adapter: StorageDestinationAdapter): Promise<void> {
  const result = await adapter.authorize({
    kind: 'interactive',
    credentialRef: 'broker://oauth/vault-test',
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

function authorization(request: HttpTransportRequest): string | null {
  return header(request.headers, 'authorization');
}

function response(
  status: number,
  headers: Record<string, string> = {},
  body: Uint8Array = new Uint8Array(0),
): HttpTransportResponse {
  return { status, headers, body };
}

function jsonResponse(status: number, value: unknown): HttpTransportResponse {
  return response(status, { 'Content-Type': 'application/json' }, encoder.encode(JSON.stringify(value)));
}

function errorBody(status: number, reason: string | null): Uint8Array {
  return encoder.encode(JSON.stringify({
    error: {
      code: status,
      errors: reason ? [{ reason }] : [],
    },
  }));
}

function header(headers: Readonly<Record<string, string>>, name: string): string | null {
  return responseHeader(headers, name);
}

function parseRequestObject(body: Uint8Array | undefined): Record<string, unknown> {
  if (!body) return {};
  const parsed = JSON.parse(decoder.decode(body)) as unknown;
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function stringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') output[key] = item;
  }
  return output;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? [...value]
    : [];
}

function queryValue(query: string, key: string): string | null {
  const expression = new RegExp(`key='${key}' and value='([^']+)'`, 'u');
  return expression.exec(query)?.[1] ?? null;
}

function numericPageToken(value: string | null): number {
  return value && /^\d+$/u.test(value) ? Number(value) : 0;
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const output = new Uint8Array(left.length + right.length);
  output.set(left, 0);
  output.set(right, left.length);
  return output;
}

function copyRequest(request: HttpTransportRequest): HttpTransportRequest {
  return {
    ...request,
    headers: { ...request.headers },
    ...(request.body === undefined ? {} : { body: request.body.slice() }),
  };
}
