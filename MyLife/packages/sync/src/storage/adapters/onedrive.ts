import { sha256Hex } from '../../encryption/sha256';
import { sha512Hex } from '../../node/hkdf';
import type {
  EncryptedStorageObject,
  StorageAuthorizationInput,
  StorageAuthorizationResult,
  StorageByteRange,
  StorageCapabilities,
  StorageDeleteResult,
  StorageDestinationAdapter,
  StorageHealth,
  StorageObjectMetadata,
  StorageObjectPage,
  StorageObjectRef,
  StorageQuota,
  StorageResumeToken,
  StorageVerificationEvidence,
  StorageWriteResult,
} from '../types';
import { StorageAdapterError } from '../types';
import type { AccessTokenProvider } from './google-drive';
import type { HttpTransport, HttpTransportResponse } from './http';
import { assertSafeObjectId, equalBytes } from './http';
import {
  OAuthHttpClient,
  decodeOpaque,
  encodeOpaque,
  healthResult,
  incompleteWrite,
  jsonBytes,
  normalizeProviderError,
  optionalByteCount,
  parseHttpsBase,
  parseJsonObject,
  positiveInteger,
  rateLimitedError,
  recordValue,
  requiredString,
  stringArray,
  validateCredentialRef,
  validateEncryptedObject,
  validateRange,
  validateResumeOffset,
} from './provider-common';
import { quickXorHashBase64, sha1Hex } from './provider-crypto';

export type { AccessTokenProvider } from './google-drive';

export { quickXorHashBase64, quickXorHashBytes } from './provider-crypto';

export interface OneDriveAdapterOptions {
  transport: HttpTransport;
  accessTokenProvider: AccessTokenProvider;
  credentialRef: string;
  apiBaseUrl?: string;
  uploadSessionAllowedOrigins?: readonly string[];
  maximumObjectBytes?: number;
  uploadChunkBytes?: number;
  pageSize?: number;
  maximumResponseBytes?: number;
  now?: () => string;
}

interface GraphHashes {
  quickXorHash: string | null;
  sha1Hash: string | null;
  sha256Hash: string | null;
}

interface GraphItem {
  id: string;
  name: string;
  size: number;
  eTag: string | null;
  cTag: string | null;
  lastModifiedDateTime: string | null;
  hashes: GraphHashes;
  isFile: boolean;
  downloadUrl: string | null;
}

const DEFAULT_API_BASE = 'https://graph.microsoft.com/v1.0/';
const DEFAULT_MAXIMUM_OBJECT_BYTES = 512 * 1024 * 1024;
const DEFAULT_UPLOAD_CHUNK_BYTES = 5 * 320 * 1024;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAXIMUM_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_PAGE_SIZE = 1_000;
const GRAPH_ITEM_ID = /^[A-Za-z0-9!._-]{1,512}$/u;
const HASH_HEX = /^[a-f0-9]+$/u;

export class OneDriveStorageAdapter implements StorageDestinationAdapter {
  private readonly accessTokenProvider: AccessTokenProvider;
  private readonly credentialRef: string;
  private readonly apiBase: URL;
  private readonly uploadSessionAllowedOrigins: readonly string[];
  private readonly maximumObjectBytes: number;
  private readonly uploadChunkBytes: number;
  private readonly pageSize: number;
  private readonly maximumResponseBytes: number;
  private readonly now: () => string;
  private readonly http: OAuthHttpClient;
  private authorized = false;
  private revoked = false;
  private verifiedReadWrite = false;

  constructor(options: OneDriveAdapterOptions) {
    this.accessTokenProvider = options.accessTokenProvider;
    this.credentialRef = validateCredentialRef(options.credentialRef, 'OneDrive');
    this.apiBase = parseHttpsBase(options.apiBaseUrl ?? DEFAULT_API_BASE, 'Microsoft Graph API base URL');
    this.uploadSessionAllowedOrigins = (options.uploadSessionAllowedOrigins ?? [])
      .map((origin) => parseAllowedOrigin(origin));
    this.maximumObjectBytes = positiveInteger(
      options.maximumObjectBytes ?? DEFAULT_MAXIMUM_OBJECT_BYTES,
      'maximumObjectBytes',
    );
    this.uploadChunkBytes = positiveInteger(
      options.uploadChunkBytes ?? DEFAULT_UPLOAD_CHUNK_BYTES,
      'uploadChunkBytes',
    );
    if (options.uploadChunkBytes !== undefined && this.uploadChunkBytes % (320 * 1024) !== 0) {
      throw new StorageAdapterError('provider_error', 'OneDrive upload chunks must be 320 KiB aligned', false);
    }
    this.pageSize = positiveInteger(options.pageSize ?? DEFAULT_PAGE_SIZE, 'pageSize');
    if (this.pageSize > MAX_PAGE_SIZE) {
      throw new StorageAdapterError('provider_error', 'OneDrive page size exceeds the provider limit', false);
    }
    this.maximumResponseBytes = positiveInteger(
      options.maximumResponseBytes ?? DEFAULT_MAXIMUM_RESPONSE_BYTES,
      'maximumResponseBytes',
    );
    this.now = options.now ?? (() => new Date().toISOString());
    this.http = new OAuthHttpClient(
      'OneDrive',
      options.transport,
      options.accessTokenProvider,
      () => { this.authorized = false; },
    );
  }

  async authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult> {
    if (this.revoked && input.kind !== 'interactive') {
      return {
        kind: 'revoked',
        credentialRef: input.credentialRef,
        ...(input.accountHint ? { accountHint: input.accountHint } : {}),
      };
    }
    const token = await this.http.readAccessToken('health');
    if (!token) {
      return {
        kind: 'authorization_required',
        credentialRef: input.credentialRef ?? this.credentialRef,
        ...(input.accountHint ? { accountHint: input.accountHint } : {}),
      };
    }
    this.authorized = true;
    this.revoked = false;
    return {
      kind: 'authorized',
      credentialRef: input.credentialRef ?? this.credentialRef,
      ...(input.accountHint ? { accountHint: input.accountHint } : {}),
    };
  }

  async revoke(options: { deleteRemoteData: boolean }): Promise<void> {
    if (options.deleteRemoteData && this.authorized) {
      let cursor: string | undefined;
      do {
        const page = await this.listObjects(cursor);
        for (const item of page.items) {
          await this.deleteObject({ objectId: item.objectId, remoteRef: item.remoteRef });
        }
        cursor = page.nextCursor ?? undefined;
      } while (cursor !== undefined);
    }
    try {
      await this.accessTokenProvider.revoke?.();
    } finally {
      this.authorized = false;
      this.revoked = true;
      this.verifiedReadWrite = false;
    }
  }

  async capabilities(): Promise<StorageCapabilities> {
    return {
      backgroundWrite: true,
      resumableUpload: true,
      list: true,
      delete: true,
      quota: true,
      serverChecksum: true,
      maximumObjectBytes: this.maximumObjectBytes,
    };
  }

  async health(): Promise<StorageHealth> {
    if (this.revoked) return healthResult(this.now, 'revoked', false, 'revoked');
    if (!this.authorized) return healthResult(this.now, 'auth_required', false, 'auth_required');
    try {
      const url = this.apiUrl('me/drive/special/approot');
      url.searchParams.set('$select', 'id,name,specialFolder');
      const response = await this.http.request('health', 'GET', url.href);
      if (response.status !== 200) throwOneDriveResponse(response, this.maximumResponseBytes);
      const body = parseJsonObject(response.body, this.maximumResponseBytes, 'OneDrive');
      if (!GRAPH_ITEM_ID.test(requiredString(body.id, 512) ?? '')) {
        throw new StorageAdapterError('provider_error', 'OneDrive approot metadata is malformed', false);
      }
      return healthResult(this.now, 'ok', this.verifiedReadWrite);
    } catch (error) {
      const normalized = normalizeProviderError(error, 'OneDrive');
      if (normalized.code === 'auth_required') {
        this.authorized = false;
        return healthResult(this.now, 'auth_required', false, normalized.code);
      }
      if (normalized.code === 'unreachable') {
        return healthResult(this.now, 'unreachable', false, normalized.code);
      }
      return healthResult(this.now, 'degraded', false, normalized.code);
    }
  }

  async quota(): Promise<StorageQuota> {
    this.requireAuthorized();
    const url = this.apiUrl('me/drive');
    url.searchParams.set('$select', 'quota');
    const response = await this.http.request('quota', 'GET', url.href);
    if (response.status !== 200) throwOneDriveResponse(response, this.maximumResponseBytes);
    const root = parseJsonObject(response.body, this.maximumResponseBytes, 'OneDrive');
    const quota = recordValue(root.quota);
    return {
      usedBytes: optionalByteCount(quota?.used),
      capBytes: optionalByteCount(quota?.total),
      estimated: false,
    };
  }

  async putObject(input: EncryptedStorageObject, resume?: StorageResumeToken): Promise<StorageWriteResult> {
    this.requireAuthorized();
    assertSafeObjectId(input.objectId);
    validateEncryptedObject(input, this.maximumObjectBytes, 'OneDrive');
    const existing = await this.getItem(input.objectId);
    if (existing) return this.resolveExisting(input, existing);

    let sessionUrl: string;
    let offset: number;
    if (resume) {
      offset = validateResumeOffset(resume, input.encryptedBytes, 'OneDrive');
      sessionUrl = this.validateSessionUrl(resume.providerSession);
      let status: HttpTransportResponse;
      try {
        status = await this.http.requestPreauthorized('GET', sessionUrl);
      } catch (error) {
        const normalized = normalizeProviderError(error, 'OneDrive');
        if (normalized.retryable) return incompleteWrite(input, sessionUrl, offset);
        throw normalized;
      }
      if (status.status === 404) {
        const completed = await this.getItem(input.objectId);
        if (completed) return this.resolveExisting(input, completed);
      }
      if (status.status !== 200) throwOneDriveResponse(status, this.maximumResponseBytes);
      const providerOffset = nextExpectedOffset(status.body, this.maximumResponseBytes);
      if (providerOffset < offset || providerOffset >= input.encryptedBytes) {
        throw new StorageAdapterError('conflict', 'OneDrive upload-session offset regressed or overflowed', false);
      }
      offset = providerOffset;
    } else {
      try {
        sessionUrl = await this.startUploadSession(input);
      } catch (error) {
        const normalized = normalizeProviderError(error, 'OneDrive');
        if (normalized.code === 'conflict') {
          const raced = await this.getItem(input.objectId);
          if (raced) return this.resolveExisting(input, raced);
        }
        throw normalized;
      }
      offset = 0;
    }

    const end = Math.min(input.encryptedBytes, offset + this.uploadChunkBytes);
    let response: HttpTransportResponse;
    try {
      response = await this.http.requestPreauthorized('PUT', sessionUrl, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(end - offset),
        'Content-Range': `bytes ${offset}-${end - 1}/${input.encryptedBytes}`,
      }, input.ciphertext.slice(offset, end));
    } catch (error) {
      const normalized = normalizeProviderError(error, 'OneDrive');
      if (normalized.retryable) return incompleteWrite(input, sessionUrl, offset);
      throw normalized;
    }
    if (response.status === 202) {
      const nextOffset = nextExpectedOffset(response.body, this.maximumResponseBytes);
      if (nextOffset <= offset || nextOffset >= input.encryptedBytes) {
        throw new StorageAdapterError('provider_error', 'OneDrive upload session did not make valid progress', true);
      }
      return incompleteWrite(input, sessionUrl, nextOffset);
    }
    if (response.status === 409 || response.status === 412) {
      const raced = await this.getItem(input.objectId);
      if (raced) return this.resolveExisting(input, raced);
    }
    if (response.status !== 200 && response.status !== 201) {
      throwOneDriveResponse(response, this.maximumResponseBytes);
    }
    const completed = parseGraphItem(response.body, this.maximumResponseBytes);
    return this.completedWrite(input, completed);
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null> {
    this.requireAuthorized();
    assertSafeObjectId(ref.objectId);
    const item = await this.resolveItem(ref);
    return item ? metadata(item, ref.objectId) : null;
  }

  async getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null> {
    this.requireAuthorized();
    assertSafeObjectId(ref.objectId);
    if (range) validateRange(range, 'OneDrive');
    const item = await this.resolveItem(ref);
    if (!item) return null;
    return this.downloadItem(item, range);
  }

  async listObjects(cursor?: string): Promise<StorageObjectPage> {
    this.requireAuthorized();
    let url: URL;
    if (cursor === undefined) {
      url = this.apiUrl('me/drive/special/approot/children');
      url.searchParams.set('$select', GRAPH_FIELDS);
      url.searchParams.set('$top', String(this.pageSize));
      url.searchParams.set('$orderby', 'name');
    } else {
      const decoded = decodeOpaque(cursor, 'onedrive-cursor', 8_192, 'OneDrive');
      const nextLink = requiredString(decoded.nextLink, 6_144) ?? '';
      if (decoded.v !== 1) throw new StorageAdapterError('provider_error', 'OneDrive cursor is invalid', false);
      url = this.validateNextLink(nextLink);
    }
    const response = await this.http.request('list', 'GET', url.href);
    if (response.status !== 200) throwOneDriveResponse(response, this.maximumResponseBytes);
    const body = parseJsonObject(response.body, this.maximumResponseBytes, 'OneDrive');
    if (!Array.isArray(body.value) || body.value.length > MAX_PAGE_SIZE) {
      throw new StorageAdapterError('provider_error', 'OneDrive children page is malformed', false);
    }
    const items: StorageObjectMetadata[] = [];
    for (const value of body.value) {
      const record = recordValue(value);
      if (!record) throw new StorageAdapterError('provider_error', 'OneDrive children page is malformed', false);
      const item = graphItemFromRecord(record);
      if (item.isFile && isSafeObjectId(item.name)) items.push(metadata(item, item.name));
    }
    items.sort((left, right) => left.objectId.localeCompare(right.objectId));
    const nextLink = requiredString(body['@odata.nextLink'], 6_144);
    if (nextLink) this.validateNextLink(nextLink);
    return {
      items,
      nextCursor: nextLink ? encodeOpaque('onedrive-cursor', { v: 1, nextLink }) : null,
    };
  }

  async deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult> {
    this.requireAuthorized();
    assertSafeObjectId(ref.objectId);
    const item = await this.resolveItem(ref);
    if (!item) return { deleted: false, remoteRef: null };
    const response = await this.http.request('delete', 'DELETE', this.itemUrl(ref.objectId).href);
    if (response.status === 404) return { deleted: false, remoteRef: remoteRef(item.id) };
    if (response.status !== 204) throwOneDriveResponse(response, this.maximumResponseBytes);
    return { deleted: true, remoteRef: remoteRef(item.id) };
  }

  private async startUploadSession(input: EncryptedStorageObject): Promise<string> {
    const response = await this.http.request('write', 'POST', this.itemActionUrl(
      input.objectId,
      'createUploadSession',
    ).href, {
      'Content-Type': 'application/json',
    }, jsonBytes({
      item: {
        '@microsoft.graph.conflictBehavior': 'fail',
        name: input.objectId,
        fileSize: input.encryptedBytes,
      },
    }));
    if (response.status !== 200 && response.status !== 201) {
      throwOneDriveResponse(response, this.maximumResponseBytes);
    }
    const body = parseJsonObject(response.body, this.maximumResponseBytes, 'OneDrive');
    const uploadUrl = requiredString(body.uploadUrl, 8_192);
    if (!uploadUrl) throw new StorageAdapterError('provider_error', 'OneDrive omitted the upload URL', true);
    return this.validateSessionUrl(uploadUrl);
  }

  private async completedWrite(input: EncryptedStorageObject, completed: GraphItem): Promise<StorageWriteResult> {
    if (completed.name !== input.objectId) {
      throw new StorageAdapterError('corrupt_ciphertext', 'OneDrive completion changed the object name', false);
    }
    const item = await this.getItem(input.objectId);
    if (!item || item.id !== completed.id) {
      throw new StorageAdapterError('corrupt_ciphertext', 'OneDrive completion was not visible in approot', false);
    }
    const evidence = await this.verifyItem(input, item);
    this.verifiedReadWrite = evidence.kind !== 'none';
    const result = {
      complete: true as const,
      remoteRef: remoteRef(item.id),
      remoteVersion: item.eTag ?? item.cTag,
      encryptedBytes: input.encryptedBytes,
      ciphertextHash: input.ciphertextHash,
    };
    return evidence.kind === 'none'
      ? { ...result, verified: false, verification: evidence }
      : { ...result, verified: true, verification: evidence };
  }

  private async resolveExisting(input: EncryptedStorageObject, item: GraphItem): Promise<StorageWriteResult> {
    const evidence = await this.verifyItem(input, item);
    if (evidence.kind === 'none') {
      throw new StorageAdapterError('corrupt_ciphertext', 'OneDrive conflict could not be verified', false);
    }
    this.verifiedReadWrite = true;
    return {
      complete: true,
      verified: true,
      verification: evidence,
      remoteRef: remoteRef(item.id),
      remoteVersion: item.eTag ?? item.cTag,
      encryptedBytes: input.encryptedBytes,
      ciphertextHash: input.ciphertextHash,
    };
  }

  private async verifyItem(
    input: EncryptedStorageObject,
    item: GraphItem,
  ): Promise<StorageVerificationEvidence> {
    if (!item.isFile || item.name !== input.objectId || item.size !== input.encryptedBytes) {
      throw new StorageAdapterError('corrupt_ciphertext', 'OneDrive item metadata did not match ciphertext', false);
    }
    const sha256 = item.hashes.sha256Hash?.toLowerCase() ?? null;
    const sha1 = item.hashes.sha1Hash?.toLowerCase() ?? null;
    const quickXor = item.hashes.quickXorHash;
    if (sha256 && (!HASH_HEX.test(sha256) || sha256 !== sha256Hex(input.ciphertext))) {
      throw new StorageAdapterError('corrupt_ciphertext', 'OneDrive SHA-256 hash did not match ciphertext', false);
    }
    if (sha1 && (!HASH_HEX.test(sha1) || sha1 !== sha1Hex(input.ciphertext))) {
      throw new StorageAdapterError('corrupt_ciphertext', 'OneDrive SHA-1 hash did not match ciphertext', false);
    }
    if (quickXor && quickXor !== quickXorHashBase64(input.ciphertext)) {
      throw new StorageAdapterError('corrupt_ciphertext', 'OneDrive quickXorHash did not match ciphertext', false);
    }
    if (sha256) return { kind: 'provider_checksum', algorithm: 'sha256', value: sha256 };
    if (sha1) return { kind: 'provider_checksum', algorithm: 'sha1', value: sha1 };
    if (quickXor) return { kind: 'provider_checksum', algorithm: 'quickxorhash', value: quickXor };
    const bytes = await this.downloadItem(item);
    if (!bytes) return { kind: 'none' };
    if (!equalBytes(bytes, input.ciphertext) || sha512Hex(bytes) !== input.ciphertextHash) {
      throw new StorageAdapterError('corrupt_ciphertext', 'OneDrive read-back did not match ciphertext', false);
    }
    return { kind: 'read_back', ciphertextHash: input.ciphertextHash };
  }

  private async resolveItem(ref: StorageObjectRef): Promise<GraphItem | null> {
    const item = await this.getItem(ref.objectId);
    if (!item) return null;
    if (ref.remoteRef && fileIdFromRemoteRef(ref.remoteRef) !== item.id) {
      throw new StorageAdapterError(
        'corrupt_ciphertext',
        'OneDrive reference is not bound to the expected approot object',
        false,
      );
    }
    return item;
  }

  private async getItem(objectId: string): Promise<GraphItem | null> {
    const url = this.itemUrl(objectId);
    url.searchParams.set('$select', GRAPH_FIELDS);
    const response = await this.http.request('read', 'GET', url.href);
    if (response.status === 404) return null;
    if (response.status !== 200) throwOneDriveResponse(response, this.maximumResponseBytes);
    return parseGraphItem(response.body, this.maximumResponseBytes);
  }

  private async downloadItem(item: GraphItem, range?: StorageByteRange): Promise<Uint8Array | null> {
    const headers: Record<string, string> = {};
    if (range) {
      if (range.length === 0) return new Uint8Array();
      headers.Range = `bytes=${range.offset}-${range.offset + range.length - 1}`;
    }
    if (!item.downloadUrl) {
      throw new StorageAdapterError('provider_error', 'OneDrive omitted the preauthenticated download URL', true);
    }
    const response = await this.http.requestPreauthorized(
      'GET',
      this.validatePreauthorizedUrl(item.downloadUrl),
      headers,
    );
    if (response.status === 404) return null;
    if (response.status !== 200 && !(range && response.status === 206)) {
      throwOneDriveResponse(response, this.maximumResponseBytes);
    }
    if (response.body.byteLength > this.maximumObjectBytes) {
      throw new StorageAdapterError('provider_error', 'OneDrive object exceeded the configured limit', false);
    }
    if (range && response.status === 200) return response.body.slice(range.offset, range.offset + range.length);
    if (range && response.body.byteLength > range.length) {
      throw new StorageAdapterError('provider_error', 'OneDrive returned too many ranged bytes', false);
    }
    return response.body.slice();
  }

  private validatePreauthorizedUrl(value: string): string {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new StorageAdapterError('provider_error', 'OneDrive upload-session URL is invalid', false);
    }
    const host = url.hostname.toLowerCase();
    const microsoftHost = host.endsWith('.1drv.com')
      || host.endsWith('.sharepoint.com')
      || host.endsWith('.sharepoint-df.com');
    if (url.protocol !== 'https:' || url.username || url.password || url.hash
      || (!microsoftHost && !this.uploadSessionAllowedOrigins.includes(url.origin))) {
      throw new StorageAdapterError('unsafe_redirect', 'OneDrive upload-session URL escaped its allowlist', false);
    }
    return url.href;
  }

  private validateSessionUrl(value: string): string {
    return this.validatePreauthorizedUrl(value);
  }

  private validateNextLink(value: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new StorageAdapterError('provider_error', 'OneDrive paging cursor is invalid', false);
    }
    const expectedPath = new URL('me/drive/special/approot/children', this.apiBase).pathname;
    if (url.origin !== this.apiBase.origin || url.username || url.password || url.hash
      || url.pathname !== expectedPath) {
      throw new StorageAdapterError('unsafe_redirect', 'OneDrive paging cursor escaped the approot collection', false);
    }
    return url;
  }

  private apiUrl(path: string): URL {
    return new URL(path, this.apiBase);
  }

  private itemUrl(objectId: string): URL {
    assertSafeObjectId(objectId);
    return this.apiUrl(`me/drive/special/approot:/${encodeURIComponent(objectId)}`);
  }

  private itemActionUrl(objectId: string, action: string): URL {
    assertSafeObjectId(objectId);
    return this.apiUrl(`me/drive/special/approot:/${encodeURIComponent(objectId)}:/${action}`);
  }

  private requireAuthorized(): void {
    if (!this.authorized) {
      throw new StorageAdapterError('auth_required', 'OneDrive authorization is required', false);
    }
  }
}

const GRAPH_FIELDS = 'id,name,size,eTag,cTag,lastModifiedDateTime,file,@microsoft.graph.downloadUrl';

function graphItemFromRecord(record: Record<string, unknown>): GraphItem {
  const id = requiredString(record.id, 512) ?? '';
  const name = requiredString(record.name, 255) ?? '';
  const size = optionalByteCount(record.size);
  const file = recordValue(record.file);
  const hashes = recordValue(file?.hashes);
  if (!GRAPH_ITEM_ID.test(id) || !name || size === null) {
    throw new StorageAdapterError('provider_error', 'OneDrive item metadata is malformed', false);
  }
  return {
    id,
    name,
    size,
    eTag: requiredString(record.eTag, 1_024),
    cTag: requiredString(record.cTag, 1_024),
    lastModifiedDateTime: requiredString(record.lastModifiedDateTime, 128),
    hashes: {
      quickXorHash: requiredString(hashes?.quickXorHash, 256),
      sha1Hash: requiredString(hashes?.sha1Hash, 128),
      sha256Hash: requiredString(hashes?.sha256Hash, 128),
    },
    isFile: file !== null,
    downloadUrl: requiredString(record['@microsoft.graph.downloadUrl'], 8_192),
  };
}

function parseGraphItem(bytes: Uint8Array, maximumBytes: number): GraphItem {
  return graphItemFromRecord(parseJsonObject(bytes, maximumBytes, 'OneDrive'));
}

function nextExpectedOffset(bytes: Uint8Array, maximumBytes: number): number {
  const body = parseJsonObject(bytes, maximumBytes, 'OneDrive');
  const ranges = stringArray(body.nextExpectedRanges, 128);
  if (!ranges || ranges.length === 0) {
    throw new StorageAdapterError('provider_error', 'OneDrive upload status omitted nextExpectedRanges', false);
  }
  let minimum = Number.MAX_SAFE_INTEGER;
  for (const range of ranges) {
    const match = /^(\d+)(?:-\d*)?$/u.exec(range);
    const offset = match?.[1] ? Number(match[1]) : Number.NaN;
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new StorageAdapterError('provider_error', 'OneDrive returned an invalid expected range', false);
    }
    minimum = Math.min(minimum, offset);
  }
  return minimum;
}

function metadata(item: GraphItem, objectId: string): StorageObjectMetadata {
  return {
    objectId,
    dataClass: '',
    remoteRef: remoteRef(item.id),
    remoteVersion: item.eTag ?? item.cTag ?? item.lastModifiedDateTime,
    encryptedBytes: item.size,
    // eTag and cTag are revision tokens, and Graph hashes are not SHA-512.
    ciphertextHash: null,
  };
}

function remoteRef(itemId: string): string {
  return encodeOpaque('onedrive-ref', { v: 1, id: itemId });
}

function fileIdFromRemoteRef(value: string): string {
  const decoded = decodeOpaque(value, 'onedrive-ref', 2_048, 'OneDrive');
  const id = requiredString(decoded.id, 512) ?? '';
  if (decoded.v !== 1 || !GRAPH_ITEM_ID.test(id)) {
    throw new StorageAdapterError('provider_error', 'OneDrive remote reference is invalid', false);
  }
  return id;
}

function isSafeObjectId(value: string): boolean {
  try {
    assertSafeObjectId(value);
    return true;
  } catch {
    return false;
  }
}

function parseAllowedOrigin(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/'
      && !url.search && !url.hash) return url.origin;
  } catch {
    // Typed below.
  }
  throw new StorageAdapterError('provider_error', 'OneDrive upload-session origin is invalid', false);
}

function graphErrorText(response: HttpTransportResponse, maximumBytes: number): string {
  try {
    return JSON.stringify(parseJsonObject(response.body, maximumBytes, 'OneDrive')).toLowerCase();
  } catch {
    return '';
  }
}

function throwOneDriveResponse(response: HttpTransportResponse, maximumBytes: number): never {
  if (response.status === 401) {
    throw new StorageAdapterError('auth_required', 'OneDrive authorization is required', false);
  }
  const detail = graphErrorText(response, maximumBytes);
  if (response.status === 403) {
    if (detail.includes('quota') || detail.includes('storage_limit')) {
      throw new StorageAdapterError('quota_exceeded', 'OneDrive storage quota was exceeded', false);
    }
    throw new StorageAdapterError('provider_error', 'OneDrive permission was refused', false);
  }
  if (response.status === 404) {
    throw new StorageAdapterError('not_found', 'OneDrive object was not found', false);
  }
  if (response.status === 408 || response.status === 425) {
    throw new StorageAdapterError('unreachable', 'OneDrive request could not complete', true);
  }
  if (response.status === 409 || response.status === 412 || response.status === 416) {
    throw new StorageAdapterError('conflict', 'OneDrive object changed concurrently', false);
  }
  if (response.status === 413 || response.status === 507) {
    throw new StorageAdapterError('quota_exceeded', 'OneDrive storage quota was exceeded', false);
  }
  if (response.status === 429) throw rateLimitedError('OneDrive', response);
  if (response.status >= 500) {
    throw new StorageAdapterError('provider_error', 'OneDrive returned a server error', true);
  }
  throw new StorageAdapterError('provider_error', 'OneDrive returned an unexpected status', false);
}
