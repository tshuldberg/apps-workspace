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
  StorageWriteResult,
} from '../types';
import { StorageAdapterError } from '../types';
import type {
  CredentialProvider,
  HttpTransport,
  HttpTransportResponse,
  StorageCredentialOperation,
} from './http';
import {
  assertSafeObjectId,
  bytesToBase64,
  containsControlCharacter,
  decodeBoundedText,
  equalBytes,
  isPrivateOrLocalHost,
  requestWithSingleOriginRedirect,
  responseHeader,
  throwForHttpStatus,
  xmlElementBlocks,
  xmlElementText,
} from './http';

export interface WebdavCredentials {
  username: string;
  password: string;
}

export interface WebdavAdapterOptions {
  baseUrl: string;
  appRoot?: string;
  transport: HttpTransport;
  credentialProvider: CredentialProvider<WebdavCredentials>;
  allowInsecureLocalNetwork?: boolean;
  maximumObjectBytes?: number;
  pageSize?: number;
  maximumResponseBytes?: number;
  now?: () => string;
}

export type WebDAVCredentials = WebdavCredentials;
export type WebDAVAdapterOptions = WebdavAdapterOptions;

const DEFAULT_MAXIMUM_OBJECT_BYTES = 512 * 1024 * 1024;
const DEFAULT_MAXIMUM_RESPONSE_BYTES = 4 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_APP_ROOT = 'Meerkat';
const MAXIMUM_LIST_ENTRIES = 10_000;
const encoder = new TextEncoder();

interface WebdavListItem {
  objectId: string;
  metadata: StorageObjectMetadata;
}

export class WebdavStorageAdapter implements StorageDestinationAdapter {
  private readonly transport: HttpTransport;
  private readonly credentialProvider: CredentialProvider<WebdavCredentials>;
  private readonly baseUrl: URL;
  private readonly collectionUrl: URL;
  private readonly maximumObjectBytes: number;
  private readonly maximumResponseBytes: number;
  private readonly pageSize: number;
  private readonly now: () => string;
  private authorized = false;
  private revoked = false;
  private collectionReady = false;
  private verifiedReadWrite = false;

  constructor(options: WebdavAdapterOptions) {
    this.transport = options.transport;
    this.credentialProvider = options.credentialProvider;
    this.maximumObjectBytes = positiveSafeInteger(
      options.maximumObjectBytes ?? DEFAULT_MAXIMUM_OBJECT_BYTES,
      'maximumObjectBytes',
    );
    this.maximumResponseBytes = positiveSafeInteger(
      options.maximumResponseBytes ?? DEFAULT_MAXIMUM_RESPONSE_BYTES,
      'maximumResponseBytes',
    );
    this.pageSize = positiveSafeInteger(options.pageSize ?? DEFAULT_PAGE_SIZE, 'pageSize');
    this.now = options.now ?? (() => new Date().toISOString());

    this.baseUrl = parseWebdavBaseUrl(options.baseUrl, options.allowInsecureLocalNetwork === true);
    const appRoot = options.appRoot ?? DEFAULT_APP_ROOT;
    assertSafeObjectId(appRoot);
    const basePath = this.baseUrl.pathname.endsWith('/')
      ? this.baseUrl.pathname
      : `${this.baseUrl.pathname}/`;
    this.baseUrl.pathname = basePath;
    this.collectionUrl = new URL(`${encodeURIComponent(appRoot)}/`, this.baseUrl);
  }

  async authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult> {
    if (this.revoked && input.kind !== 'interactive') {
      return {
        kind: 'revoked',
        ...(input.accountHint === undefined ? {} : { accountHint: input.accountHint }),
        credentialRef: input.credentialRef,
      };
    }
    const credentials = await this.readCredentialsForAuthorization();
    if (credentials === null) {
      return {
        kind: 'authorization_required',
        ...(input.accountHint === undefined ? {} : { accountHint: input.accountHint }),
        ...(input.credentialRef === undefined ? {} : { credentialRef: input.credentialRef }),
      };
    }
    this.authorized = true;
    this.revoked = false;
    return {
      kind: 'authorized',
      ...(input.accountHint === undefined ? {} : { accountHint: input.accountHint }),
      ...(input.credentialRef === undefined ? {} : { credentialRef: input.credentialRef }),
    };
  }

  async revoke(options: { deleteRemoteData: boolean }): Promise<void> {
    if (options.deleteRemoteData && this.authorized) {
      const refs: StorageObjectRef[] = [];
      let cursor: string | undefined;
      do {
        const page = await this.listObjects(cursor);
        refs.push(...page.items.map((item) => ({ objectId: item.objectId, remoteRef: item.remoteRef })));
        cursor = page.nextCursor ?? undefined;
      } while (cursor !== undefined);
      for (const ref of refs) await this.deleteObject(ref);
    }
    this.authorized = false;
    this.revoked = true;
    this.collectionReady = false;
    this.verifiedReadWrite = false;
  }

  async capabilities(): Promise<StorageCapabilities> {
    return {
      backgroundWrite: true,
      resumableUpload: false,
      list: true,
      delete: true,
      quota: true,
      serverChecksum: false,
      maximumObjectBytes: this.maximumObjectBytes,
    };
  }

  async health(): Promise<StorageHealth> {
    if (this.revoked) return this.healthResult('revoked', false, 'revoked');
    if (!this.authorized) return this.healthResult('auth_required', false, 'auth_required');
    try {
      await this.probeCapabilities();
      return this.healthResult('ok', this.verifiedReadWrite);
    } catch (error) {
      const normalized = normalizeWebdavError(error);
      if (normalized.code === 'auth_required') {
        return this.healthResult('auth_required', false, normalized.code);
      }
      if (normalized.code === 'revoked') {
        return this.healthResult('revoked', false, normalized.code);
      }
      if (normalized.code === 'unreachable') {
        return this.healthResult('unreachable', false, normalized.code);
      }
      return this.healthResult('degraded', false, normalized.code);
    }
  }

  async quota(): Promise<StorageQuota> {
    this.requireAuthorized();
    await this.ensureCollection();
    const response = await this.request('PROPFIND', this.collectionUrl.href, {
      Depth: '0',
      'Content-Type': 'application/xml; charset=utf-8',
    }, encoder.encode(quotaPropfindBody()), 'quota');
    if (response.status !== 207 && response.status !== 200) {
      throwForHttpStatus(response.status, 'WebDAV');
    }
    const xml = decodeBoundedText(response.body, this.maximumResponseBytes);
    const usedBytes = parseOptionalByteCount(xmlElementText(xml, 'quota-used-bytes'));
    const availableBytes = parseOptionalByteCount(xmlElementText(xml, 'quota-available-bytes'));
    const capBytes = usedBytes !== null && availableBytes !== null
      ? safeByteSum(usedBytes, availableBytes)
      : null;
    return { usedBytes, capBytes, estimated: false };
  }

  async putObject(
    input: EncryptedStorageObject,
    resume?: StorageResumeToken,
  ): Promise<StorageWriteResult> {
    this.requireAuthorized();
    this.validateInput(input);
    if (resume !== undefined) {
      throw new StorageAdapterError('conflict', 'WebDAV does not support resumable PUT tokens', false);
    }
    await this.ensureCollection();
    const remoteRef = this.objectUrl(input.objectId).href;
    const existing = await this.headObject({ objectId: input.objectId, remoteRef });
    if (existing !== null) {
      const existingBytes = await this.getObjectAtVersion(
        { objectId: input.objectId, remoteRef },
        existing.remoteVersion,
      );
      if (existingBytes === null) {
        throw new StorageAdapterError('conflict', 'WebDAV object changed during conflict inspection', false);
      }
      if (!equalBytes(existingBytes, input.ciphertext)) {
        throw new StorageAdapterError(
          'corrupt_ciphertext',
          'the same object id already contains different ciphertext',
          false,
        );
      }
      this.verifiedReadWrite = true;
      return verifiedReadBackResult(input, remoteRef, existing.remoteVersion);
    }

    const response = await this.request('PUT', remoteRef, {
      'Content-Type': 'application/octet-stream',
      'If-None-Match': '*',
      'X-Meerkat-Data-Class': safeMetadataValue(input.dataClass),
    }, input.ciphertext, 'write');
    if (response.status !== 200 && response.status !== 201 && response.status !== 204) {
      throwForHttpStatus(response.status, 'WebDAV');
    }

    const metadata = await this.headObject({ objectId: input.objectId, remoteRef });
    const readBack = await this.getObjectAtVersion(
      { objectId: input.objectId, remoteRef },
      metadata?.remoteVersion ?? null,
    );
    if (readBack === null) {
      return unverifiedWriteResult(input, remoteRef, metadata?.remoteVersion ?? null);
    }
    if (!equalBytes(readBack, input.ciphertext) || sha512Hex(readBack) !== input.ciphertextHash) {
      throw new StorageAdapterError('corrupt_ciphertext', 'WebDAV read-back did not match ciphertext', false);
    }
    this.verifiedReadWrite = true;
    return verifiedReadBackResult(input, remoteRef, metadata?.remoteVersion ?? null);
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null> {
    this.requireAuthorized();
    const remoteRef = this.resolveObjectRef(ref);
    const response = await this.request('HEAD', remoteRef, {}, undefined, 'read');
    if (response.status === 404) return null;
    if (response.status !== 200 && response.status !== 204) {
      throwForHttpStatus(response.status, 'WebDAV');
    }
    const encryptedBytes = parseRequiredByteCount(responseHeader(response.headers, 'content-length'));
    return {
      objectId: ref.objectId,
      dataClass: safeMetadataValue(responseHeader(response.headers, 'x-meerkat-data-class') ?? ''),
      remoteRef: this.objectUrl(ref.objectId).href,
      remoteVersion: normalizeEtag(responseHeader(response.headers, 'etag')),
      encryptedBytes,
      ciphertextHash: null,
    };
  }

  async getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null> {
    this.requireAuthorized();
    const remoteRef = this.resolveObjectRef(ref);
    const headers: Record<string, string> = {};
    if (range !== undefined) {
      validateRange(range);
      if (range.length === 0) return new Uint8Array(0);
      headers.Range = `bytes=${range.offset}-${range.offset + range.length - 1}`;
    }
    const response = await this.request('GET', remoteRef, headers, undefined, 'read');
    if (response.status === 404) return null;
    if (response.status !== 200 && !(range !== undefined && response.status === 206)) {
      throwForHttpStatus(response.status, 'WebDAV');
    }
    if (response.body.length > this.maximumObjectBytes) {
      throw new StorageAdapterError('provider_error', 'WebDAV object exceeds the configured limit', false);
    }
    if (range !== undefined && response.status === 200) {
      if (range.offset > response.body.length) {
        throw new StorageAdapterError('provider_error', 'WebDAV ignored an invalid byte range', false);
      }
      return response.body.slice(range.offset, range.offset + range.length);
    }
    if (range !== undefined && response.body.length > range.length) {
      throw new StorageAdapterError('provider_error', 'WebDAV returned more range bytes than requested', false);
    }
    return response.body.slice();
  }

  async listObjects(cursor?: string): Promise<StorageObjectPage> {
    this.requireAuthorized();
    await this.ensureCollection();
    const afterObjectId = parseWebdavCursor(cursor);
    const response = await this.request('PROPFIND', this.collectionUrl.href, {
      Depth: '1',
      'Content-Type': 'application/xml; charset=utf-8',
    }, encoder.encode(listPropfindBody()), 'list');
    if (response.status !== 207 && response.status !== 200) {
      throwForHttpStatus(response.status, 'WebDAV');
    }
    const xml = decodeBoundedText(response.body, this.maximumResponseBytes);
    const entries = this.parseList(xml)
      .filter((entry) => afterObjectId === null || entry.objectId.localeCompare(afterObjectId) > 0)
      .sort((left, right) => left.objectId.localeCompare(right.objectId));
    const page = entries.slice(0, this.pageSize);
    const last = page.at(-1);
    return {
      items: page.map((entry) => entry.metadata),
      nextCursor: entries.length > page.length && last !== undefined
        ? `webdav:${encodeURIComponent(last.objectId)}`
        : null,
    };
  }

  async deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult> {
    this.requireAuthorized();
    const remoteRef = this.resolveObjectRef(ref);
    const existing = await this.headObject({ objectId: ref.objectId, remoteRef });
    if (existing === null) return { deleted: false, remoteRef };
    const headers: Record<string, string> = {};
    if (existing.remoteVersion !== null) headers['If-Match'] = existing.remoteVersion;
    const response = await this.request('DELETE', remoteRef, headers, undefined, 'delete');
    if (response.status === 404) return { deleted: false, remoteRef };
    if (response.status !== 200 && response.status !== 202 && response.status !== 204) {
      throwForHttpStatus(response.status, 'WebDAV');
    }
    return { deleted: true, remoteRef };
  }

  private async probeCapabilities(): Promise<void> {
    const optionsResponse = await this.request('OPTIONS', this.baseUrl.href, {}, undefined, 'health');
    if (optionsResponse.status !== 200 && optionsResponse.status !== 204) {
      throwForHttpStatus(optionsResponse.status, 'WebDAV');
    }
    await this.ensureCollection();
    const propfindResponse = await this.request('PROPFIND', this.collectionUrl.href, {
      Depth: '0',
      'Content-Type': 'application/xml; charset=utf-8',
    }, encoder.encode(capabilityPropfindBody()), 'health');
    if (propfindResponse.status !== 207 && propfindResponse.status !== 200) {
      throwForHttpStatus(propfindResponse.status, 'WebDAV');
    }
    decodeBoundedText(propfindResponse.body, this.maximumResponseBytes);
  }

  private async getObjectAtVersion(
    ref: StorageObjectRef,
    remoteVersion: string | null,
  ): Promise<Uint8Array | null> {
    const remoteRef = this.resolveObjectRef(ref);
    const headers: Record<string, string> = {};
    if (remoteVersion !== null && !remoteVersion.startsWith('W/')) {
      headers['If-Match'] = remoteVersion;
    }
    const response = await this.request('GET', remoteRef, headers, undefined, 'read');
    if (response.status === 404) return null;
    if (response.status !== 200) throwForHttpStatus(response.status, 'WebDAV');
    if (response.body.length > this.maximumObjectBytes) {
      throw new StorageAdapterError('provider_error', 'WebDAV object exceeds the configured limit', false);
    }
    return response.body.slice();
  }

  private async ensureCollection(): Promise<void> {
    if (this.collectionReady) return;
    const response = await this.request('MKCOL', this.collectionUrl.href, {}, undefined, 'write');
    if (response.status !== 201 && response.status !== 405) {
      throwForHttpStatus(response.status, 'WebDAV');
    }
    this.collectionReady = true;
  }

  private async request(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: Uint8Array,
    operation: StorageCredentialOperation = 'health',
  ): Promise<HttpTransportResponse> {
    this.requireAuthorized();
    const result = await requestWithSingleOriginRedirect(
      this.transport,
      url,
      async (requestUrl) => ({
        method,
        url: requestUrl,
        headers: {
          Authorization: await this.authorizationHeader(operation),
          Accept: '*/*',
          ...headers,
        },
        ...(body === undefined ? {} : { body }),
      }),
    );
    return result.response;
  }

  private async authorizationHeader(operation: StorageCredentialOperation): Promise<string> {
    let credentials: WebdavCredentials | null;
    try {
      credentials = await this.credentialProvider.get(operation);
    } catch {
      throw new StorageAdapterError('auth_required', 'WebDAV credentials are unavailable', false);
    }
    if (!validWebdavCredentials(credentials)) {
      throw new StorageAdapterError('auth_required', 'WebDAV credentials are unavailable', false);
    }
    const bytes = encoder.encode(`${credentials.username}:${credentials.password}`);
    const encoded = bytesToBase64(bytes);
    bytes.fill(0);
    return `Basic ${encoded}`;
  }

  private async readCredentialsForAuthorization(): Promise<WebdavCredentials | null> {
    try {
      const credentials = await this.credentialProvider.get('health');
      return validWebdavCredentials(credentials) ? credentials : null;
    } catch {
      return null;
    }
  }

  private objectUrl(objectId: string): URL {
    assertSafeObjectId(objectId);
    return new URL(encodeURIComponent(objectId), this.collectionUrl);
  }

  private resolveObjectRef(ref: StorageObjectRef): string {
    const expected = this.objectUrl(ref.objectId);
    if (ref.remoteRef === undefined) return expected.href;
    let supplied: URL;
    try {
      supplied = new URL(ref.remoteRef);
    } catch {
      throw new StorageAdapterError('provider_error', 'WebDAV remote reference is invalid', false);
    }
    if (
      supplied.href !== expected.href
      || supplied.origin !== this.collectionUrl.origin
      || supplied.username !== ''
      || supplied.password !== ''
      || supplied.search !== ''
      || supplied.hash !== ''
    ) {
      throw new StorageAdapterError('provider_error', 'WebDAV remote reference escaped the app root', false);
    }
    return supplied.href;
  }

  private parseList(xml: string): WebdavListItem[] {
    const blocks = xmlElementBlocks(xml, 'response');
    if (blocks.length > MAXIMUM_LIST_ENTRIES + 1) {
      throw new StorageAdapterError('provider_error', 'WebDAV listing exceeded the safety limit', false);
    }
    const entries: WebdavListItem[] = [];
    for (const block of blocks) {
      const href = xmlElementText(block, 'href');
      if (href === null) continue;
      let url: URL;
      try {
        url = new URL(href, this.collectionUrl);
      } catch {
        throw new StorageAdapterError('provider_error', 'WebDAV listing contained an invalid reference', false);
      }
      if (normalizeCollectionHref(url.href) === normalizeCollectionHref(this.collectionUrl.href)) continue;
      const objectId = this.objectIdFromListUrl(url);
      const encryptedBytes = parseRequiredByteCount(xmlElementText(block, 'getcontentlength'));
      entries.push({
        objectId,
        metadata: {
          objectId,
          dataClass: safeMetadataValue(xmlElementText(block, 'data-class') ?? ''),
          remoteRef: this.objectUrl(objectId).href,
          remoteVersion: normalizeEtag(xmlElementText(block, 'getetag')),
          encryptedBytes,
          ciphertextHash: null,
        },
      });
    }
    return entries;
  }

  private objectIdFromListUrl(url: URL): string {
    if (
      url.origin !== this.collectionUrl.origin
      || url.username !== ''
      || url.password !== ''
      || url.search !== ''
      || url.hash !== ''
      || !url.pathname.startsWith(this.collectionUrl.pathname)
    ) {
      throw new StorageAdapterError('provider_error', 'WebDAV listing escaped the app root', false);
    }
    const suffix = url.pathname.slice(this.collectionUrl.pathname.length);
    if (suffix.length === 0 || suffix.includes('/')) {
      throw new StorageAdapterError('provider_error', 'WebDAV listing contained a nested path', false);
    }
    let objectId: string;
    try {
      objectId = decodeURIComponent(suffix);
    } catch {
      throw new StorageAdapterError('provider_error', 'WebDAV listing contained an invalid object id', false);
    }
    assertSafeObjectId(objectId);
    if (this.objectUrl(objectId).pathname !== url.pathname) {
      throw new StorageAdapterError('provider_error', 'WebDAV listing contained a non-canonical object path', false);
    }
    return objectId;
  }

  private validateInput(input: EncryptedStorageObject): void {
    assertSafeObjectId(input.objectId);
    if (
      !Number.isSafeInteger(input.encryptedBytes)
      || input.encryptedBytes < 0
      || input.encryptedBytes !== input.ciphertext.length
    ) {
      throw new StorageAdapterError('corrupt_ciphertext', 'ciphertext length is invalid', false);
    }
    if (input.encryptedBytes > this.maximumObjectBytes) {
      throw new StorageAdapterError('quota_exceeded', 'ciphertext exceeds the WebDAV object limit', false);
    }
    if (sha512Hex(input.ciphertext) !== input.ciphertextHash) {
      throw new StorageAdapterError('corrupt_ciphertext', 'ciphertext SHA-512 does not match bytes', false);
    }
  }

  private requireAuthorized(): void {
    if (!this.authorized) {
      throw new StorageAdapterError('auth_required', 'WebDAV authorization is required', false);
    }
  }

  private healthResult(
    state: StorageHealth['state'],
    verifiedReadWrite: boolean,
    errorCode?: string,
  ): StorageHealth {
    return {
      state,
      verifiedReadWrite,
      checkedAt: this.now(),
      ...(errorCode === undefined ? {} : { errorCode }),
    };
  }
}

export { WebdavStorageAdapter as WebDAVStorageAdapter };

function parseWebdavBaseUrl(value: string, allowInsecureLocalNetwork: boolean): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StorageAdapterError('provider_error', 'WebDAV base URL is invalid', false);
  }
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new StorageAdapterError('provider_error', 'WebDAV base URL contains unsupported components', false);
  }
  if (url.protocol !== 'https:') {
    if (
      url.protocol !== 'http:'
      || !allowInsecureLocalNetwork
      || !isPrivateOrLocalHost(url.hostname)
    ) {
      throw new StorageAdapterError('provider_error', 'WebDAV requires HTTPS outside a private network', false);
    }
  }
  return url;
}

function positiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new StorageAdapterError('provider_error', `${label} must be a positive safe integer`, false);
  }
  return value;
}

function validateRange(range: StorageByteRange): void {
  if (
    !Number.isSafeInteger(range.offset)
    || range.offset < 0
    || !Number.isSafeInteger(range.length)
    || range.length < 0
    || !Number.isSafeInteger(range.offset + range.length)
  ) {
    throw new StorageAdapterError('provider_error', 'byte range is invalid', false);
  }
}

function parseRequiredByteCount(value: string | null): number {
  const parsed = parseOptionalByteCount(value);
  if (parsed === null) {
    throw new StorageAdapterError('provider_error', 'WebDAV response omitted a valid byte count', false);
  }
  return parsed;
}

function parseOptionalByteCount(value: string | null): number | null {
  if (value === null || !/^[0-9]+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function safeByteSum(left: number, right: number): number | null {
  const total = left + right;
  return Number.isSafeInteger(total) ? total : null;
}

function normalizeEtag(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.length > 512 || containsControlCharacter(trimmed)
    ? null
    : trimmed;
}

function parseWebdavCursor(cursor: string | undefined): string | null {
  if (cursor === undefined) return null;
  if (!cursor.startsWith('webdav:') || cursor.length > 512) {
    throw new StorageAdapterError('provider_error', 'WebDAV list cursor is invalid', false);
  }
  let objectId: string;
  try {
    objectId = decodeURIComponent(cursor.slice('webdav:'.length));
  } catch {
    throw new StorageAdapterError('provider_error', 'WebDAV list cursor is invalid', false);
  }
  assertSafeObjectId(objectId);
  return objectId;
}

function safeMetadataValue(value: string): string {
  return /^[A-Za-z0-9._-]{1,100}$/.test(value) ? value : 'encrypted_object';
}

function validWebdavCredentials(value: unknown): value is WebdavCredentials {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.username === 'string'
    && candidate.username.length > 0
    && candidate.username.length <= 1_024
    && !candidate.username.includes(':')
    && typeof candidate.password === 'string'
    && candidate.password.length <= 8_192;
}

function normalizeCollectionHref(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function normalizeWebdavError(error: unknown): StorageAdapterError {
  return error instanceof StorageAdapterError
    ? error
    : new StorageAdapterError('provider_error', 'WebDAV operation failed', false);
}

function verifiedReadBackResult(
  input: EncryptedStorageObject,
  remoteRef: string,
  remoteVersion: string | null,
): StorageWriteResult {
  return {
    complete: true,
    verified: true,
    verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash },
    remoteRef,
    remoteVersion,
    encryptedBytes: input.encryptedBytes,
    ciphertextHash: input.ciphertextHash,
  };
}

function unverifiedWriteResult(
  input: EncryptedStorageObject,
  remoteRef: string,
  remoteVersion: string | null,
): StorageWriteResult {
  return {
    complete: true,
    verified: false,
    verification: { kind: 'none' },
    remoteRef,
    remoteVersion,
    encryptedBytes: input.encryptedBytes,
    ciphertextHash: input.ciphertextHash,
  };
}

function capabilityPropfindBody(): string {
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getetag/>'
    + '<d:quota-used-bytes/><d:quota-available-bytes/></d:prop></d:propfind>';
}

function quotaPropfindBody(): string {
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<d:propfind xmlns:d="DAV:"><d:prop><d:quota-used-bytes/>'
    + '<d:quota-available-bytes/></d:prop></d:propfind>';
}

function listPropfindBody(): string {
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<d:propfind xmlns:d="DAV:" xmlns:m="urn:mylife:storage">'
    + '<d:prop><d:resourcetype/><d:getcontentlength/><d:getetag/>'
    + '<m:data-class/></d:prop></d:propfind>';
}
