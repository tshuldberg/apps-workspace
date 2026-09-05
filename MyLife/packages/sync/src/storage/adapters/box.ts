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
import {
  assertSafeObjectId,
  bytesToBase64,
  concatBytes,
  equalBytes,
  responseHeader,
} from './http';
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
  validateCredentialRef,
  validateEncryptedObject,
  validatePreauthorizedUrl,
  validateRange,
  validateResumeOffset,
} from './provider-common';
import { sha1Bytes, sha1Hex } from './provider-crypto';

export type { AccessTokenProvider } from './google-drive';

export { sha1Bytes, sha1Hex } from './provider-crypto';

export interface BoxFolderState {
  getFolderId(): Promise<string | null>;
  setFolderId(folderId: string): Promise<void>;
  clearFolderId?(): Promise<void>;
}

export interface BoxAdapterOptions {
  transport: HttpTransport;
  accessTokenProvider: AccessTokenProvider;
  credentialRef: string;
  folderState: BoxFolderState;
  apiBaseUrl?: string;
  uploadBaseUrl?: string;
  downloadAllowedOrigins?: readonly string[];
  rootFolderName?: string;
  maximumObjectBytes?: number;
  chunkedUploadThresholdBytes?: number;
  pageSize?: number;
  maximumResponseBytes?: number;
  now?: () => string;
}

interface BoxFile {
  id: string;
  name: string;
  size: number;
  sha1: string | null;
  etag: string | null;
  sequenceId: string | null;
  fileVersionId: string | null;
  parentId: string | null;
}

interface BoxPart {
  partId: string;
  offset: number;
  size: number;
  sha1: string;
}

interface BoxUploadSession {
  id: string;
  partSize: number;
  uploadPartUrl: string;
  commitUrl: string;
  listPartsUrl: string;
  parts: BoxPart[];
}

interface BoxItemPage {
  files: BoxFile[];
  folders: Array<{ id: string; name: string; parentId: string | null }>;
  nextMarker: string | null;
}

const DEFAULT_API_BASE = 'https://api.box.com/2.0/';
const DEFAULT_UPLOAD_BASE = 'https://upload.box.com/api/2.0/';
const DEFAULT_ROOT_NAME = 'Meerkat';
const DEFAULT_MAXIMUM_OBJECT_BYTES = 5 * 1024 * 1024 * 1024;
const DEFAULT_CHUNKED_THRESHOLD_BYTES = 20 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAXIMUM_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_PAGE_SIZE = 1_000;
const BOX_ID = /^\d{1,32}$/u;
const BOX_SESSION_ID = /^[A-Za-z0-9_-]{1,512}$/u;
const SHA1_HEX = /^[a-f0-9]{40}$/u;
const encoder = new TextEncoder();

export class BoxStorageAdapter implements StorageDestinationAdapter {
  private readonly accessTokenProvider: AccessTokenProvider;
  private readonly credentialRef: string;
  private readonly folderState: BoxFolderState;
  private readonly apiBase: URL;
  private readonly uploadBase: URL;
  private readonly downloadAllowedOrigins: readonly string[];
  private readonly rootFolderName: string;
  private readonly maximumObjectBytes: number;
  private readonly chunkedUploadThresholdBytes: number;
  private readonly pageSize: number;
  private readonly maximumResponseBytes: number;
  private readonly now: () => string;
  private readonly http: OAuthHttpClient;
  private authorized = false;
  private revoked = false;
  private verifiedReadWrite = false;

  constructor(options: BoxAdapterOptions) {
    this.accessTokenProvider = options.accessTokenProvider;
    this.credentialRef = validateCredentialRef(options.credentialRef, 'Box');
    this.folderState = options.folderState;
    this.apiBase = parseHttpsBase(options.apiBaseUrl ?? DEFAULT_API_BASE, 'Box API base URL');
    this.uploadBase = parseHttpsBase(options.uploadBaseUrl ?? DEFAULT_UPLOAD_BASE, 'Box upload base URL');
    this.downloadAllowedOrigins = (options.downloadAllowedOrigins ?? []).map(parseAllowedOrigin);
    this.rootFolderName = options.rootFolderName ?? DEFAULT_ROOT_NAME;
    assertSafeObjectId(this.rootFolderName);
    this.maximumObjectBytes = positiveInteger(
      options.maximumObjectBytes ?? DEFAULT_MAXIMUM_OBJECT_BYTES,
      'maximumObjectBytes',
    );
    this.chunkedUploadThresholdBytes = positiveInteger(
      options.chunkedUploadThresholdBytes ?? DEFAULT_CHUNKED_THRESHOLD_BYTES,
      'chunkedUploadThresholdBytes',
    );
    this.pageSize = positiveInteger(options.pageSize ?? DEFAULT_PAGE_SIZE, 'pageSize');
    if (this.pageSize > MAX_PAGE_SIZE) {
      throw new StorageAdapterError('provider_error', 'Box page size exceeds the provider limit', false);
    }
    this.maximumResponseBytes = positiveInteger(
      options.maximumResponseBytes ?? DEFAULT_MAXIMUM_RESPONSE_BYTES,
      'maximumResponseBytes',
    );
    this.now = options.now ?? (() => new Date().toISOString());
    this.http = new OAuthHttpClient(
      'Box',
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
      const response = await this.http.request('health', 'GET', this.apiUrl('users/me').href);
      if (response.status !== 200) throwBoxResponse(response, this.maximumResponseBytes);
      parseJsonObject(response.body, this.maximumResponseBytes, 'Box');
      await this.ensureRootFolder();
      return healthResult(this.now, 'ok', this.verifiedReadWrite);
    } catch (error) {
      const normalized = normalizeProviderError(error, 'Box');
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
    const url = this.apiUrl('users/me');
    url.searchParams.set('fields', 'space_used,space_amount');
    const response = await this.http.request('quota', 'GET', url.href);
    if (response.status !== 200) throwBoxResponse(response, this.maximumResponseBytes);
    const body = parseJsonObject(response.body, this.maximumResponseBytes, 'Box');
    return {
      usedBytes: optionalByteCount(body.space_used),
      capBytes: optionalByteCount(body.space_amount),
      estimated: false,
    };
  }

  async putObject(input: EncryptedStorageObject, resume?: StorageResumeToken): Promise<StorageWriteResult> {
    this.requireAuthorized();
    assertSafeObjectId(input.objectId);
    validateEncryptedObject(input, this.maximumObjectBytes, 'Box');
    const folderId = await this.ensureRootFolder();
    const existing = await this.findFile(folderId, input.objectId);
    if (existing) return this.resolveExisting(input, existing);
    if (!resume && input.encryptedBytes < this.chunkedUploadThresholdBytes) {
      return this.directUpload(input, folderId);
    }
    return this.chunkedUpload(input, folderId, resume);
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
    if (range) validateRange(range, 'Box');
    const file = await this.resolveFile(ref);
    if (!file) return null;
    return this.downloadFile(file.id, range);
  }

  async listObjects(cursor?: string): Promise<StorageObjectPage> {
    this.requireAuthorized();
    const folderId = await this.ensureRootFolder();
    let marker: string | null = null;
    if (cursor !== undefined) {
      const decoded = decodeOpaque(cursor, 'box-cursor', 4_096, 'Box');
      marker = requiredString(decoded.marker, 2_048);
      if (decoded.v !== 1 || !marker) {
        throw new StorageAdapterError('provider_error', 'Box marker cursor is invalid', false);
      }
    }
    const page = await this.listFolderPage(folderId, marker);
    return {
      items: page.files
        .filter((file) => isSafeObjectId(file.name))
        .map((file) => metadata(file, file.name))
        .sort((left, right) => left.objectId.localeCompare(right.objectId)),
      nextCursor: page.nextMarker
        ? encodeOpaque('box-cursor', { v: 1, marker: page.nextMarker })
        : null,
    };
  }

  async deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult> {
    this.requireAuthorized();
    assertSafeObjectId(ref.objectId);
    const file = await this.resolveFile(ref);
    if (!file) return { deleted: false, remoteRef: null };
    const response = await this.http.request('delete', 'DELETE', this.apiUrl(`files/${file.id}`).href);
    if (response.status === 404) return { deleted: false, remoteRef: remoteRef(file.id) };
    if (response.status !== 204) throwBoxResponse(response, this.maximumResponseBytes);
    return { deleted: true, remoteRef: remoteRef(file.id) };
  }

  private async directUpload(input: EncryptedStorageObject, folderId: string): Promise<StorageWriteResult> {
    const boundary = `meerkat-${input.objectId}-${input.ciphertextHash.slice(0, 24)}`;
    const body = multipartBody(boundary, input, folderId);
    const response = await this.http.request('write', 'POST', this.uploadUrl('files/content').href, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-MD5': sha1Hex(input.ciphertext),
    }, body);
    if (response.status === 409) {
      const raced = await this.findFile(folderId, input.objectId);
      if (raced) return this.resolveExisting(input, raced);
    }
    if (response.status !== 201) throwBoxResponse(response, this.maximumResponseBytes);
    const file = parseBoxFileList(response.body, this.maximumResponseBytes);
    const bytes = await this.downloadFile(file.id);
    if (!bytes || !equalBytes(bytes, input.ciphertext)) {
      throw new StorageAdapterError('corrupt_ciphertext', 'Box direct-upload read-back did not match ciphertext', false);
    }
    this.verifiedReadWrite = true;
    return {
      complete: true,
      verified: true,
      verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash },
      remoteRef: remoteRef(file.id),
      remoteVersion: file.fileVersionId ?? file.etag,
      encryptedBytes: input.encryptedBytes,
      ciphertextHash: input.ciphertextHash,
    };
  }

  private async chunkedUpload(
    input: EncryptedStorageObject,
    folderId: string,
    resume?: StorageResumeToken,
  ): Promise<StorageWriteResult> {
    let session: BoxUploadSession;
    let offset: number;
    if (resume) {
      validateResumeOffset(resume, input.encryptedBytes, 'Box', true);
      session = this.decodeSession(resume.providerSession);
      try {
        session.parts = await this.loadSessionParts(session, input);
      } catch (error) {
        const normalized = normalizeProviderError(error, 'Box');
        if (normalized.code === 'not_found') {
          const completed = await this.findFile(folderId, input.objectId);
          if (completed) return this.resolveExisting(input, completed);
        }
        throw normalized;
      }
      offset = contiguousPartsOffset(session.parts, input.encryptedBytes);
      if (offset < resume.offset) {
        throw new StorageAdapterError('conflict', 'Box upload-session offset regressed', false);
      }
    } else {
      try {
        session = await this.startUploadSession(input, folderId);
      } catch (error) {
        const normalized = normalizeProviderError(error, 'Box');
        if (normalized.code === 'conflict') {
          const raced = await this.findFile(folderId, input.objectId);
          if (raced) return this.resolveExisting(input, raced);
        }
        throw normalized;
      }
      offset = 0;
    }

    if (offset < input.encryptedBytes) {
      const end = Math.min(input.encryptedBytes, offset + session.partSize);
      const chunk = input.ciphertext.slice(offset, end);
      let response: HttpTransportResponse;
      try {
        response = await this.http.request('write', 'PUT', session.uploadPartUrl, {
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${offset}-${end - 1}/${input.encryptedBytes}`,
          Digest: `sha=${bytesToBase64(sha1Bytes(chunk))}`,
        }, chunk);
      } catch (error) {
        const normalized = normalizeProviderError(error, 'Box');
        if (normalized.retryable) return incompleteWrite(input, this.encodeSession(session), offset);
        throw normalized;
      }
      if (response.status !== 200) throwBoxResponse(response, this.maximumResponseBytes);
      const part = parseBoxPart(response.body, this.maximumResponseBytes);
      validatePartAgainstBytes(part, input.ciphertext);
      if (part.offset !== offset || part.size !== chunk.byteLength) {
        throw new StorageAdapterError('corrupt_ciphertext', 'Box acknowledged the wrong upload part', false);
      }
      session.parts = [...session.parts, part].sort((left, right) => left.offset - right.offset);
      offset = end;
      if (offset < input.encryptedBytes) {
        return incompleteWrite(input, this.encodeSession(session), offset);
      }
    }

    return this.commitSession(input, folderId, session);
  }

  private async startUploadSession(
    input: EncryptedStorageObject,
    folderId: string,
  ): Promise<BoxUploadSession> {
    const response = await this.http.request('write', 'POST', this.uploadUrl('files/upload_sessions').href, {
      'Content-Type': 'application/json',
    }, jsonBytes({
      folder_id: folderId,
      file_size: input.encryptedBytes,
      file_name: input.objectId,
    }));
    if (response.status !== 201) throwBoxResponse(response, this.maximumResponseBytes);
    const body = parseJsonObject(response.body, this.maximumResponseBytes, 'Box');
    const endpoints = recordValue(body.session_endpoints);
    const id = requiredString(body.id, 512) ?? '';
    const partSize = optionalByteCount(body.part_size);
    const uploadPartUrl = requiredString(endpoints?.upload_part, 4_096);
    const commitUrl = requiredString(endpoints?.commit, 4_096);
    const listPartsUrl = requiredString(endpoints?.list_parts, 4_096);
    if (!BOX_SESSION_ID.test(id) || partSize === null || partSize <= 0
      || !uploadPartUrl || !commitUrl || !listPartsUrl) {
      throw new StorageAdapterError('provider_error', 'Box upload-session metadata is malformed', false);
    }
    return {
      id,
      partSize,
      uploadPartUrl: this.validateUploadUrl(uploadPartUrl),
      commitUrl: this.validateUploadUrl(commitUrl),
      listPartsUrl: this.validateUploadUrl(listPartsUrl),
      parts: [],
    };
  }

  private async loadSessionParts(
    session: BoxUploadSession,
    input: EncryptedStorageObject,
  ): Promise<BoxPart[]> {
    const response = await this.http.request('write', 'GET', session.listPartsUrl);
    if (response.status !== 200) throwBoxResponse(response, this.maximumResponseBytes);
    const body = parseJsonObject(response.body, this.maximumResponseBytes, 'Box');
    const values = Array.isArray(body.entries) ? body.entries : Array.isArray(body.parts) ? body.parts : null;
    if (!values || values.length > Math.ceil(input.encryptedBytes / session.partSize) + 1) {
      throw new StorageAdapterError('provider_error', 'Box upload-session parts are malformed', false);
    }
    const parts = values.map((value) => {
      const record = recordValue(value);
      if (!record) throw new StorageAdapterError('provider_error', 'Box upload-session parts are malformed', false);
      const part = boxPartFromRecord(record);
      validatePartAgainstBytes(part, input.ciphertext);
      return part;
    }).sort((left, right) => left.offset - right.offset);
    contiguousPartsOffset(parts, input.encryptedBytes);
    return parts;
  }

  private async commitSession(
    input: EncryptedStorageObject,
    folderId: string,
    session: BoxUploadSession,
  ): Promise<StorageWriteResult> {
    const wholeSha1 = sha1Hex(input.ciphertext);
    let response: HttpTransportResponse;
    try {
      response = await this.http.request('write', 'POST', session.commitUrl, {
        'Content-Type': 'application/json',
        Digest: `sha=${bytesToBase64(sha1Bytes(input.ciphertext))}`,
      }, jsonBytes({
        parts: session.parts.map((part) => ({
          part_id: part.partId,
          offset: part.offset,
          size: part.size,
          sha1: part.sha1,
        })),
      }));
    } catch (error) {
      const normalized = normalizeProviderError(error, 'Box');
      if (normalized.retryable) {
        return incompleteWrite(input, this.encodeSession(session), input.encryptedBytes);
      }
      throw normalized;
    }
    if (response.status === 202) {
      return incompleteWrite(input, this.encodeSession(session), input.encryptedBytes);
    }
    if (response.status === 409) {
      const raced = await this.findFile(folderId, input.objectId);
      if (raced) return this.resolveExisting(input, raced);
    }
    if (response.status !== 201) throwBoxResponse(response, this.maximumResponseBytes);
    const file = parseBoxFileList(response.body, this.maximumResponseBytes);
    if (file.name !== input.objectId || file.size !== input.encryptedBytes
      || (file.sha1 !== null && file.sha1 !== wholeSha1)) {
      throw new StorageAdapterError('corrupt_ciphertext', 'Box commit digest did not match ciphertext', false);
    }
    let evidence: StorageVerificationEvidence;
    if (file.sha1) {
      // A 201 response means Box accepted and validated the whole-file Digest header.
      evidence = { kind: 'provider_checksum', algorithm: 'sha1', value: wholeSha1 };
    } else {
      const bytes = await this.downloadFile(file.id);
      if (!bytes) evidence = { kind: 'none' };
      else if (!equalBytes(bytes, input.ciphertext)) {
        throw new StorageAdapterError('corrupt_ciphertext', 'Box commit read-back did not match ciphertext', false);
      } else evidence = { kind: 'read_back', ciphertextHash: input.ciphertextHash };
    }
    this.verifiedReadWrite = evidence.kind !== 'none';
    const result = {
      complete: true as const,
      remoteRef: remoteRef(file.id),
      remoteVersion: file.fileVersionId ?? file.etag,
      encryptedBytes: input.encryptedBytes,
      ciphertextHash: input.ciphertextHash,
    };
    return evidence.kind === 'none'
      ? { ...result, verified: false, verification: evidence }
      : { ...result, verified: true, verification: evidence };
  }

  private async resolveExisting(input: EncryptedStorageObject, file: BoxFile): Promise<StorageWriteResult> {
    const expectedSha1 = sha1Hex(input.ciphertext);
    if (file.size !== input.encryptedBytes || (file.sha1 && file.sha1 !== expectedSha1)) {
      throw new StorageAdapterError(
        'corrupt_ciphertext',
        'the same Box folder name contains different ciphertext',
        false,
      );
    }
    const bytes = await this.downloadFile(file.id);
    if (!bytes || !equalBytes(bytes, input.ciphertext) || sha512Hex(bytes) !== input.ciphertextHash) {
      throw new StorageAdapterError('corrupt_ciphertext', 'Box conflict read-back did not match ciphertext', false);
    }
    this.verifiedReadWrite = true;
    return {
      complete: true,
      verified: true,
      verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash },
      remoteRef: remoteRef(file.id),
      remoteVersion: file.fileVersionId ?? file.etag,
      encryptedBytes: input.encryptedBytes,
      ciphertextHash: input.ciphertextHash,
    };
  }

  private async resolveFile(ref: StorageObjectRef): Promise<BoxFile | null> {
    const folderId = await this.ensureRootFolder();
    const file = ref.remoteRef
      ? await this.getFile(fileIdFromRemoteRef(ref.remoteRef))
      : await this.findFile(folderId, ref.objectId);
    if (!file) return null;
    if (file.name !== ref.objectId || file.parentId !== folderId) {
      throw new StorageAdapterError(
        'corrupt_ciphertext',
        'Box reference is not bound to the expected Meerkat folder object',
        false,
      );
    }
    return file;
  }

  private async getFile(fileId: string): Promise<BoxFile | null> {
    const url = this.apiUrl(`files/${fileId}`);
    url.searchParams.set('fields', BOX_FILE_FIELDS);
    const response = await this.http.request('read', 'GET', url.href);
    if (response.status === 404) return null;
    if (response.status !== 200) throwBoxResponse(response, this.maximumResponseBytes);
    return parseBoxFile(response.body, this.maximumResponseBytes);
  }

  private async findFile(folderId: string, objectId: string): Promise<BoxFile | null> {
    let marker: string | null = null;
    const matches: BoxFile[] = [];
    do {
      const page = await this.listFolderPage(folderId, marker);
      matches.push(...page.files.filter((file) => file.name === objectId));
      marker = page.nextMarker;
    } while (marker !== null);
    if (matches.length > 1) {
      throw new StorageAdapterError('conflict', 'multiple Box files map to one object id', false);
    }
    return matches[0] ?? null;
  }

  private async downloadFile(fileId: string, range?: StorageByteRange): Promise<Uint8Array | null> {
    const headers: Record<string, string> = {};
    if (range) {
      if (range.length === 0) return new Uint8Array();
      headers.Range = `bytes=${range.offset}-${range.offset + range.length - 1}`;
    }
    let response = await this.http.requestWithoutRedirect(
      'read',
      'GET',
      this.apiUrl(`files/${fileId}/content`).href,
      headers,
    );
    if (response.status >= 300 && response.status <= 399) {
      if (response.status !== 302) {
        throw new StorageAdapterError('unsafe_redirect', 'Box returned an unsupported content redirect', false);
      }
      const location = responseHeader(response.headers, 'location');
      if (!location) {
        throw new StorageAdapterError('unsafe_redirect', 'Box returned an unusable content redirect', false);
      }
      response = await this.http.requestPreauthorized(
        'GET',
        this.validateDownloadUrl(location),
        headers,
      );
    }
    if (response.status === 404) return null;
    if (response.status !== 200 && !(range && response.status === 206)) {
      throwBoxResponse(response, this.maximumResponseBytes);
    }
    if (response.body.byteLength > this.maximumObjectBytes) {
      throw new StorageAdapterError('provider_error', 'Box object exceeded the configured limit', false);
    }
    if (range && response.status === 200) return response.body.slice(range.offset, range.offset + range.length);
    if (range && response.body.byteLength > range.length) {
      throw new StorageAdapterError('provider_error', 'Box returned too many ranged bytes', false);
    }
    return response.body.slice();
  }

  private async ensureRootFolder(): Promise<string> {
    const cached = await this.folderState.getFolderId();
    if (cached && BOX_ID.test(cached)) {
      const folder = await this.getFolder(cached);
      if (folder && folder.name === this.rootFolderName && folder.parentId === '0') return cached;
      await this.folderState.clearFolderId?.();
    }
    const matches = await this.findRootFolders();
    if (matches.length > 1) {
      throw new StorageAdapterError('conflict', 'multiple dedicated Meerkat Box folders were found', false);
    }
    let folderId: string | null = matches[0]?.id ?? null;
    if (!folderId) {
      const response = await this.http.request('write', 'POST', this.apiUrl('folders').href, {
        'Content-Type': 'application/json',
      }, jsonBytes({ name: this.rootFolderName, parent: { id: '0' } }));
      if (response.status === 409) {
        const raced = await this.findRootFolders();
        if (raced.length !== 1) {
          throw new StorageAdapterError('conflict', 'Box root folder name conflicted ambiguously', false);
        }
        folderId = raced[0]?.id ?? null;
      } else {
        if (response.status !== 201) throwBoxResponse(response, this.maximumResponseBytes);
        const body = parseJsonObject(response.body, this.maximumResponseBytes, 'Box');
        folderId = requiredString(body.id, 32);
      }
    }
    if (!folderId || !BOX_ID.test(folderId)) {
      throw new StorageAdapterError('provider_error', 'Box root folder metadata is malformed', false);
    }
    await this.folderState.setFolderId(folderId);
    return folderId;
  }

  private async findRootFolders(): Promise<Array<{ id: string; name: string }>> {
    let marker: string | null = null;
    const matches: Array<{ id: string; name: string }> = [];
    do {
      const page = await this.listFolderPage('0', marker);
      matches.push(...page.folders
        .filter((folder) => folder.name === this.rootFolderName)
        .map(({ id, name }) => ({ id, name })));
      marker = page.nextMarker;
    } while (marker !== null);
    return matches;
  }

  private async getFolder(folderId: string): Promise<{ id: string; name: string; parentId: string | null } | null> {
    const url = this.apiUrl(`folders/${folderId}`);
    url.searchParams.set('fields', 'id,type,name,parent');
    const response = await this.http.request('read', 'GET', url.href);
    if (response.status === 404) return null;
    if (response.status !== 200) throwBoxResponse(response, this.maximumResponseBytes);
    const body = parseJsonObject(response.body, this.maximumResponseBytes, 'Box');
    const id = requiredString(body.id, 32) ?? '';
    const name = requiredString(body.name, 255) ?? '';
    const parentId = requiredString(recordValue(body.parent)?.id, 32);
    if (body.type !== 'folder' || !BOX_ID.test(id) || !name) {
      throw new StorageAdapterError('provider_error', 'Box folder metadata is malformed', false);
    }
    return { id, name, parentId };
  }

  private async listFolderPage(folderId: string, marker: string | null): Promise<BoxItemPage> {
    const url = this.apiUrl(`folders/${folderId}/items`);
    url.searchParams.set('usemarker', 'true');
    url.searchParams.set('limit', String(this.pageSize));
    url.searchParams.set('fields', `${BOX_FILE_FIELDS},type,name,parent`);
    if (marker) url.searchParams.set('marker', marker);
    const response = await this.http.request('list', 'GET', url.href);
    if (response.status !== 200) throwBoxResponse(response, this.maximumResponseBytes);
    const body = parseJsonObject(response.body, this.maximumResponseBytes, 'Box');
    if (!Array.isArray(body.entries) || body.entries.length > MAX_PAGE_SIZE) {
      throw new StorageAdapterError('provider_error', 'Box folder page is malformed', false);
    }
    const files: BoxFile[] = [];
    const folders: Array<{ id: string; name: string; parentId: string | null }> = [];
    for (const value of body.entries) {
      const item = recordValue(value);
      if (!item) throw new StorageAdapterError('provider_error', 'Box folder page is malformed', false);
      if (item.type === 'file') files.push(boxFileFromRecord(item));
      if (item.type === 'folder') {
        const id = requiredString(item.id, 32) ?? '';
        const name = requiredString(item.name, 255) ?? '';
        if (!BOX_ID.test(id) || !name) {
          throw new StorageAdapterError('provider_error', 'Box folder page is malformed', false);
        }
        folders.push({ id, name, parentId: requiredString(recordValue(item.parent)?.id, 32) });
      }
    }
    return {
      files,
      folders,
      nextMarker: requiredString(body.next_marker, 2_048),
    };
  }

  private encodeSession(session: BoxUploadSession): string {
    return encodeOpaque('box-session', {
      v: 1,
      id: session.id,
      partSize: session.partSize,
      uploadPartUrl: session.uploadPartUrl,
      commitUrl: session.commitUrl,
      listPartsUrl: session.listPartsUrl,
      parts: session.parts,
    });
  }

  private decodeSession(value: string): BoxUploadSession {
    const body = decodeOpaque(value, 'box-session', 64 * 1024, 'Box');
    const id = requiredString(body.id, 512) ?? '';
    const partSize = optionalByteCount(body.partSize);
    const uploadPartUrl = requiredString(body.uploadPartUrl, 4_096);
    const commitUrl = requiredString(body.commitUrl, 4_096);
    const listPartsUrl = requiredString(body.listPartsUrl, 4_096);
    if (body.v !== 1 || !BOX_SESSION_ID.test(id) || partSize === null || partSize <= 0
      || !uploadPartUrl || !commitUrl || !listPartsUrl || !Array.isArray(body.parts)) {
      throw new StorageAdapterError('provider_error', 'Box upload-session token is malformed', false);
    }
    const parts = body.parts.map((value) => {
      const record = recordValue(value);
      if (!record) throw new StorageAdapterError('provider_error', 'Box upload-session token is malformed', false);
      return boxPartFromRecord(record);
    });
    return {
      id,
      partSize,
      uploadPartUrl: this.validateUploadUrl(uploadPartUrl),
      commitUrl: this.validateUploadUrl(commitUrl),
      listPartsUrl: this.validateUploadUrl(listPartsUrl),
      parts,
    };
  }

  private validateUploadUrl(value: string): string {
    return validatePreauthorizedUrl(value, [this.uploadBase.origin], 'Box');
  }

  private validateDownloadUrl(value: string): string {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new StorageAdapterError('unsafe_redirect', 'Box returned an invalid download URL', false);
    }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.hash
      || (!(host === 'boxcloud.com' || host.endsWith('.boxcloud.com'))
        && !this.downloadAllowedOrigins.includes(url.origin))) {
      throw new StorageAdapterError('unsafe_redirect', 'Box download URL escaped its allowlist', false);
    }
    return url.href;
  }

  private apiUrl(path: string): URL {
    return new URL(path, this.apiBase);
  }

  private uploadUrl(path: string): URL {
    return new URL(path, this.uploadBase);
  }

  private requireAuthorized(): void {
    if (!this.authorized) throw new StorageAdapterError('auth_required', 'Box authorization is required', false);
  }
}

const BOX_FILE_FIELDS = 'id,size,sha1,etag,sequence_id,file_version,parent';

function boxFileFromRecord(record: Record<string, unknown>): BoxFile {
  const id = requiredString(record.id, 32) ?? '';
  const name = requiredString(record.name, 255) ?? '';
  const size = optionalByteCount(record.size);
  const sha1 = requiredString(record.sha1, 64)?.toLowerCase() ?? null;
  if (record.type !== 'file' || !BOX_ID.test(id) || !name || size === null
    || (sha1 !== null && !SHA1_HEX.test(sha1))) {
    throw new StorageAdapterError('provider_error', 'Box file metadata is malformed', false);
  }
  return {
    id,
    name,
    size,
    sha1,
    etag: requiredString(record.etag, 512),
    sequenceId: requiredString(record.sequence_id, 512),
    fileVersionId: requiredString(recordValue(record.file_version)?.id, 32),
    parentId: requiredString(recordValue(record.parent)?.id, 32),
  };
}

function parseBoxFile(bytes: Uint8Array, maximumBytes: number): BoxFile {
  return boxFileFromRecord(parseJsonObject(bytes, maximumBytes, 'Box'));
}

function parseBoxFileList(bytes: Uint8Array, maximumBytes: number): BoxFile {
  const body = parseJsonObject(bytes, maximumBytes, 'Box');
  if (!Array.isArray(body.entries) || body.entries.length !== 1) {
    throw new StorageAdapterError('provider_error', 'Box upload response is malformed', false);
  }
  const entry = recordValue(body.entries[0]);
  if (!entry) throw new StorageAdapterError('provider_error', 'Box upload response is malformed', false);
  return boxFileFromRecord(entry);
}

function boxPartFromRecord(record: Record<string, unknown>): BoxPart {
  const partId = requiredString(record.part_id ?? record.partId, 512) ?? '';
  const offset = optionalByteCount(record.offset);
  const size = optionalByteCount(record.size);
  const sha1 = requiredString(record.sha1, 64)?.toLowerCase() ?? '';
  if (!partId || offset === null || size === null || size <= 0 || !SHA1_HEX.test(sha1)) {
    throw new StorageAdapterError('provider_error', 'Box upload part is malformed', false);
  }
  return { partId, offset, size, sha1 };
}

function parseBoxPart(bytes: Uint8Array, maximumBytes: number): BoxPart {
  const body = parseJsonObject(bytes, maximumBytes, 'Box');
  const part = recordValue(body.part) ?? body;
  return boxPartFromRecord(part);
}

function validatePartAgainstBytes(part: BoxPart, bytes: Uint8Array): void {
  if (part.offset + part.size > bytes.byteLength
    || sha1Hex(bytes.slice(part.offset, part.offset + part.size)) !== part.sha1) {
    throw new StorageAdapterError('corrupt_ciphertext', 'Box upload-part digest did not match ciphertext', false);
  }
}

function contiguousPartsOffset(parts: readonly BoxPart[], total: number): number {
  let offset = 0;
  for (const part of [...parts].sort((left, right) => left.offset - right.offset)) {
    if (part.offset !== offset || part.offset + part.size > total) {
      throw new StorageAdapterError('conflict', 'Box upload-session parts are not contiguous', false);
    }
    offset += part.size;
  }
  return offset;
}

function multipartBody(boundary: string, input: EncryptedStorageObject, folderId: string): Uint8Array {
  const attributes = JSON.stringify({ name: input.objectId, parent: { id: folderId } });
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="attributes"\r\n`
      + `Content-Type: application/json\r\n\r\n${attributes}\r\n`
      + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${input.objectId}"\r\n`
      + 'Content-Type: application/octet-stream\r\n\r\n',
  );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
  return concatBytes(prefix, input.ciphertext, suffix);
}

function metadata(file: BoxFile, objectId: string): StorageObjectMetadata {
  return {
    objectId,
    dataClass: '',
    remoteRef: remoteRef(file.id),
    remoteVersion: file.fileVersionId ?? file.etag ?? file.sequenceId,
    encryptedBytes: file.size,
    // Box SHA-1 is not the router's SHA-512; etag and sequence_id are revisions.
    ciphertextHash: null,
  };
}

function remoteRef(fileId: string): string {
  return encodeOpaque('box-ref', { v: 1, id: fileId });
}

function fileIdFromRemoteRef(value: string): string {
  const decoded = decodeOpaque(value, 'box-ref', 1_024, 'Box');
  const id = requiredString(decoded.id, 32) ?? '';
  if (decoded.v !== 1 || !BOX_ID.test(id)) {
    throw new StorageAdapterError('provider_error', 'Box remote reference is invalid', false);
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
  throw new StorageAdapterError('provider_error', 'Box download origin is invalid', false);
}

function boxErrorText(response: HttpTransportResponse, maximumBytes: number): string {
  try {
    return JSON.stringify(parseJsonObject(response.body, maximumBytes, 'Box')).toLowerCase();
  } catch {
    return '';
  }
}

function throwBoxResponse(response: HttpTransportResponse, maximumBytes: number): never {
  if (response.status === 401) {
    throw new StorageAdapterError('auth_required', 'Box authorization is required', false);
  }
  const detail = boxErrorText(response, maximumBytes);
  if (response.status === 403) {
    if (detail.includes('storage_limit') || detail.includes('quota')) {
      throw new StorageAdapterError('quota_exceeded', 'Box storage quota was exceeded', false);
    }
    throw new StorageAdapterError('provider_error', 'Box permission was refused', false);
  }
  if (response.status === 404) {
    throw new StorageAdapterError('not_found', 'Box object was not found', false);
  }
  if (response.status === 408 || response.status === 425) {
    throw new StorageAdapterError('unreachable', 'Box request could not complete', true);
  }
  if (response.status === 409 || response.status === 412) {
    throw new StorageAdapterError('conflict', 'Box item changed concurrently', false);
  }
  if (response.status === 413 || response.status === 507) {
    throw new StorageAdapterError('quota_exceeded', 'Box storage quota was exceeded', false);
  }
  if (response.status === 429) throw rateLimitedError('Box', response);
  if (response.status >= 500) {
    throw new StorageAdapterError('provider_error', 'Box returned a server error', true);
  }
  throw new StorageAdapterError('provider_error', 'Box returned an unexpected status', false);
}
