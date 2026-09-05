import { md5Hex } from '../../encryption/md5';
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
import type { HttpTransport, HttpTransportResponse } from './http';
import {
  assertSafeObjectId,
  callHttpTransport,
  decodeBoundedText,
  equalBytes,
  responseHeader,
} from './http';

export type AccessTokenOperation = 'health' | 'quota' | 'read' | 'write' | 'list' | 'delete';

export interface AccessTokenProvider {
  getAccessToken(operation: AccessTokenOperation): Promise<string | null>;
  invalidateAccessToken?(token: string): void | Promise<void>;
  revoke?(): Promise<void>;
}

export interface GoogleDriveAdapterOptions {
  transport: HttpTransport;
  accessTokenProvider: AccessTokenProvider;
  credentialRef: string;
  apiBaseUrl?: string;
  uploadBaseUrl?: string;
  rootFolderName?: string;
  maximumObjectBytes?: number;
  uploadChunkBytes?: number;
  pageSize?: number;
  maximumResponseBytes?: number;
  verificationRangeBytes?: number;
  now?: () => string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string | null;
  parents: string[];
  size: number;
  version: string | null;
  modifiedTime: string | null;
  md5Checksum: string | null;
  sha256Checksum: string | null;
  appProperties: Record<string, string>;
}

interface DriveFilePage {
  files: DriveFile[];
  nextPageToken: string | null;
}

const DEFAULT_API_BASE = 'https://www.googleapis.com/drive/v3/';
const DEFAULT_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/';
const DEFAULT_ROOT_NAME = 'Meerkat';
const DEFAULT_MAXIMUM_OBJECT_BYTES = 512 * 1024 * 1024;
const DEFAULT_UPLOAD_CHUNK_BYTES = 5 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAXIMUM_RESPONSE_BYTES = 4 * 1024 * 1024;
const DEFAULT_VERIFICATION_RANGE_BYTES = 1024 * 1024;
const MAX_PAGE_SIZE = 1_000;
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{1,256}$/u;
const SHA512_HEX = /^[a-f0-9]{128}$/u;
const CHECKSUM_HEX = /^[a-f0-9]+$/u;
const encoder = new TextEncoder();

export class GoogleDriveStorageAdapter implements StorageDestinationAdapter {
  private readonly transport: HttpTransport;
  private readonly accessTokenProvider: AccessTokenProvider;
  private readonly credentialRef: string;
  private readonly apiBase: URL;
  private readonly uploadBase: URL;
  private readonly rootFolderName: string;
  private readonly maximumObjectBytes: number;
  private readonly uploadChunkBytes: number;
  private readonly pageSize: number;
  private readonly maximumResponseBytes: number;
  private readonly verificationRangeBytes: number;
  private readonly now: () => string;
  private authorized = false;
  private revoked = false;
  private verifiedReadWrite = false;
  private rootFolderId: string | null = null;

  constructor(options: GoogleDriveAdapterOptions) {
    this.transport = options.transport;
    this.accessTokenProvider = options.accessTokenProvider;
    this.credentialRef = validateCredentialRef(options.credentialRef);
    this.apiBase = parseHttpsBase(options.apiBaseUrl ?? DEFAULT_API_BASE, 'Drive API base URL');
    this.uploadBase = parseHttpsBase(options.uploadBaseUrl ?? DEFAULT_UPLOAD_BASE, 'Drive upload base URL');
    this.rootFolderName = options.rootFolderName ?? DEFAULT_ROOT_NAME;
    assertSafeObjectId(this.rootFolderName);
    this.maximumObjectBytes = positiveInteger(
      options.maximumObjectBytes ?? DEFAULT_MAXIMUM_OBJECT_BYTES,
      'maximumObjectBytes',
    );
    this.uploadChunkBytes = positiveInteger(
      options.uploadChunkBytes ?? DEFAULT_UPLOAD_CHUNK_BYTES,
      'uploadChunkBytes',
    );
    if (this.uploadChunkBytes % (256 * 1024) !== 0 && options.uploadChunkBytes !== undefined) {
      throw new StorageAdapterError('provider_error', 'Drive upload chunks must be 256 KiB aligned', false);
    }
    this.pageSize = positiveInteger(options.pageSize ?? DEFAULT_PAGE_SIZE, 'pageSize');
    if (this.pageSize > MAX_PAGE_SIZE) {
      throw new StorageAdapterError('provider_error', 'Drive page size exceeds the provider limit', false);
    }
    this.maximumResponseBytes = positiveInteger(
      options.maximumResponseBytes ?? DEFAULT_MAXIMUM_RESPONSE_BYTES,
      'maximumResponseBytes',
    );
    this.verificationRangeBytes = positiveInteger(
      options.verificationRangeBytes ?? DEFAULT_VERIFICATION_RANGE_BYTES,
      'verificationRangeBytes',
    );
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult> {
    if (this.revoked && input.kind !== 'interactive') {
      return {
        kind: 'revoked',
        credentialRef: input.credentialRef,
        ...(input.accountHint ? { accountHint: input.accountHint } : {}),
      };
    }
    const token = await this.readAccessToken('health');
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
      const refs: StorageObjectRef[] = [];
      let cursor: string | undefined;
      do {
        const page = await this.listObjects(cursor);
        refs.push(...page.items.map((item) => ({ objectId: item.objectId, remoteRef: item.remoteRef })));
        cursor = page.nextCursor ?? undefined;
      } while (cursor !== undefined);
      for (const ref of refs) await this.deleteObject(ref);
    }
    try {
      await this.accessTokenProvider.revoke?.();
    } finally {
      this.authorized = false;
      this.revoked = true;
      this.verifiedReadWrite = false;
      this.rootFolderId = null;
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
    if (this.revoked) return this.healthResult('revoked', false, 'revoked');
    if (!this.authorized) return this.healthResult('auth_required', false, 'auth_required');
    try {
      const url = this.apiUrl('about');
      url.searchParams.set('fields', 'user,storageQuota');
      const response = await this.request('health', 'GET', url.href, {});
      if (response.status !== 200) throwDriveResponse(response, this.maximumResponseBytes);
      parseJsonObject(response.body, this.maximumResponseBytes);
      await this.ensureRootFolder();
      return this.healthResult('ok', this.verifiedReadWrite);
    } catch (error) {
      const normalized = normalizeDriveError(error);
      if (normalized.code === 'auth_required') {
        this.authorized = false;
        return this.healthResult('auth_required', false, normalized.code);
      }
      if (normalized.code === 'unreachable') return this.healthResult('unreachable', false, normalized.code);
      return this.healthResult('degraded', false, normalized.code);
    }
  }

  async quota(): Promise<StorageQuota> {
    this.requireAuthorized();
    const url = this.apiUrl('about');
    url.searchParams.set('fields', 'storageQuota');
    const response = await this.request('quota', 'GET', url.href, {});
    if (response.status !== 200) throwDriveResponse(response, this.maximumResponseBytes);
    const root = parseJsonObject(response.body, this.maximumResponseBytes);
    const quota = recordValue(root.storageQuota);
    if (!quota) return { usedBytes: null, capBytes: null, estimated: true };
    return {
      usedBytes: optionalByteCount(quota.usage),
      capBytes: optionalByteCount(quota.limit),
      estimated: false,
    };
  }

  async putObject(input: EncryptedStorageObject, resume?: StorageResumeToken): Promise<StorageWriteResult> {
    this.requireAuthorized();
    validateObject(input, this.maximumObjectBytes);
    const rootId = await this.ensureRootFolder();
    if (!resume) {
      const existing = await this.findObject(input.objectId, rootId);
      if (existing) return this.resolveExistingObject(input, existing);
    }

    let sessionUrl: string;
    let offset: number;
    if (resume) {
      sessionUrl = this.validateSessionUrl(resume.providerSession);
      offset = resume.offset;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset >= input.encryptedBytes) {
        throw new StorageAdapterError('conflict', 'Drive resume offset is invalid', false);
      }
      let status: HttpTransportResponse;
      try {
        status = await this.request('write', 'PUT', sessionUrl, {
          'Content-Length': '0',
          'Content-Range': `bytes */${input.encryptedBytes}`,
        }, new Uint8Array(0));
      } catch (error) {
        const normalized = normalizeDriveError(error);
        if (normalized.retryable) return incompleteWrite(input, sessionUrl, offset);
        throw normalized;
      }
      if (status.status === 200 || status.status === 201) {
        return this.completedWrite(input, parseDriveFile(status.body, this.maximumResponseBytes));
      }
      if (status.status !== 308) throwDriveResponse(status, this.maximumResponseBytes);
      const providerOffset = resumeStatusOffset(status);
      if (providerOffset < offset || providerOffset >= input.encryptedBytes) {
        throw new StorageAdapterError('conflict', 'Drive resumable upload status regressed or overflowed', false);
      }
      offset = providerOffset;
    } else {
      sessionUrl = await this.startResumableUpload(input, rootId);
      offset = 0;
    }

    const end = Math.min(input.encryptedBytes, offset + this.uploadChunkBytes);
    let response: HttpTransportResponse;
    try {
      response = await this.request('write', 'PUT', sessionUrl, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(end - offset),
        'Content-Range': `bytes ${offset}-${end - 1}/${input.encryptedBytes}`,
      }, input.ciphertext.slice(offset, end));
    } catch (error) {
      const normalized = normalizeDriveError(error);
      if (normalized.retryable) return incompleteWrite(input, sessionUrl, offset);
      throw normalized;
    }

    if (response.status === 308) {
      const nextOffset = nextResumeOffset(response, offset);
      if (nextOffset <= offset || nextOffset >= input.encryptedBytes) {
        throw new StorageAdapterError('provider_error', 'Drive resumable upload did not make valid progress', true);
      }
      return incompleteWrite(input, sessionUrl, nextOffset);
    }
    if (response.status !== 200 && response.status !== 201) {
      throwDriveResponse(response, this.maximumResponseBytes);
    }
    return this.completedWrite(input, parseDriveFile(response.body, this.maximumResponseBytes));
  }

  private async completedWrite(input: EncryptedStorageObject, completed: DriveFile): Promise<StorageWriteResult> {
    const evidence = await this.verifyCompletedUpload(input, completed.id);
    this.verifiedReadWrite = evidence.kind !== 'none';
    const completedResult = {
      remoteRef: remoteRef(completed.id),
      remoteVersion: completed.version,
      encryptedBytes: input.encryptedBytes,
      ciphertextHash: input.ciphertextHash,
    };
    return evidence.kind === 'none'
      ? { ...completedResult, complete: true, verified: false, verification: evidence }
      : { ...completedResult, complete: true, verified: true, verification: evidence };
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null> {
    this.requireAuthorized();
    assertSafeObjectId(ref.objectId);
    const file = await this.resolveFile(ref);
    return file ? metadata(file, ref.objectId) : null;
  }

  async getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null> {
    this.requireAuthorized();
    assertSafeObjectId(ref.objectId);
    if (range) validateRange(range);
    const file = await this.resolveFile(ref);
    if (!file) return null;
    return this.getFileBytes(file.id, range);
  }

  async listObjects(cursor?: string): Promise<StorageObjectPage> {
    this.requireAuthorized();
    const rootId = await this.ensureRootFolder();
    const pageToken = decodeCursor(cursor);
    const url = this.apiUrl('files');
    url.searchParams.set(
      'q',
      `'${escapeDriveQuery(rootId)}' in parents and trashed = false and appProperties has { key='meerkatManaged' and value='1' }`,
    );
    url.searchParams.set('spaces', 'drive');
    url.searchParams.set('pageSize', String(this.pageSize));
    url.searchParams.set('fields', `nextPageToken,files(${FILE_FIELDS})`);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await this.request('list', 'GET', url.href, {});
    if (response.status !== 200) throwDriveResponse(response, this.maximumResponseBytes);
    const page = parseDriveFilePage(response.body, this.maximumResponseBytes);
    const items: StorageObjectMetadata[] = [];
    for (const file of page.files) {
      const objectId = file.appProperties.meerkatObjectId;
      if (!objectId) continue;
      assertSafeObjectId(objectId);
      items.push(metadata(file, objectId));
    }
    items.sort((left, right) => left.objectId.localeCompare(right.objectId));
    return {
      items,
      nextCursor: page.nextPageToken ? encodeCursor(page.nextPageToken) : null,
    };
  }

  async deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult> {
    this.requireAuthorized();
    assertSafeObjectId(ref.objectId);
    const file = await this.resolveFile(ref);
    if (!file) return { deleted: false, remoteRef: null };
    const url = this.apiUrl(`files/${encodeURIComponent(file.id)}`);
    const response = await this.request('delete', 'DELETE', url.href, {});
    if (response.status === 404) return { deleted: false, remoteRef: remoteRef(file.id) };
    if (response.status !== 200 && response.status !== 204) {
      throwDriveResponse(response, this.maximumResponseBytes);
    }
    return { deleted: true, remoteRef: remoteRef(file.id) };
  }

  private async request(
    operation: AccessTokenOperation,
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: Uint8Array,
  ): Promise<HttpTransportResponse> {
    let token = await this.requireAccessToken(operation);
    let response = await callHttpTransport(this.transport, {
      method,
      url,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...headers },
      ...(body ? { body } : {}),
    });
    if (response.status !== 401) return response;
    await this.accessTokenProvider.invalidateAccessToken?.(token);
    token = await this.requireAccessToken(operation);
    response = await callHttpTransport(this.transport, {
      method,
      url,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...headers },
      ...(body ? { body } : {}),
    });
    if (response.status === 401) {
      this.authorized = false;
      throw new StorageAdapterError('auth_required', 'Google Drive authorization is required', false);
    }
    return response;
  }

  private async readAccessToken(operation: AccessTokenOperation): Promise<string | null> {
    try {
      const token = await this.accessTokenProvider.getAccessToken(operation);
      return typeof token === 'string' && token.trim() ? token : null;
    } catch (error) {
      const code = errorCode(error);
      if (code === 'auth_required' || code === 'vault_not_found') return null;
      throw new StorageAdapterError(
        'provider_error',
        'access-token source is unavailable',
        errorRetryable(error) ?? true,
      );
    }
  }

  private async requireAccessToken(operation: AccessTokenOperation): Promise<string> {
    const token = await this.readAccessToken(operation);
    if (!token) {
      this.authorized = false;
      throw new StorageAdapterError('auth_required', 'Google Drive authorization is required', false);
    }
    return token;
  }

  private async ensureRootFolder(): Promise<string> {
    if (this.rootFolderId) return this.rootFolderId;
    const url = this.apiUrl('files');
    url.searchParams.set(
      'q',
      `mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false and appProperties has { key='meerkatRoot' and value='1' }`,
    );
    url.searchParams.set('spaces', 'drive');
    url.searchParams.set('pageSize', '2');
    url.searchParams.set('fields', `files(${FILE_FIELDS})`);
    const listed = await this.request('list', 'GET', url.href, {});
    if (listed.status !== 200) throwDriveResponse(listed, this.maximumResponseBytes);
    const page = parseDriveFilePage(listed.body, this.maximumResponseBytes);
    if (page.files.length > 1 || page.nextPageToken) {
      throw new StorageAdapterError('conflict', 'multiple Meerkat Drive roots were found', false);
    }
    const existing = page.files[0];
    if (existing) {
      this.rootFolderId = existing.id;
      return existing.id;
    }
    const createUrl = this.apiUrl('files');
    createUrl.searchParams.set('fields', FILE_FIELDS);
    const created = await this.request('write', 'POST', createUrl.href, {
      'Content-Type': 'application/json; charset=utf-8',
    }, jsonBytes({
      name: this.rootFolderName,
      mimeType: DRIVE_FOLDER_MIME,
      appProperties: { meerkatRoot: '1' },
    }));
    if (created.status !== 200 && created.status !== 201) {
      throwDriveResponse(created, this.maximumResponseBytes);
    }
    const folder = parseDriveFile(created.body, this.maximumResponseBytes);
    this.rootFolderId = folder.id;
    return folder.id;
  }

  private async findObject(objectId: string, rootId: string): Promise<DriveFile | null> {
    assertSafeObjectId(objectId);
    const url = this.apiUrl('files');
    url.searchParams.set(
      'q',
      `'${escapeDriveQuery(rootId)}' in parents and trashed = false and appProperties has { key='meerkatManaged' and value='1' } and appProperties has { key='meerkatObjectId' and value='${escapeDriveQuery(objectId)}' }`,
    );
    url.searchParams.set('spaces', 'drive');
    url.searchParams.set('pageSize', '2');
    url.searchParams.set('fields', `files(${FILE_FIELDS})`);
    const response = await this.request('list', 'GET', url.href, {});
    if (response.status !== 200) throwDriveResponse(response, this.maximumResponseBytes);
    const page = parseDriveFilePage(response.body, this.maximumResponseBytes);
    if (page.files.length > 1 || page.nextPageToken) {
      throw new StorageAdapterError('conflict', 'multiple Drive files map to one object id', false);
    }
    return page.files[0] ?? null;
  }

  private async resolveExistingObject(
    input: EncryptedStorageObject,
    existing: DriveFile,
  ): Promise<StorageWriteResult> {
    const advertisedHash = existing.appProperties.ciphertextHash;
    if (!advertisedHash || advertisedHash !== input.ciphertextHash) {
      throw new StorageAdapterError(
        'corrupt_ciphertext',
        'the same Drive object id is mapped to different ciphertext',
        false,
      );
    }
    const bytes = await this.getFileBytes(existing.id);
    if (!bytes || !equalBytes(bytes, input.ciphertext) || sha512Hex(bytes) !== input.ciphertextHash) {
      throw new StorageAdapterError('corrupt_ciphertext', 'Drive duplicate read-back did not match ciphertext', false);
    }
    this.verifiedReadWrite = true;
    return {
      complete: true,
      verified: true,
      verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash },
      remoteRef: remoteRef(existing.id),
      remoteVersion: existing.version,
      encryptedBytes: input.encryptedBytes,
      ciphertextHash: input.ciphertextHash,
    };
  }

  private async startResumableUpload(input: EncryptedStorageObject, rootId: string): Promise<string> {
    const url = this.uploadUrl('files');
    url.searchParams.set('uploadType', 'resumable');
    url.searchParams.set('fields', FILE_FIELDS);
    const response = await this.request('write', 'POST', url.href, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Upload-Content-Type': 'application/octet-stream',
      'X-Upload-Content-Length': String(input.encryptedBytes),
    }, jsonBytes({
      name: input.objectId,
      parents: [rootId],
      appProperties: {
        meerkatManaged: '1',
        meerkatObjectId: input.objectId,
        ciphertextHash: input.ciphertextHash,
        dataClass: input.dataClass,
      },
    }));
    if (response.status !== 200 && response.status !== 201) {
      throwDriveResponse(response, this.maximumResponseBytes);
    }
    const location = responseHeader(response.headers, 'location');
    if (!location) throw new StorageAdapterError('provider_error', 'Drive omitted the upload session URI', true);
    return this.validateSessionUrl(location);
  }

  private validateSessionUrl(value: string): string {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new StorageAdapterError('provider_error', 'Drive upload session URI is invalid', false);
    }
    if (url.protocol !== 'https:' || url.origin !== this.uploadBase.origin || url.username || url.password || url.hash) {
      throw new StorageAdapterError('provider_error', 'Drive upload session escaped the provider origin', false);
    }
    return url.href;
  }

  private async verifyCompletedUpload(
    input: EncryptedStorageObject,
    fileId: string,
  ): Promise<StorageVerificationEvidence> {
    const file = await this.getFileMetadata(fileId);
    if (!file
      || file.size !== input.encryptedBytes
      || file.appProperties.meerkatObjectId !== input.objectId
      || file.appProperties.ciphertextHash !== input.ciphertextHash) {
      throw new StorageAdapterError('corrupt_ciphertext', 'Drive upload metadata did not match ciphertext', false);
    }
    if (file.sha256Checksum) {
      const checksum = file.sha256Checksum.toLowerCase();
      if (!CHECKSUM_HEX.test(checksum) || checksum !== sha256Hex(input.ciphertext)) {
        throw new StorageAdapterError('corrupt_ciphertext', 'Drive SHA-256 checksum did not match ciphertext', false);
      }
      return { kind: 'provider_checksum', algorithm: 'sha256', value: checksum };
    }
    if (file.md5Checksum) {
      const checksum = file.md5Checksum.toLowerCase();
      if (!CHECKSUM_HEX.test(checksum) || checksum !== md5Hex(input.ciphertext)) {
        throw new StorageAdapterError('corrupt_ciphertext', 'Drive MD5 checksum did not match ciphertext', false);
      }
      return { kind: 'provider_checksum', algorithm: 'md5', value: checksum };
    }
    for (let offset = 0; offset < input.encryptedBytes; offset += this.verificationRangeBytes) {
      const length = Math.min(this.verificationRangeBytes, input.encryptedBytes - offset);
      const bytes = await this.getFileBytes(fileId, { offset, length });
      if (!bytes) return { kind: 'none' };
      if (!equalBytes(bytes, input.ciphertext.slice(offset, offset + length))) {
        throw new StorageAdapterError('corrupt_ciphertext', 'Drive ranged read-back did not match ciphertext', false);
      }
    }
    return { kind: 'read_back', ciphertextHash: input.ciphertextHash };
  }

  private async resolveFile(ref: StorageObjectRef): Promise<DriveFile | null> {
    const rootId = await this.ensureRootFolder();
    const file = ref.remoteRef
      ? await this.getFileMetadata(fileIdFromRemoteRef(ref.remoteRef))
      : await this.findObject(ref.objectId, rootId);
    if (!file) return null;
    if (file.appProperties.meerkatManaged !== '1'
      || file.appProperties.meerkatObjectId !== ref.objectId
      || !file.parents.includes(rootId)) {
      throw new StorageAdapterError(
        'corrupt_ciphertext',
        'Drive file reference is not bound to the expected Meerkat object',
        false,
      );
    }
    return file;
  }

  private async getFileMetadata(fileId: string): Promise<DriveFile | null> {
    if (!DRIVE_FILE_ID.test(fileId)) {
      throw new StorageAdapterError('provider_error', 'Drive file id is invalid', false);
    }
    const url = this.apiUrl(`files/${encodeURIComponent(fileId)}`);
    url.searchParams.set('fields', FILE_FIELDS);
    const response = await this.request('read', 'GET', url.href, {});
    if (response.status === 404) return null;
    if (response.status !== 200) throwDriveResponse(response, this.maximumResponseBytes);
    return parseDriveFile(response.body, this.maximumResponseBytes);
  }

  private async getFileBytes(fileId: string, range?: StorageByteRange): Promise<Uint8Array | null> {
    const url = this.apiUrl(`files/${encodeURIComponent(fileId)}`);
    url.searchParams.set('alt', 'media');
    const headers: Record<string, string> = {};
    if (range) {
      validateRange(range);
      if (range.length === 0) return new Uint8Array();
      headers.Range = `bytes=${range.offset}-${range.offset + range.length - 1}`;
    }
    const response = await this.request('read', 'GET', url.href, headers);
    if (response.status === 404) return null;
    if (response.status !== 200 && !(range && response.status === 206)) {
      throwDriveResponse(response, this.maximumResponseBytes);
    }
    if (response.body.byteLength > this.maximumObjectBytes) {
      throw new StorageAdapterError('provider_error', 'Drive object exceeded the configured limit', false);
    }
    if (range && response.status === 200) {
      return response.body.slice(range.offset, range.offset + range.length);
    }
    if (range && response.body.byteLength > range.length) {
      throw new StorageAdapterError('provider_error', 'Drive returned too many ranged bytes', false);
    }
    return response.body.slice();
  }

  private apiUrl(path: string): URL {
    return new URL(path, this.apiBase);
  }

  private uploadUrl(path: string): URL {
    return new URL(path, this.uploadBase);
  }

  private requireAuthorized(): void {
    if (!this.authorized) throw new StorageAdapterError('auth_required', 'Google Drive authorization is required', false);
  }

  private healthResult(
    state: StorageHealth['state'],
    verifiedReadWrite: boolean,
    errorCode?: string,
  ): StorageHealth {
    return { state, verifiedReadWrite, checkedAt: this.now(), ...(errorCode ? { errorCode } : {}) };
  }
}

const FILE_FIELDS = 'id,name,mimeType,parents,size,version,modifiedTime,md5Checksum,sha256Checksum,appProperties';

function validateCredentialRef(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 512 || /[\r\n\0]/u.test(normalized)) {
    throw new StorageAdapterError('auth_required', 'Drive credential reference is invalid', false);
  }
  return normalized;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new StorageAdapterError('provider_error', `${label} must be a positive safe integer`, false);
  }
  return value;
}

function parseHttpsBase(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StorageAdapterError('provider_error', `${label} is invalid`, false);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new StorageAdapterError('provider_error', `${label} must be a credential-free HTTPS URL`, false);
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseJsonObject(bytes: Uint8Array, maximumBytes: number): Record<string, unknown> {
  try {
    const parsed = JSON.parse(decodeBoundedText(bytes, maximumBytes)) as unknown;
    const record = recordValue(parsed);
    if (record) return record;
  } catch (error) {
    if (error instanceof StorageAdapterError) throw error;
  }
  throw new StorageAdapterError('provider_error', 'Drive returned malformed JSON', false);
}

function optionalByteCount(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function stringRecord(value: unknown): Record<string, string> {
  const record = recordValue(value);
  if (!record) return {};
  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === 'string') output[key] = item;
  }
  return output;
}

function driveFileFromRecord(record: Record<string, unknown>): DriveFile {
  const id = typeof record.id === 'string' ? record.id : '';
  const name = typeof record.name === 'string' ? record.name : '';
  if (!DRIVE_FILE_ID.test(id) || !name || name.length > 1_024) {
    throw new StorageAdapterError('provider_error', 'Drive file metadata is malformed', false);
  }
  return {
    id,
    name,
    mimeType: typeof record.mimeType === 'string' ? record.mimeType : null,
    parents: Array.isArray(record.parents) && record.parents.every((parent) => typeof parent === 'string')
      ? [...record.parents]
      : [],
    size: optionalByteCount(record.size) ?? 0,
    version: typeof record.version === 'string' ? record.version : null,
    modifiedTime: typeof record.modifiedTime === 'string' ? record.modifiedTime : null,
    md5Checksum: typeof record.md5Checksum === 'string' ? record.md5Checksum : null,
    sha256Checksum: typeof record.sha256Checksum === 'string' ? record.sha256Checksum : null,
    appProperties: stringRecord(record.appProperties),
  };
}

function parseDriveFile(bytes: Uint8Array, maximumBytes: number): DriveFile {
  return driveFileFromRecord(parseJsonObject(bytes, maximumBytes));
}

function parseDriveFilePage(bytes: Uint8Array, maximumBytes: number): DriveFilePage {
  const record = parseJsonObject(bytes, maximumBytes);
  if (!Array.isArray(record.files) || record.files.length > MAX_PAGE_SIZE) {
    throw new StorageAdapterError('provider_error', 'Drive file page is malformed', false);
  }
  return {
    files: record.files.map((file) => {
      const value = recordValue(file);
      if (!value) throw new StorageAdapterError('provider_error', 'Drive file page is malformed', false);
      return driveFileFromRecord(value);
    }),
    nextPageToken: typeof record.nextPageToken === 'string' && record.nextPageToken
      ? record.nextPageToken
      : null,
  };
}

function metadata(file: DriveFile, objectId: string): StorageObjectMetadata {
  return {
    objectId,
    dataClass: file.appProperties.dataClass ?? '',
    remoteRef: remoteRef(file.id),
    remoteVersion: file.version ?? file.modifiedTime,
    encryptedBytes: file.size,
    // appProperties are client-written conflict metadata, not checksum proof.
    ciphertextHash: null,
  };
}

function remoteRef(fileId: string): string {
  return `gdrive:${fileId}`;
}

function fileIdFromRemoteRef(value: string): string {
  if (!value.startsWith('gdrive:')) {
    throw new StorageAdapterError('provider_error', 'Drive remote reference is invalid', false);
  }
  const id = value.slice('gdrive:'.length);
  if (!DRIVE_FILE_ID.test(id)) {
    throw new StorageAdapterError('provider_error', 'Drive remote reference is invalid', false);
  }
  return id;
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/gu, '\\\\').replace(/'/gu, "\\'");
}

function validateObject(input: EncryptedStorageObject, maximumBytes: number): void {
  assertSafeObjectId(input.objectId);
  if (!(input.ciphertext instanceof Uint8Array)
    || !Number.isSafeInteger(input.encryptedBytes)
    || input.encryptedBytes <= 0
    || input.encryptedBytes !== input.ciphertext.byteLength
    || input.encryptedBytes > maximumBytes
    || !SHA512_HEX.test(input.ciphertextHash)
    || sha512Hex(input.ciphertext) !== input.ciphertextHash
    || !input.dataClass.trim()
    || input.dataClass.length > 128) {
    throw new StorageAdapterError(
      input.encryptedBytes > maximumBytes ? 'quota_exceeded' : 'provider_error',
      'Drive object is malformed or exceeds the configured limit',
      false,
    );
  }
}

function validateRange(range: StorageByteRange): void {
  if (!Number.isSafeInteger(range.offset) || range.offset < 0
    || !Number.isSafeInteger(range.length) || range.length < 0
    || range.offset + range.length > Number.MAX_SAFE_INTEGER) {
    throw new StorageAdapterError('provider_error', 'Drive byte range is invalid', false);
  }
}

function nextResumeOffset(response: HttpTransportResponse, fallback: number): number {
  const range = responseHeader(response.headers, 'range');
  const match = range ? /^bytes=0-(\d+)$/u.exec(range.trim()) : null;
  if (!match) return fallback;
  const last = Number(match[1]);
  return Number.isSafeInteger(last) ? last + 1 : fallback;
}

function resumeStatusOffset(response: HttpTransportResponse): number {
  const range = responseHeader(response.headers, 'range');
  if (!range) return 0;
  const match = /^bytes=0-(\d+)$/u.exec(range.trim());
  if (!match) throw new StorageAdapterError('provider_error', 'Drive returned an invalid resume range', false);
  const last = Number(match[1]);
  if (!Number.isSafeInteger(last)) {
    throw new StorageAdapterError('provider_error', 'Drive returned an invalid resume range', false);
  }
  return last + 1;
}

function incompleteWrite(
  input: EncryptedStorageObject,
  sessionUrl: string,
  offset: number,
): StorageWriteResult {
  return {
    complete: false,
    verified: false,
    verification: { kind: 'none' },
    remoteRef: sessionUrl,
    remoteVersion: null,
    encryptedBytes: offset,
    ciphertextHash: input.ciphertextHash,
    resumeToken: { providerSession: sessionUrl, offset },
  };
}

function encodeCursor(pageToken: string): string {
  if (pageToken.length > 2_048) throw new StorageAdapterError('provider_error', 'Drive cursor is too large', false);
  return `gdrive:${bytesToBase64Url(encoder.encode(JSON.stringify({ v: 1, pageToken })))}`;
}

function decodeCursor(cursor: string | undefined): string | null {
  if (cursor === undefined) return null;
  if (!cursor.startsWith('gdrive:') || cursor.length > 4_096) {
    throw new StorageAdapterError('provider_error', 'Drive cursor is invalid', false);
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(cursor.slice(7)))) as unknown;
    const record = recordValue(parsed);
    if (record?.v === 1 && typeof record.pageToken === 'string' && record.pageToken.length <= 2_048) {
      return record.pageToken;
    }
  } catch {
    // Typed below.
  }
  throw new StorageAdapterError('provider_error', 'Drive cursor is invalid', false);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let output = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const a = bytes[offset] ?? 0;
    const b = bytes[offset + 1] ?? 0;
    const c = bytes[offset + 2] ?? 0;
    const combined = (a << 16) | (b << 8) | c;
    output += alphabet[(combined >>> 18) & 63];
    output += alphabet[(combined >>> 12) & 63];
    if (offset + 1 < bytes.length) output += alphabet[(combined >>> 6) & 63];
    if (offset + 2 < bytes.length) output += alphabet[combined & 63];
  }
  return output;
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error('invalid base64url');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of value) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('invalid base64url');
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >>> bits) & 0xff);
    }
  }
  return new Uint8Array(output);
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

function errorRetryable(error: unknown): boolean | null {
  if (typeof error !== 'object' || error === null || !('retryable' in error)) return null;
  return typeof error.retryable === 'boolean' ? error.retryable : null;
}

function googleReasons(response: HttpTransportResponse, maximumBytes: number): string[] {
  try {
    const root = parseJsonObject(response.body, maximumBytes);
    const error = recordValue(root.error);
    const errors = error?.errors;
    if (!Array.isArray(errors)) return [];
    return errors.flatMap((item) => {
      const record = recordValue(item);
      return typeof record?.reason === 'string' ? [record.reason] : [];
    });
  } catch {
    return [];
  }
}

function throwDriveResponse(response: HttpTransportResponse, maximumBytes: number): never {
  if (response.status === 401) {
    throw new StorageAdapterError('auth_required', 'Google Drive authorization is required', false);
  }
  if (response.status === 403) {
    const reasons = googleReasons(response, maximumBytes);
    const quotaReasons = new Set([
      'quotaExceeded', 'storageQuotaExceeded', 'teamDriveFileLimitExceeded', 'dailyLimitExceeded',
    ]);
    const rateReasons = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'sharingRateLimitExceeded']);
    if (reasons.some((reason) => quotaReasons.has(reason))) {
      throw new StorageAdapterError('quota_exceeded', 'Google Drive quota was exceeded', false);
    }
    if (reasons.some((reason) => rateReasons.has(reason))) {
      throw new StorageAdapterError('rate_limited', 'Google Drive rate limit was reached', true);
    }
    throw new StorageAdapterError('provider_error', 'Google Drive refused the operation', false);
  }
  if (response.status === 404) {
    throw new StorageAdapterError('not_found', 'Google Drive object was not found', false);
  }
  if (response.status === 408 || response.status === 425) {
    throw new StorageAdapterError('unreachable', 'Google Drive request could not complete', true);
  }
  if (response.status === 409 || response.status === 412) {
    throw new StorageAdapterError('conflict', 'Google Drive object changed concurrently', false);
  }
  if (response.status === 429) {
    throw new StorageAdapterError('rate_limited', 'Google Drive rate limit was reached', true);
  }
  if (response.status >= 500) {
    throw new StorageAdapterError('provider_error', 'Google Drive returned a server error', true);
  }
  throw new StorageAdapterError('provider_error', 'Google Drive returned an unexpected status', false);
}

function normalizeDriveError(error: unknown): StorageAdapterError {
  return error instanceof StorageAdapterError
    ? error
    : new StorageAdapterError('provider_error', 'Google Drive operation failed', false);
}
