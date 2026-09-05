import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha512Hex } from '../../../node/hkdf';
import {
  BoxStorageAdapter,
  sha1Hex,
  type AccessTokenProvider,
  type BoxFolderState,
} from '../../adapters/box';
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
  stringValue,
  type ProviderConformanceControls,
} from './provider-test-support';

const encoder = new TextEncoder();

runStorageAdapterConformance(
  'BoxStorageAdapter',
  () => {
    const provider = new FakeBoxTransport();
    return createProviderConformanceFixture(adapterFor(provider), provider);
  },
  {
    testApi: { describe, it },
    authorizeInput: { kind: 'interactive', credentialRef: 'broker://oauth/box-vault' },
  },
);

describe('BoxStorageAdapter protocol', () => {
  it('sends RFC 3230 SHA-1 digests for every part and the whole-file commit', async () => {
    const directProvider = new FakeBoxTransport();
    const directAdapter = adapterFor(
      directProvider,
      undefined,
      new MemoryBoxFolderState(),
      1_024,
    );
    await authorize(directAdapter);
    const directInput = object('box-direct-digest', encoder.encode('small direct upload'));
    await expect(directAdapter.putObject(directInput)).resolves.toMatchObject({
      complete: true,
      verified: true,
      verification: { kind: 'read_back' },
    });
    expect(directProvider.directContentHashes).toEqual([sha1Hex(directInput.ciphertext)]);
    const directDownloads = directProvider.log.filter(
      (request) => new URL(request.url).origin === 'https://download.box.test',
    );
    expect(directDownloads).toHaveLength(1);
    expect(directDownloads.every((request) => header(request.headers, 'authorization') === null)).toBe(true);

    const provider = new FakeBoxTransport();
    provider.partialPutBytes = 3;
    provider.verificationMode = 'provider_checksum';
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('box-digest', encoder.encode('abcdefg'));

    let result = await adapter.putObject(input);
    while (!result.complete) result = await adapter.putObject(input, result.resumeToken);
    expect(result).toMatchObject({
      complete: true,
      verified: true,
      verification: { kind: 'provider_checksum', algorithm: 'sha1', value: sha1Hex(input.ciphertext) },
    });
    expect(provider.partDigests).toEqual([
      digest(input.ciphertext.slice(0, 3)),
      digest(input.ciphertext.slice(3, 6)),
      digest(input.ciphertext.slice(6)),
    ]);
    expect(provider.commitDigests).toEqual([digest(input.ciphertext)]);
    expect(sha1Hex(encoder.encode('abc'))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    for (const length of [0, 55, 56, 63, 64, 65, 257]) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 29 + 11) & 0xff);
      expect(sha1Hex(bytes)).toBe(createHash('sha1').update(bytes).digest('hex'));
    }
  });

  it('resumes from provider-listed immutable parts', async () => {
    const provider = new FakeBoxTransport();
    provider.partialPutBytes = 2;
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('box-resume', new Uint8Array([0, 1, 2, 3, 4]));
    const first = await adapter.putObject(input);
    expect(first).toMatchObject({ complete: false, encryptedBytes: 2, resumeToken: { offset: 2 } });
    if (first.complete) throw new Error('expected Box resume state');
    expect(first.resumeToken.providerSession).toMatch(/^box-session:/u);
    let result = await adapter.putObject(input, first.resumeToken);
    while (!result.complete) result = await adapter.putObject(input, result.resumeToken);
    await expect(adapter.getObject({ objectId: input.objectId })).resolves.toEqual(input.ciphertext);

    const committedProvider = new FakeBoxTransport();
    committedProvider.dropCommitResponseOnce = true;
    const committedAdapter = adapterFor(committedProvider);
    await authorize(committedAdapter);
    const committedInput = object('box-commit-response-loss', new Uint8Array([5, 4, 3, 2, 1]));
    let committed = await committedAdapter.putObject(committedInput);
    while (!committed.complete && committed.encryptedBytes < committedInput.encryptedBytes) {
      committed = await committedAdapter.putObject(committedInput, committed.resumeToken);
    }
    expect(committed).toMatchObject({ complete: false, encryptedBytes: committedInput.encryptedBytes });
    if (committed.complete) throw new Error('expected a resumable lost commit response');
    await expect(committedAdapter.putObject(committedInput, committed.resumeToken)).resolves.toMatchObject({
      complete: true,
      verified: true,
      verification: { kind: 'read_back' },
    });
  });

  it('keeps the dedicated root folder id in the injected state seam', async () => {
    const provider = new FakeBoxTransport();
    const state = new MemoryBoxFolderState();
    const first = adapterFor(provider, undefined, state);
    const second = adapterFor(provider, undefined, state);
    await authorize(first);
    await expect(first.health()).resolves.toMatchObject({ state: 'ok' });
    await authorize(second);
    await expect(second.health()).resolves.toMatchObject({ state: 'ok' });
    expect(state.folderId).toBe('100');
    expect(provider.log.filter((request) => request.method === 'POST'
      && new URL(request.url).pathname === '/2.0/folders')).toHaveLength(1);
  });

  it('fails closed when the dedicated folder name maps to different bytes', async () => {
    const provider = new FakeBoxTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    await adapter.putObject(object('same-name', new Uint8Array([1, 2, 3])));
    await expect(adapter.putObject(object('same-name', new Uint8Array([3, 2, 1])))).rejects.toMatchObject({
      code: 'corrupt_ciphertext',
      retryable: false,
    });

    const racingProvider = new FakeBoxTransport();
    racingProvider.raceConflictOnCreate = new Uint8Array([9, 9, 9]);
    const racingAdapter = adapterFor(racingProvider);
    await authorize(racingAdapter);
    await expect(racingAdapter.putObject(object('raced-name', new Uint8Array([1, 2, 3])))).rejects.toMatchObject({
      code: 'corrupt_ciphertext',
      retryable: false,
    });
  });

  it('refreshes once after 401, then requires authorization', async () => {
    const provider = new FakeBoxTransport();
    let calls = 0;
    const invalidated: string[] = [];
    const adapter = adapterFor(provider, {
      getAccessToken: async () => `box-token-${++calls}`,
      invalidateAccessToken: (token) => { invalidated.push(token); },
    });
    await authorize(adapter);
    calls = 0;
    provider.acceptTokens = false;
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'auth_required', retryable: false });
    expect(calls).toBe(2);
    expect(invalidated).toEqual(['box-token-1']);
  });

  it('maps Retry-After and refuses cross-origin redirects', async () => {
    const provider = new FakeBoxTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    provider.forcedUserResponse = response(429, { 'Retry-After': '23' }, jsonBytes({ code: 'rate_limit_exceeded' }));
    await expect(adapter.quota()).rejects.toMatchObject({
      code: 'rate_limited', retryable: true, retryAfterSeconds: 23,
    });
    provider.forcedUserResponse = response(302, { Location: 'https://attacker.example.test/token' });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'unsafe_redirect', retryable: false });
    expect(provider.log.some((request) => new URL(request.url).hostname === 'attacker.example.test')).toBe(false);
  });

  it('splits quota and permission failures and keeps server errors retryable', async () => {
    const provider = new FakeBoxTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    provider.forcedUserResponse = jsonResponse(403, { code: 'storage_limit_exceeded' });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'quota_exceeded', retryable: false });
    provider.forcedUserResponse = jsonResponse(403, { code: 'access_denied_insufficient_permissions' });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'provider_error', retryable: false });
    provider.forcedUserResponse = jsonResponse(503, { code: 'service_unavailable' });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'provider_error', retryable: true });
  });
});

interface FakeBoxFile {
  id: string;
  name: string;
  parentId: string;
  bytes: Uint8Array;
  version: number;
}

interface FakeBoxPart {
  partId: string;
  offset: number;
  bytes: Uint8Array;
}

interface FakeBoxSession {
  id: string;
  name: string;
  folderId: string;
  total: number;
  partSize: number;
  parts: FakeBoxPart[];
}

class FakeBoxTransport implements ProviderConformanceControls {
  readonly log: HttpTransportRequest[] = [];
  readonly files = new Map<string, FakeBoxFile>();
  readonly sessions = new Map<string, FakeBoxSession>();
  readonly partDigests: string[] = [];
  readonly commitDigests: string[] = [];
  readonly directContentHashes: string[] = [];
  verificationMode: 'read_back' | 'provider_checksum' | 'none' = 'read_back';
  partialPutBytes: number | null = null;
  quotaUsedBytes: number | null = 0;
  quotaCapBytes: number | null = 4_096;
  acceptTokens = true;
  forcedUserResponse: HttpTransportResponse | null = null;
  raceConflictOnCreate: Uint8Array | null = null;
  dropCommitResponseOnce = false;
  private rootCreated = false;
  private hideNextDownload = false;
  private nextFile = 1_000;
  private nextSession = 1;

  async send(request: HttpTransportRequest): Promise<HttpTransportResponse> {
    this.log.push(copyRequest(request));
    const url = new URL(request.url);
    if (url.origin === 'https://download.box.test') return this.download(request, url);
    if (!this.acceptTokens || !header(request.headers, 'authorization')) {
      return jsonResponse(401, { code: 'invalid_token' });
    }
    const upload = url.origin === 'https://upload.box.test';
    const route = url.pathname.replace(upload ? /^\/api\/2\.0\//u : /^\/2\.0\//u, '');
    if (route === 'users/me') return this.user();
    if (route === 'folders' && request.method === 'POST') return this.createRoot(request);
    if (/^folders\/\d+\/items$/u.test(route)) return this.listFolder(url, route.split('/')[1] ?? '');
    if (/^folders\/\d+$/u.test(route)) return this.getFolder(route.split('/')[1] ?? '');
    if (route === 'files/content' && request.method === 'POST') return this.directUpload(request);
    if (route === 'files/upload_sessions' && request.method === 'POST') return this.createSession(request);
    const sessionMatch = /^files\/upload_sessions\/([^/]+)(?:\/(parts|commit))?$/u.exec(route);
    if (sessionMatch?.[1]) return this.sessionRequest(request, sessionMatch[1], sessionMatch[2] ?? null);
    const contentMatch = /^files\/(\d+)\/content$/u.exec(route);
    if (contentMatch?.[1]) return this.content(request, contentMatch[1]);
    const fileMatch = /^files\/(\d+)$/u.exec(route);
    if (fileMatch?.[1]) return request.method === 'DELETE'
      ? this.delete(fileMatch[1])
      : this.fileMetadata(fileMatch[1]);
    return jsonResponse(404, { code: 'not_found' });
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

  private user(): HttpTransportResponse {
    const forced = this.forcedUserResponse;
    this.forcedUserResponse = null;
    return forced ?? jsonResponse(200, { id: '42', space_used: this.quotaUsedBytes, space_amount: this.quotaCapBytes });
  }

  private createRoot(request: HttpTransportRequest): HttpTransportResponse {
    const body = parseRequestObject(request.body);
    const parent = typeof body.parent === 'object' && body.parent !== null && !Array.isArray(body.parent)
      ? body.parent as Record<string, unknown>
      : {};
    if (body.name !== 'Meerkat' || parent.id !== '0') return jsonResponse(400, { code: 'bad_request' });
    if (this.rootCreated) return jsonResponse(409, { code: 'item_name_in_use' });
    this.rootCreated = true;
    return jsonResponse(201, { id: '100', type: 'folder', name: 'Meerkat', parent: { id: '0' } });
  }

  private getFolder(id: string): HttpTransportResponse {
    return id === '100' && this.rootCreated
      ? jsonResponse(200, { id, type: 'folder', name: 'Meerkat', parent: { id: '0' } })
      : jsonResponse(404, { code: 'not_found' });
  }

  private listFolder(url: URL, folderId: string): HttpTransportResponse {
    const marker = Number(url.searchParams.get('marker') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '2');
    const entries: Record<string, unknown>[] = [];
    if (folderId === '0' && this.rootCreated) {
      entries.push({ id: '100', type: 'folder', name: 'Meerkat', parent: { id: '0' } });
    }
    if (folderId === '100') {
      entries.push(...[...this.files.values()]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((file) => this.fileJson(file)));
    }
    const page = entries.slice(marker, marker + limit);
    const next = marker + limit;
    return jsonResponse(200, {
      entries: page,
      ...(next < entries.length ? { next_marker: String(next) } : {}),
    });
  }

  private createSession(request: HttpTransportRequest): HttpTransportResponse {
    const body = parseRequestObject(request.body);
    const name = typeof body.file_name === 'string' ? body.file_name : '';
    const folderId = typeof body.folder_id === 'string' ? body.folder_id : '';
    const total = typeof body.file_size === 'number' ? body.file_size : 0;
    if (this.raceConflictOnCreate) {
      const file: FakeBoxFile = {
        id: String(this.nextFile++),
        name,
        parentId: folderId,
        bytes: this.raceConflictOnCreate,
        version: 1,
      };
      this.raceConflictOnCreate = null;
      this.files.set(file.id, file);
      return jsonResponse(409, { code: 'item_name_in_use' });
    }
    const id = `session_${this.nextSession++}`;
    const partSize = Math.max(1, Math.min(total, this.partialPutBytes ?? total));
    this.sessions.set(id, { id, name, folderId, total, partSize, parts: [] });
    const base = `https://upload.box.test/api/2.0/files/upload_sessions/${id}`;
    return jsonResponse(201, {
      id,
      part_size: partSize,
      session_endpoints: {
        upload_part: base,
        commit: `${base}/commit`,
        list_parts: `${base}/parts`,
      },
    });
  }

  private directUpload(request: HttpTransportRequest): HttpTransportResponse {
    const contentType = header(request.headers, 'content-type');
    const boundary = contentType ? /boundary=([^;\s]+)/u.exec(contentType)?.[1] : undefined;
    const upload = boundary ? parseFakeMultipart(request.body ?? new Uint8Array(), boundary) : null;
    if (!upload) return jsonResponse(400, { code: 'bad_request' });
    const receivedHash = header(request.headers, 'content-md5');
    this.directContentHashes.push(receivedHash ?? '');
    if (receivedHash !== sha1Hex(upload.bytes)) return jsonResponse(400, { code: 'invalid_digest' });
    const conflict = [...this.files.values()].some(
      (file) => file.parentId === upload.folderId && file.name === upload.name,
    );
    if (conflict) return jsonResponse(409, { code: 'item_name_in_use' });
    const file: FakeBoxFile = {
      id: String(this.nextFile++),
      name: upload.name,
      parentId: upload.folderId,
      bytes: upload.bytes,
      version: 1,
    };
    this.files.set(file.id, file);
    return jsonResponse(201, { entries: [this.fileJson(file)] });
  }

  private sessionRequest(
    request: HttpTransportRequest,
    id: string,
    action: string | null,
  ): HttpTransportResponse {
    const session = this.sessions.get(id);
    if (!session) return jsonResponse(404, { code: 'not_found' });
    if (action === 'parts') {
      return jsonResponse(200, { entries: session.parts.map((part) => this.partJson(part)) });
    }
    if (action === 'commit') {
      const response = this.commit(request, session);
      if (this.dropCommitResponseOnce) {
        this.dropCommitResponseOnce = false;
        throw new Error('simulated lost Box commit response');
      }
      return response;
    }
    const range = header(request.headers, 'content-range');
    const parsed = range ? /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(range) : null;
    if (!parsed?.[1] || !parsed[2] || !parsed[3]) return jsonResponse(400, { code: 'invalid_range' });
    const offset = Number(parsed[1]);
    const bytes = request.body ?? new Uint8Array();
    const expectedDigest = digest(bytes);
    const receivedDigest = header(request.headers, 'digest');
    this.partDigests.push(receivedDigest ?? '');
    if (receivedDigest !== expectedDigest || Number(parsed[3]) !== session.total) {
      return jsonResponse(400, { code: 'invalid_digest' });
    }
    const part: FakeBoxPart = { partId: `part_${session.parts.length + 1}`, offset, bytes: bytes.slice() };
    session.parts.push(part);
    return jsonResponse(200, { part: this.partJson(part) });
  }

  private commit(request: HttpTransportRequest, session: FakeBoxSession): HttpTransportResponse {
    let bytes: Uint8Array = new Uint8Array();
    for (const part of session.parts.sort((left, right) => left.offset - right.offset)) {
      bytes = concat(bytes, part.bytes);
    }
    const receivedDigest = header(request.headers, 'digest');
    this.commitDigests.push(receivedDigest ?? '');
    if (bytes.length !== session.total || receivedDigest !== digest(bytes)) {
      return jsonResponse(400, { code: 'invalid_digest' });
    }
    const file: FakeBoxFile = {
      id: String(this.nextFile++),
      name: session.name,
      parentId: session.folderId,
      bytes,
      version: 1,
    };
    this.files.set(file.id, file);
    this.sessions.delete(session.id);
    if (this.verificationMode === 'none') this.hideNextDownload = true;
    return jsonResponse(201, { entries: [this.fileJson(file)] });
  }

  private content(_request: HttpTransportRequest, id: string): HttpTransportResponse {
    const file = this.files.get(id);
    if (!file) return jsonResponse(404, { code: 'not_found' });
    return response(302, { Location: `https://download.box.test/files/${id}` });
  }

  private download(request: HttpTransportRequest, url: URL): HttpTransportResponse {
    if (header(request.headers, 'authorization')) return jsonResponse(400, { code: 'authorization_not_allowed' });
    const id = url.pathname.replace(/^\/files\//u, '');
    const file = this.files.get(id);
    if (!file || this.hideNextDownload) {
      this.hideNextDownload = false;
      return jsonResponse(404, { code: 'not_found' });
    }
    const range = header(request.headers, 'range');
    if (!range) return response(200, {}, file.bytes.slice());
    const parsed = /^bytes=(\d+)-(\d+)$/u.exec(range);
    if (!parsed?.[1] || !parsed[2]) return response(416);
    return response(206, {}, file.bytes.slice(Number(parsed[1]), Number(parsed[2]) + 1));
  }

  private fileMetadata(id: string): HttpTransportResponse {
    const file = this.files.get(id);
    return file ? jsonResponse(200, this.fileJson(file)) : jsonResponse(404, { code: 'not_found' });
  }

  private delete(id: string): HttpTransportResponse {
    if (!this.files.delete(id)) return jsonResponse(404, { code: 'not_found' });
    return response(204);
  }

  private fileJson(file: FakeBoxFile): Record<string, unknown> {
    return {
      id: file.id,
      type: 'file',
      name: file.name,
      size: file.bytes.length,
      etag: String(file.version),
      sequence_id: String(file.version),
      file_version: { id: String(file.version) },
      parent: { id: file.parentId },
      ...(this.verificationMode === 'provider_checksum' ? { sha1: sha1Hex(file.bytes) } : {}),
    };
  }

  private partJson(part: FakeBoxPart): Record<string, unknown> {
    return {
      part_id: part.partId,
      offset: part.offset,
      size: part.bytes.length,
      sha1: sha1Hex(part.bytes),
    };
  }
}

class MemoryBoxFolderState implements BoxFolderState {
  folderId: string | null = null;

  async getFolderId(): Promise<string | null> {
    return this.folderId;
  }

  async setFolderId(folderId: string): Promise<void> {
    this.folderId = folderId;
  }

  async clearFolderId(): Promise<void> {
    this.folderId = null;
  }
}

function adapterFor(
  provider: FakeBoxTransport,
  accessTokenProvider: AccessTokenProvider = { getAccessToken: async () => 'box-access-token' },
  folderState: BoxFolderState = new MemoryBoxFolderState(),
  chunkedUploadThresholdBytes = 1,
): BoxStorageAdapter {
  return new BoxStorageAdapter({
    transport: (request) => provider.send(request),
    accessTokenProvider,
    credentialRef: 'broker://oauth/box-vault',
    folderState,
    apiBaseUrl: 'https://api.box.test/2.0/',
    uploadBaseUrl: 'https://upload.box.test/api/2.0/',
    downloadAllowedOrigins: ['https://download.box.test'],
    maximumObjectBytes: 1_024,
    chunkedUploadThresholdBytes,
    pageSize: 2,
    now: () => '2026-07-14T12:00:00.000Z',
  });
}

async function authorize(adapter: StorageDestinationAdapter): Promise<void> {
  expect((await adapter.authorize({ kind: 'interactive', credentialRef: 'broker://oauth/box-vault' })).kind)
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

function digest(bytes: Uint8Array): string {
  return `sha=${createHash('sha1').update(bytes).digest('base64')}`;
}

function parseFakeMultipart(
  body: Uint8Array,
  boundary: string,
): { name: string; folderId: string; bytes: Uint8Array } | null {
  const separator = encoder.encode('\r\n\r\n');
  const nextPart = encoder.encode(`\r\n--${boundary}\r\n`);
  const closing = encoder.encode(`\r\n--${boundary}--\r\n`);
  const attributesHeaderEnd = findBytes(body, separator, 0);
  if (attributesHeaderEnd < 0) return null;
  const attributesEnd = findBytes(body, nextPart, attributesHeaderEnd + separator.length);
  if (attributesEnd < 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body.slice(
      attributesHeaderEnd + separator.length,
      attributesEnd,
    ))) as unknown;
  } catch {
    return null;
  }
  const attributes = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
  const parent = typeof attributes?.parent === 'object' && attributes.parent !== null
    && !Array.isArray(attributes.parent)
    ? attributes.parent as Record<string, unknown>
    : null;
  const name = stringValue(attributes?.name);
  const folderId = stringValue(parent?.id);
  const fileHeaderEnd = findBytes(body, separator, attributesEnd + nextPart.length);
  if (!name || !folderId || fileHeaderEnd < 0) return null;
  const fileEnd = findBytes(body, closing, fileHeaderEnd + separator.length);
  if (fileEnd < 0) return null;
  return {
    name,
    folderId,
    bytes: body.slice(fileHeaderEnd + separator.length, fileEnd),
  };
}

function findBytes(haystack: Uint8Array, needle: Uint8Array, start: number): number {
  for (let offset = start; offset <= haystack.length - needle.length; offset += 1) {
    let matches = true;
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[offset + index] !== needle[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return offset;
  }
  return -1;
}
