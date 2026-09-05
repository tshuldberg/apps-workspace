import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha512Hex } from '../../../node/hkdf';
import { runStorageAdapterConformance } from '../../conformance';
import type { EncryptedStorageObject, StorageDestinationAdapter } from '../../types';
import {
  DropboxStorageAdapter,
  dropboxContentHash,
  type AccessTokenProvider,
} from '../../adapters/dropbox';
import type { HttpTransportRequest, HttpTransportResponse } from '../../adapters/http';
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
  'DropboxStorageAdapter',
  () => {
    const provider = new FakeDropboxTransport();
    return createProviderConformanceFixture(adapterFor(provider), provider);
  },
  {
    testApi: { describe, it },
    authorizeInput: { kind: 'interactive', credentialRef: 'broker://oauth/dropbox-vault' },
  },
);

describe('DropboxStorageAdapter protocol', () => {
  it('matches Dropbox content_hash known answers for a small file and multiple 4 MiB blocks', () => {
    expect(dropboxContentHash(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    const small = encoder.encode('hello world');
    expect(dropboxContentHash(small)).toBe('bc62d4b80d9e36da29c16c5d4d9f11731f36052c72401a76c23c0fb5a9b74423');

    const multi = new Uint8Array(4 * 1024 * 1024 + 257);
    for (let index = 0; index < multi.length; index += 1) multi[index] = (index * 31 + 7) & 0xff;
    const independent = independentDropboxContentHash(multi);
    expect(dropboxContentHash(multi)).toBe(independent);
    expect(independent).toBe('2d0173a184300a1ab742b16a18c1722ff5ece249649175aa1ed284388843a20f');
  });

  it('resumes a partially accepted finish from the session id and corrected offset', async () => {
    const provider = new FakeDropboxTransport();
    provider.partialPutBytes = 3;
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('dropbox-resume', new Uint8Array([0, 1, 2, 3, 4, 5, 6]));

    const first = await adapter.putObject(input);
    expect(first).toMatchObject({ complete: false, encryptedBytes: 3, resumeToken: { offset: 3 } });
    if (first.complete) throw new Error('expected Dropbox resume state');
    expect(first.resumeToken.providerSession).toMatch(/^dropbox-session:/u);
    const second = await adapter.putObject(input, first.resumeToken);
    expect(second).toMatchObject({ complete: false, encryptedBytes: 6, resumeToken: { offset: 6 } });
    if (second.complete) throw new Error('expected second Dropbox resume state');
    await expect(adapter.putObject(input, second.resumeToken)).resolves.toMatchObject({
      complete: true,
      verified: true,
    });
  });

  it('retries commit from an acknowledged complete offset', async () => {
    const provider = new FakeDropboxTransport();
    provider.deferFinishOnceAtTotal = true;
    const adapter = adapterFor(provider);
    await authorize(adapter);
    const input = object('dropbox-commit-retry', new Uint8Array([1, 2, 3, 4]));
    const first = await adapter.putObject(input);
    expect(first).toMatchObject({ complete: false, encryptedBytes: 4, resumeToken: { offset: 4 } });
    if (first.complete) throw new Error('expected acknowledged Dropbox resume state');
    await expect(adapter.putObject(input, first.resumeToken)).resolves.toMatchObject({
      complete: true,
      verified: true,
    });
  });

  it('fails closed on a path conflict whose provider hash differs', async () => {
    const provider = new FakeDropboxTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    await adapter.putObject(object('same-path', new Uint8Array([1, 2, 3])));
    await expect(adapter.putObject(object('same-path', new Uint8Array([3, 2, 1])))).rejects.toMatchObject({
      code: 'corrupt_ciphertext',
      retryable: false,
    });
  });

  it('refreshes once after 401, then returns auth_required', async () => {
    const provider = new FakeDropboxTransport();
    let calls = 0;
    const invalidated: string[] = [];
    const adapter = adapterFor(provider, {
      getAccessToken: async () => `dropbox-token-${++calls}`,
      invalidateAccessToken: (token) => { invalidated.push(token); },
    });
    await authorize(adapter);
    calls = 0;
    provider.acceptTokens = false;
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'auth_required', retryable: false });
    expect(calls).toBe(2);
    expect(invalidated).toEqual(['dropbox-token-1']);
  });

  it('maps 429 Retry-After into a typed retryable error', async () => {
    const provider = new FakeDropboxTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    provider.forcedSpaceResponse = response(429, { 'Retry-After': '37' }, jsonBytes({ error_summary: 'too_many_requests' }));
    await expect(adapter.quota()).rejects.toMatchObject({
      code: 'rate_limited',
      retryable: true,
      retryAfterSeconds: 37,
    });
  });

  it('splits quota and permission failures and keeps server errors retryable', async () => {
    const provider = new FakeDropboxTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    provider.forcedSpaceResponse = jsonResponse(403, { error_summary: 'insufficient_space' });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'quota_exceeded', retryable: false });
    provider.forcedSpaceResponse = jsonResponse(403, { error_summary: 'insufficient_permissions' });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'provider_error', retryable: false });
    provider.forcedSpaceResponse = jsonResponse(503, { error_summary: 'temporarily_unavailable' });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'provider_error', retryable: true });
  });

  it('refuses a cross-origin provider redirect before forwarding authorization', async () => {
    const provider = new FakeDropboxTransport();
    const adapter = adapterFor(provider);
    await authorize(adapter);
    provider.forcedSpaceResponse = response(302, { Location: 'https://attacker.example.test/steal' });
    await expect(adapter.quota()).rejects.toMatchObject({ code: 'unsafe_redirect', retryable: false });
    expect(provider.log.some((request) => new URL(request.url).hostname === 'attacker.example.test')).toBe(false);
  });
});

interface FakeDropboxFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  rev: number;
}

interface FakeDropboxSession {
  id: string;
  accepted: Uint8Array;
  expectedTotal: number | null;
}

class FakeDropboxTransport implements ProviderConformanceControls {
  readonly log: HttpTransportRequest[] = [];
  readonly files = new Map<string, FakeDropboxFile>();
  readonly sessions = new Map<string, FakeDropboxSession>();
  verificationMode: 'read_back' | 'provider_checksum' | 'none' = 'read_back';
  partialPutBytes: number | null = null;
  quotaUsedBytes: number | null = 0;
  quotaCapBytes: number | null = 4_096;
  acceptTokens = true;
  forcedSpaceResponse: HttpTransportResponse | null = null;
  deferFinishOnceAtTotal = false;
  private nextFile = 1;
  private nextSession = 1;
  private hideNextDownload = false;

  async send(request: HttpTransportRequest): Promise<HttpTransportResponse> {
    this.log.push(copyRequest(request));
    if (!this.acceptTokens || !header(request.headers, 'authorization')) return jsonResponse(401, { error: 'invalid_access_token' });
    const url = new URL(request.url);
    const route = url.pathname.replace(/^\/2\//u, '');
    if (route === 'users/get_space_usage') return this.spaceUsage();
    if (route === 'files/get_metadata') return this.getMetadata(request);
    if (route === 'files/list_folder') return this.listFolder(request, false);
    if (route === 'files/list_folder/continue') return this.listFolder(request, true);
    if (route === 'files/delete_v2') return this.deleteFile(request);
    if (route === 'files/upload_session/start') return this.startSession();
    if (route === 'files/upload_session/append_v2') return this.appendSession(request);
    if (route === 'files/upload_session/finish') return this.finishSession(request);
    if (route === 'files/download') return this.download(request);
    return jsonResponse(404, { error_summary: 'not_found' });
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

  private spaceUsage(): HttpTransportResponse {
    const forced = this.forcedSpaceResponse;
    this.forcedSpaceResponse = null;
    if (forced) return forced;
    return jsonResponse(200, {
      used: this.quotaUsedBytes,
      allocation: { '.tag': 'individual', allocated: this.quotaCapBytes },
    });
  }

  private getMetadata(request: HttpTransportRequest): HttpTransportResponse {
    const path = stringValue(parseRequestObject(request.body).path);
    const file = path ? this.resolveFile(path) : null;
    return file ? jsonResponse(200, this.fileJson(file)) : notFound();
  }

  private listFolder(request: HttpTransportRequest, continuation: boolean): HttpTransportResponse {
    const body = parseRequestObject(request.body);
    const offset = continuation ? cursorOffset(stringValue(body.cursor)) : 0;
    const limit = continuation ? 2 : Number(body.limit ?? 100);
    const files = [...this.files.values()].sort((left, right) => left.name.localeCompare(right.name));
    const page = files.slice(offset, offset + limit);
    const next = offset + limit;
    return jsonResponse(200, {
      entries: page.map((file) => this.fileJson(file)),
      cursor: `offset:${next}`,
      has_more: next < files.length,
    });
  }

  private deleteFile(request: HttpTransportRequest): HttpTransportResponse {
    const path = stringValue(parseRequestObject(request.body).path);
    const file = path ? this.resolveFile(path) : null;
    if (!file) return notFound();
    this.files.delete(file.id);
    return jsonResponse(200, { metadata: this.fileJson(file) });
  }

  private startSession(): HttpTransportResponse {
    const id = `session_${this.nextSession++}`;
    this.sessions.set(id, { id, accepted: new Uint8Array(), expectedTotal: null });
    return jsonResponse(200, { session_id: id });
  }

  private appendSession(request: HttpTransportRequest): HttpTransportResponse {
    const arg = apiArg(request);
    const cursor = parseCursor(arg.cursor);
    const session = cursor ? this.sessions.get(cursor.sessionId) : null;
    if (!session || cursor?.offset !== session.accepted.byteLength) return incorrectOffset(session?.accepted.length ?? 0);
    const body = request.body ?? new Uint8Array();
    if (stringValue(arg.content_hash) !== dropboxContentHash(body)) {
      return jsonResponse(409, { error_summary: 'content_hash_mismatch' });
    }
    const accepted = Math.min(body.length, this.partialPutBytes ?? body.length);
    session.accepted = concat(session.accepted, body.slice(0, accepted));
    return accepted === body.length ? response(200) : incorrectOffset(session.accepted.length);
  }

  private finishSession(request: HttpTransportRequest): HttpTransportResponse {
    const arg = apiArg(request);
    const cursor = parseCursor(arg.cursor);
    const session = cursor ? this.sessions.get(cursor.sessionId) : null;
    if (!session || cursor?.offset !== session.accepted.byteLength) return incorrectOffset(session?.accepted.length ?? 0);
    const body = request.body ?? new Uint8Array();
    if (stringValue(arg.content_hash) !== dropboxContentHash(body)) {
      return jsonResponse(409, { error_summary: 'content_hash_mismatch' });
    }
    session.expectedTotal ??= cursor.offset + body.length;
    const accepted = Math.min(body.length, this.partialPutBytes ?? body.length);
    session.accepted = concat(session.accepted, body.slice(0, accepted));
    if (session.accepted.length < session.expectedTotal) return incorrectOffset(session.accepted.length);
    if (this.deferFinishOnceAtTotal) {
      this.deferFinishOnceAtTotal = false;
      return incorrectOffset(session.accepted.length);
    }
    const commit = parseRequestObject(jsonBytes(arg.commit));
    const path = stringValue(commit.path);
    const name = path?.startsWith('/') ? path.slice(1) : null;
    if (!name || this.fileByName(name)) return jsonResponse(409, { error_summary: 'path/conflict/file' });
    const file: FakeDropboxFile = {
      id: `id:file_${this.nextFile++}`,
      name,
      bytes: session.accepted.slice(),
      rev: 1,
    };
    this.files.set(file.id, file);
    this.sessions.delete(session.id);
    if (this.verificationMode === 'none') this.hideNextDownload = true;
    return jsonResponse(200, this.fileJson(file));
  }

  private download(request: HttpTransportRequest): HttpTransportResponse {
    const path = stringValue(apiArg(request).path);
    const file = path ? this.resolveFile(path) : null;
    if (!file || this.hideNextDownload) {
      this.hideNextDownload = false;
      return notFound();
    }
    const range = header(request.headers, 'range');
    if (!range) return response(200, {}, file.bytes.slice());
    const match = /^bytes=(\d+)-(\d+)$/u.exec(range);
    if (!match) return response(416);
    const start = Number(match[1]);
    const end = Number(match[2]);
    return response(206, {}, file.bytes.slice(start, end + 1));
  }

  private resolveFile(path: string): FakeDropboxFile | null {
    return path.startsWith('id:') ? this.files.get(path) ?? null : this.fileByName(path.replace(/^\//u, ''));
  }

  private fileByName(name: string): FakeDropboxFile | null {
    return [...this.files.values()].find((file) => file.name === name) ?? null;
  }

  private fileJson(file: FakeDropboxFile): Record<string, unknown> {
    return {
      '.tag': 'file',
      id: file.id,
      name: file.name,
      path_lower: `/${file.name.toLowerCase()}`,
      rev: String(file.rev),
      size: file.bytes.length,
      server_modified: '2026-07-14T12:00:00.000Z',
      ...(this.verificationMode === 'provider_checksum'
        ? { content_hash: dropboxContentHash(file.bytes) }
        : {}),
    };
  }
}

function adapterFor(
  provider: FakeDropboxTransport,
  accessTokenProvider: AccessTokenProvider = { getAccessToken: async () => 'dropbox-access-token' },
): DropboxStorageAdapter {
  return new DropboxStorageAdapter({
    transport: (request) => provider.send(request),
    accessTokenProvider,
    credentialRef: 'broker://oauth/dropbox-vault',
    maximumObjectBytes: 1_024,
    pageSize: 2,
    now: () => '2026-07-14T12:00:00.000Z',
  });
}

async function authorize(adapter: StorageDestinationAdapter): Promise<void> {
  expect((await adapter.authorize({ kind: 'interactive', credentialRef: 'broker://oauth/dropbox-vault' })).kind)
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

function apiArg(request: HttpTransportRequest): Record<string, unknown> {
  const value = header(request.headers, 'dropbox-api-arg');
  return value ? JSON.parse(value) as Record<string, unknown> : {};
}

function parseCursor(value: unknown): { sessionId: string; offset: number } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return typeof record.session_id === 'string' && typeof record.offset === 'number'
    ? { sessionId: record.session_id, offset: record.offset }
    : null;
}

function cursorOffset(value: string | null): number {
  const match = value ? /^offset:(\d+)$/u.exec(value) : null;
  return match?.[1] ? Number(match[1]) : 0;
}

function notFound(): HttpTransportResponse {
  return jsonResponse(409, { error_summary: 'path/not_found/', error: { '.tag': 'path', path: { '.tag': 'not_found' } } });
}

function incorrectOffset(offset: number): HttpTransportResponse {
  return jsonResponse(409, {
    error_summary: 'lookup_failed/incorrect_offset',
    error: { '.tag': 'lookup_failed', lookup_failed: { '.tag': 'incorrect_offset', correct_offset: offset } },
  });
}

function independentDropboxContentHash(bytes: Uint8Array): string {
  const blocks: Buffer[] = [];
  for (let offset = 0; offset < bytes.length; offset += 4 * 1024 * 1024) {
    blocks.push(createHash('sha256').update(bytes.slice(offset, offset + 4 * 1024 * 1024)).digest());
  }
  return createHash('sha256').update(Buffer.concat(blocks)).digest('hex');
}
