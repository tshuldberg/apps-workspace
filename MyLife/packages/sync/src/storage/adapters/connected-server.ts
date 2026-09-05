import { sha256Hex } from '../../encryption/sha256';
import { sha512Hex } from '../../node/hkdf';
import {
  STORAGE_CHALLENGE_PATH,
  STORAGE_DESCRIPTOR_PATH,
  createStorageChallengeNonce,
  isStorageCapabilityEndpoint,
  verifyStorageCapabilityDescriptor,
  verifyStorageChallengeResponse,
  type StorageCapabilityDescriptor,
  type StorageClockValue,
  type StorageV1Operation,
} from '../connected-descriptor';
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
import type { HttpTransport, HttpTransportResponse } from './http';
import {
  callHttpTransport,
  containsControlCharacter,
  responseHeader,
} from './http';

export const CONNECTED_SERVER_REQUIRED_OPERATIONS = [
  'create_upload',
  'complete_upload',
  'head',
  'get',
  'ranged_get',
  'list',
  'delete',
  'quota',
  'health',
  'account_delete',
  'sha512_checksum',
] as const satisfies readonly StorageV1Operation[];

export type ConnectedServerRequestOperation =
  | 'health'
  | 'quota'
  | 'read'
  | 'write'
  | 'list'
  | 'delete'
  | 'revoke';

/** Returns ephemeral request headers. The adapter stores only StorageAuthorizationInput refs. */
export interface ConnectedServerAuthorizationProvider {
  getRequestHeaders(
    operation: ConnectedServerRequestOperation,
    input: StorageAuthorizationInput,
  ): Promise<Record<string, string> | null>;
  revoke?(): Promise<void>;
}

export interface ConnectedServerAdapterOptions {
  descriptorUrl: string;
  expectedOperatorKey: string;
  transport: HttpTransport;
  authorizationProvider: ConnectedServerAuthorizationProvider;
  credentialRef: string;
  allowInsecureLocalNetwork?: boolean;
  uploadBlockBytes?: number;
  pageSize?: number;
  maximumJsonResponseBytes?: number;
  now?: () => StorageClockValue;
  nonceFactory?: () => string;
}

interface HostedObjectWire {
  id: string;
  encryptedBytes: number;
  ciphertextHash: string;
  dataClass: string;
  version: string;
  createdAt: string;
}

interface ReadyState {
  descriptor: StorageCapabilityDescriptor;
  authorizationInput: StorageAuthorizationInput;
}

const DEFAULT_UPLOAD_BLOCK_BYTES = 4 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAXIMUM_JSON_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_PAGE_SIZE = 200;
const MAX_TOTAL_BLOCKS = 100_000;
const MAX_HEADER_VALUE_CHARS = 8 * 1024;
const OBJECT_ID = /^[A-Za-z0-9_-]{1,128}$/u;
const DATA_CLASS = /^[A-Za-z0-9_.:-]{1,128}$/u;
const SHA512_HEX = /^[a-f0-9]{128}$/u;
const OPERATOR_KEY = /^[a-f0-9]{64}$/u;
const encoder = new TextEncoder();

export class ConnectedServerStorageAdapter implements StorageDestinationAdapter {
  private readonly descriptorUrl: URL;
  private readonly expectedOperatorKey: string;
  private readonly transport: HttpTransport;
  private readonly authorizationProvider: ConnectedServerAuthorizationProvider;
  private readonly credentialRef: string;
  private readonly allowInsecureLocalNetwork: boolean;
  private readonly uploadBlockBytes: number;
  private readonly pageSize: number;
  private readonly maximumJsonResponseBytes: number;
  private readonly now: () => StorageClockValue;
  private readonly nonceFactory: () => string;
  private ready: ReadyState | null = null;
  private revoked = false;
  private verifiedReadWrite = false;

  constructor(options: ConnectedServerAdapterOptions) {
    this.allowInsecureLocalNetwork = options.allowInsecureLocalNetwork === true;
    if (!isStorageCapabilityEndpoint(options.descriptorUrl, this.allowInsecureLocalNetwork)) {
      throw new StorageAdapterError('provider_error', 'Connected server descriptor URL is not secure', false);
    }
    this.descriptorUrl = new URL(options.descriptorUrl);
    if (!this.descriptorUrl.pathname.endsWith(STORAGE_DESCRIPTOR_PATH)) {
      throw new StorageAdapterError('provider_error', 'Connected server descriptor URL has the wrong route', false);
    }
    if (!OPERATOR_KEY.test(options.expectedOperatorKey)) {
      throw new StorageAdapterError('provider_error', 'Connected server operator key is invalid', false);
    }
    this.expectedOperatorKey = options.expectedOperatorKey;
    this.transport = options.transport;
    this.authorizationProvider = options.authorizationProvider;
    this.credentialRef = validateCredentialRef(options.credentialRef);
    this.uploadBlockBytes = positiveSafeInteger(
      options.uploadBlockBytes ?? DEFAULT_UPLOAD_BLOCK_BYTES,
      'uploadBlockBytes',
    );
    this.pageSize = positiveSafeInteger(options.pageSize ?? DEFAULT_PAGE_SIZE, 'pageSize');
    if (this.pageSize > MAX_PAGE_SIZE) {
      throw new StorageAdapterError('provider_error', 'Connected server page size exceeds v1 limits', false);
    }
    this.maximumJsonResponseBytes = positiveSafeInteger(
      options.maximumJsonResponseBytes ?? DEFAULT_MAXIMUM_JSON_RESPONSE_BYTES,
      'maximumJsonResponseBytes',
    );
    this.now = options.now ?? (() => Date.now());
    this.nonceFactory = options.nonceFactory ?? (() => createStorageChallengeNonce());
  }

  async authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult> {
    if (this.revoked && input.kind !== 'interactive') {
      return {
        kind: 'revoked',
        credentialRef: input.credentialRef,
        ...(input.accountHint === undefined ? {} : { accountHint: input.accountHint }),
      };
    }
    this.clearReady();
    try {
      const descriptor = await this.fetchVerifiedDescriptor();
      await this.verifyLiveOperator(descriptor);
      await this.requireAuthorizationHeaders('health', input);
      const health = await this.fetchHealth(descriptor, input);
      if (!health.ok || !health.provisioned) {
        throw new StorageAdapterError(
          'provider_error',
          health.provisioned ? 'Connected server health check failed' : 'Connected server storage is not provisioned',
          false,
        );
      }
      await this.fetchQuota(descriptor, input);
      this.ready = { descriptor, authorizationInput: copyAuthorizationInput(input) };
      this.revoked = false;
      return {
        kind: 'authorized',
        credentialRef: input.credentialRef ?? this.credentialRef,
        ...(input.accountHint === undefined ? {} : { accountHint: input.accountHint }),
      };
    } catch (error) {
      this.clearReady();
      const normalized = normalizeConnectedError(error);
      if (normalized.code === 'auth_required') {
        return {
          kind: 'authorization_required',
          credentialRef: input.credentialRef ?? this.credentialRef,
          ...(input.accountHint === undefined ? {} : { accountHint: input.accountHint }),
        };
      }
      if (normalized.code === 'revoked') {
        this.revoked = true;
        return {
          kind: 'revoked',
          credentialRef: input.credentialRef ?? this.credentialRef,
          ...(input.accountHint === undefined ? {} : { accountHint: input.accountHint }),
        };
      }
      throw normalized;
    }
  }

  async revoke(options: { deleteRemoteData: boolean }): Promise<void> {
    const state = this.ready;
    try {
      if (options.deleteRemoteData && state !== null) {
        const response = await this.authenticatedRequest(
          state.descriptor,
          state.authorizationInput,
          'revoke',
          'POST',
          this.apiUrl(state.descriptor, 'account/delete'),
          { 'Content-Type': 'application/json' },
          encoder.encode('{}'),
        );
        if (response.status !== 200) throwForConnectedStatus(response.status);
        decodeJsonRecord(response.body, this.maximumJsonResponseBytes);
      }
      await this.authorizationProvider.revoke?.();
    } finally {
      this.clearReady();
      this.revoked = true;
    }
  }

  async capabilities(): Promise<StorageCapabilities> {
    const descriptor = this.ready?.descriptor ?? await this.fetchVerifiedDescriptor();
    return {
      backgroundWrite: true,
      resumableUpload: descriptor.supportedOperations.includes('create_upload')
        && descriptor.supportedOperations.includes('complete_upload'),
      list: descriptor.supportedOperations.includes('list'),
      delete: descriptor.supportedOperations.includes('delete'),
      quota: descriptor.supportedOperations.includes('quota'),
      serverChecksum: descriptor.supportedOperations.includes('sha512_checksum'),
      maximumObjectBytes: descriptor.maximumObjectBytes,
    };
  }

  async health(): Promise<StorageHealth> {
    if (this.revoked) return this.healthResult('revoked', false, 'revoked');
    let state: ReadyState;
    try {
      state = this.requireReady();
    } catch {
      return this.healthResult('auth_required', false, 'auth_required');
    }
    try {
      const health = await this.fetchHealth(state.descriptor, state.authorizationInput);
      if (!health.ok || !health.provisioned) {
        return this.healthResult('degraded', false, health.provisioned ? 'health_failed' : 'not_provisioned');
      }
      return this.healthResult('ok', this.verifiedReadWrite);
    } catch (error) {
      const normalized = normalizeConnectedError(error);
      if (normalized.code === 'auth_required') return this.healthResult('auth_required', false, normalized.code);
      if (normalized.code === 'revoked') return this.healthResult('revoked', false, normalized.code);
      if (normalized.code === 'unreachable') return this.healthResult('unreachable', false, normalized.code);
      return this.healthResult('degraded', false, normalized.code);
    }
  }

  async quota(): Promise<StorageQuota> {
    const state = this.requireReady();
    return this.fetchQuota(state.descriptor, state.authorizationInput);
  }

  async putObject(
    input: EncryptedStorageObject,
    resume?: StorageResumeToken,
  ): Promise<StorageWriteResult> {
    const state = this.requireReady();
    validateStorageObject(input, state.descriptor.maximumObjectBytes);
    const remoteRef = this.objectUrl(state.descriptor, input.objectId);
    if (resume === undefined) {
      const existing = await this.headObject({ objectId: input.objectId, remoteRef });
      if (existing !== null) {
        if (existing.encryptedBytes !== input.encryptedBytes
          || existing.ciphertextHash !== input.ciphertextHash
          || existing.dataClass !== input.dataClass) {
          throw new StorageAdapterError(
            'corrupt_ciphertext',
            'Connected server already stores different ciphertext under this object id',
            false,
          );
        }
        this.verifiedReadWrite = true;
        return verifiedChecksumResult(input, remoteRef, existing.remoteVersion);
      }
    }

    const totalBlocks = Math.max(1, Math.ceil(input.encryptedBytes / this.uploadBlockBytes));
    if (totalBlocks > MAX_TOTAL_BLOCKS) {
      throw new StorageAdapterError(
        'provider_error',
        'Connected server upload would exceed the v1 block-count limit',
        false,
      );
    }
    const providerSession = uploadSession(input, totalBlocks);
    const offset = resume === undefined
      ? 0
      : validateResumeToken(resume, providerSession, input.encryptedBytes, this.uploadBlockBytes);
    const blockIndex = Math.floor(offset / this.uploadBlockBytes);
    const end = Math.min(input.encryptedBytes, offset + this.uploadBlockBytes);
    const block = input.ciphertext.slice(offset, end);
    const upload = await this.authenticatedRequest(
      state.descriptor,
      state.authorizationInput,
      'write',
      'POST',
      this.apiUrl(state.descriptor, 'objects'),
      {
        'Content-Type': 'application/octet-stream',
        'X-Mk-Content-Id': input.objectId,
        'X-Mk-Block-Index': String(blockIndex),
        'X-Mk-Total-Blocks': String(totalBlocks),
        'X-Mk-Block-Hash': sha256Hex(block),
      },
      block,
    );
    if (upload.status !== 200) throwForConnectedStatus(upload.status);
    const uploadBody = decodeJsonRecord(upload.body, this.maximumJsonResponseBytes);
    const nextMissing = parseUploadProgress(uploadBody, input.objectId, totalBlocks);
    if (nextMissing !== null) {
      const nextOffset = Math.min(input.encryptedBytes, nextMissing * this.uploadBlockBytes);
      return {
        complete: false,
        verified: false,
        verification: { kind: 'none' },
        remoteRef,
        remoteVersion: null,
        encryptedBytes: nextOffset,
        ciphertextHash: input.ciphertextHash,
        resumeToken: { providerSession, offset: nextOffset },
      };
    }

    const completion = await this.authenticatedRequest(
      state.descriptor,
      state.authorizationInput,
      'write',
      'POST',
      this.apiUrl(state.descriptor, `objects/${encodeURIComponent(input.objectId)}/complete`),
      { 'Content-Type': 'application/json' },
      encoder.encode(JSON.stringify({
        encryptedBytes: input.encryptedBytes,
        ciphertextHash: input.ciphertextHash,
        dataClass: input.dataClass,
      })),
    );
    if (completion.status !== 200 && completion.status !== 201) {
      throwForConnectedStatus(completion.status);
    }
    return this.verifyCompletion(input, remoteRef, completion, state);
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null> {
    const state = this.requireReady();
    const remoteRef = this.resolveObjectRef(state.descriptor, ref);
    const response = await this.authenticatedRequest(
      state.descriptor,
      state.authorizationInput,
      'read',
      'HEAD',
      remoteRef,
      {},
    );
    if (response.status === 404) return null;
    if (response.status !== 200) throwForConnectedStatus(response.status);
    const encryptedBytes = requiredByteCount(responseHeader(response.headers, 'x-mk-encrypted-bytes'));
    if (encryptedBytes > state.descriptor.maximumObjectBytes) {
      throw new StorageAdapterError('provider_error', 'Connected server returned oversized metadata', false);
    }
    const ciphertextHash = requiredSha512(responseHeader(response.headers, 'x-mk-ciphertext-hash'));
    const remoteVersion = requiredHeader(response.headers, 'x-mk-object-version', 512);
    const dataClass = requiredDataClass(responseHeader(response.headers, 'x-mk-data-class'));
    return {
      objectId: ref.objectId,
      dataClass,
      remoteRef,
      remoteVersion,
      encryptedBytes,
      ciphertextHash,
    };
  }

  async getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null> {
    const state = this.requireReady();
    const remoteRef = this.resolveObjectRef(state.descriptor, ref);
    const headers: Record<string, string> = {};
    if (range !== undefined) {
      validateRange(range);
      if (range.length === 0) return new Uint8Array(0);
      headers.Range = `bytes=${range.offset}-${range.offset + range.length - 1}`;
    }
    const response = await this.authenticatedRequest(
      state.descriptor,
      state.authorizationInput,
      'read',
      'GET',
      remoteRef,
      headers,
    );
    if (response.status === 404) return null;
    if ((range === undefined && response.status !== 200)
      || (range !== undefined && response.status !== 206)) {
      throwForConnectedStatus(response.status);
    }
    if (response.body.length > state.descriptor.maximumObjectBytes) {
      throw new StorageAdapterError('provider_error', 'Connected server returned an oversized object', false);
    }
    const advertisedHash = requiredSha512(responseHeader(response.headers, 'x-mk-ciphertext-hash'));
    if (range === undefined) {
      if (sha512Hex(response.body) !== advertisedHash) {
        throw new StorageAdapterError('corrupt_ciphertext', 'Connected server read checksum did not match bytes', false);
      }
      this.verifiedReadWrite = true;
    } else {
      validateContentRange(
        response.headers,
        range,
        response.body.length,
        state.descriptor.maximumObjectBytes,
      );
    }
    return response.body.slice();
  }

  async listObjects(cursor?: string): Promise<StorageObjectPage> {
    const state = this.requireReady();
    const url = new URL(this.apiUrl(state.descriptor, 'objects'));
    url.searchParams.set('limit', String(this.pageSize));
    if (cursor !== undefined) {
      if (cursor.length === 0 || cursor.length > 2_048 || containsControlCharacter(cursor)) {
        throw new StorageAdapterError('provider_error', 'Connected server cursor is invalid', false);
      }
      url.searchParams.set('cursor', cursor);
    }
    const response = await this.authenticatedRequest(
      state.descriptor,
      state.authorizationInput,
      'list',
      'GET',
      url.href,
      {},
    );
    if (response.status !== 200) throwForConnectedStatus(response.status);
    const body = decodeJsonRecord(response.body, this.maximumJsonResponseBytes);
    if (!Array.isArray(body.items) || body.items.length > this.pageSize) {
      throw new StorageAdapterError('provider_error', 'Connected server object page is malformed', false);
    }
    const items = body.items.map((item) => {
      const object = parseHostedObject(item);
      if (object.encryptedBytes > state.descriptor.maximumObjectBytes) {
        throw new StorageAdapterError('provider_error', 'Connected server returned oversized metadata', false);
      }
      return objectMetadata(state.descriptor, object);
    });
    const nextCursor = body.nextCursor;
    if (!(nextCursor === null
      || (typeof nextCursor === 'string'
        && nextCursor.length > 0
        && nextCursor.length <= 2_048
        && !containsControlCharacter(nextCursor)))) {
      throw new StorageAdapterError('provider_error', 'Connected server object cursor is malformed', false);
    }
    return { items, nextCursor };
  }

  async deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult> {
    const state = this.requireReady();
    const remoteRef = this.resolveObjectRef(state.descriptor, ref);
    const response = await this.authenticatedRequest(
      state.descriptor,
      state.authorizationInput,
      'delete',
      'DELETE',
      remoteRef,
      {},
    );
    if (response.status === 404) return { deleted: false, remoteRef };
    if (response.status !== 200) throwForConnectedStatus(response.status);
    const body = decodeJsonRecord(response.body, this.maximumJsonResponseBytes);
    if (typeof body.deleted !== 'boolean' || body.objectId !== ref.objectId) {
      throw new StorageAdapterError('provider_error', 'Connected server delete response is malformed', false);
    }
    return { deleted: body.deleted, remoteRef };
  }

  private async fetchVerifiedDescriptor(): Promise<StorageCapabilityDescriptor> {
    const response = await callHttpTransport(this.transport, {
      method: 'GET',
      url: this.descriptorUrl.href,
      headers: { Accept: 'application/json' },
    });
    if (response.status !== 200) {
      throw new StorageAdapterError('provider_error', 'Connected server descriptor is unavailable', response.status >= 500);
    }
    const value = decodeJson(response.body, 64 * 1024);
    if (!verifyStorageCapabilityDescriptor(value, {
      now: this.now,
      expectedOperatorKey: this.expectedOperatorKey,
      allowInsecureLocalNetwork: this.allowInsecureLocalNetwork,
      requiredOperations: CONNECTED_SERVER_REQUIRED_OPERATIONS,
    })) {
      throw new StorageAdapterError('provider_error', 'Connected server descriptor verification failed', false);
    }
    return value;
  }

  private async verifyLiveOperator(descriptor: StorageCapabilityDescriptor): Promise<void> {
    const nonce = this.nonceFactory();
    const response = await callHttpTransport(this.transport, {
      method: 'POST',
      url: this.challengeUrl(descriptor),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: encoder.encode(JSON.stringify({ nonce })),
    });
    if (response.status !== 200) {
      throw new StorageAdapterError('provider_error', 'Connected server operator challenge failed', false);
    }
    const value = decodeJson(response.body, 64 * 1024);
    if (!verifyStorageChallengeResponse(value, descriptor, nonce, { now: this.now })) {
      throw new StorageAdapterError('provider_error', 'Connected server operator challenge verification failed', false);
    }
  }

  private async fetchHealth(
    descriptor: StorageCapabilityDescriptor,
    input: StorageAuthorizationInput,
  ): Promise<{ ok: boolean; provisioned: boolean }> {
    const response = await this.authenticatedRequest(
      descriptor,
      input,
      'health',
      'GET',
      this.apiUrl(descriptor, 'health'),
      {},
    );
    if (response.status !== 200) throwForConnectedStatus(response.status);
    const body = decodeJsonRecord(response.body, this.maximumJsonResponseBytes);
    if (typeof body.ok !== 'boolean' || typeof body.provisioned !== 'boolean') {
      throw new StorageAdapterError('provider_error', 'Connected server health response is malformed', false);
    }
    return { ok: body.ok, provisioned: body.provisioned };
  }

  private async fetchQuota(
    descriptor: StorageCapabilityDescriptor,
    input: StorageAuthorizationInput,
  ): Promise<StorageQuota> {
    const response = await this.authenticatedRequest(
      descriptor,
      input,
      'quota',
      'GET',
      this.apiUrl(descriptor, 'quota'),
      {},
    );
    if (response.status !== 200) throwForConnectedStatus(response.status);
    const body = decodeJsonRecord(response.body, this.maximumJsonResponseBytes);
    if (!nonNegativeSafeInteger(body.usedBytes)
      || !nonNegativeSafeInteger(body.capBytes)
      || body.usedBytes > body.capBytes) {
      throw new StorageAdapterError('provider_error', 'Connected server quota response is malformed', false);
    }
    if (descriptor.quotaBytes !== null && body.capBytes !== descriptor.quotaBytes) {
      throw new StorageAdapterError(
        'provider_error',
        'Connected server quota differs from its signed descriptor',
        false,
      );
    }
    return { usedBytes: body.usedBytes, capBytes: body.capBytes, estimated: false };
  }

  private async verifyCompletion(
    input: EncryptedStorageObject,
    remoteRef: string,
    response: HttpTransportResponse,
    state: ReadyState,
  ): Promise<StorageWriteResult> {
    const body = decodeJsonRecord(response.body, this.maximumJsonResponseBytes);
    const object = parseHostedObject(body.object);
    if (object.id !== input.objectId
      || object.encryptedBytes !== input.encryptedBytes
      || object.ciphertextHash !== input.ciphertextHash
      || object.dataClass !== input.dataClass) {
      throw new StorageAdapterError('corrupt_ciphertext', 'Connected server completion metadata did not match', false);
    }
    const checksum = isRecord(body.checksum) ? body.checksum : null;
    if (checksum !== null) {
      if (checksum.algorithm !== 'sha512'
        || typeof checksum.value !== 'string'
        || !SHA512_HEX.test(checksum.value)
        || checksum.value !== input.ciphertextHash) {
        throw new StorageAdapterError('corrupt_ciphertext', 'Connected server completion checksum did not match', false);
      }
      this.verifiedReadWrite = true;
      return verifiedChecksumResult(input, remoteRef, object.version);
    }

    const readBack = await this.authenticatedRequest(
      state.descriptor,
      state.authorizationInput,
      'read',
      'GET',
      remoteRef,
      {},
    );
    if (readBack.status === 404) return unverifiedResult(input, remoteRef, object.version);
    if (readBack.status !== 200) throwForConnectedStatus(readBack.status);
    if (sha512Hex(readBack.body) !== input.ciphertextHash || !equalBytes(readBack.body, input.ciphertext)) {
      throw new StorageAdapterError('corrupt_ciphertext', 'Connected server read-back did not match ciphertext', false);
    }
    this.verifiedReadWrite = true;
    return {
      complete: true,
      verified: true,
      verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash },
      remoteRef,
      remoteVersion: object.version,
      encryptedBytes: input.encryptedBytes,
      ciphertextHash: input.ciphertextHash,
    };
  }

  private async authenticatedRequest(
    descriptor: StorageCapabilityDescriptor,
    input: StorageAuthorizationInput,
    operation: ConnectedServerRequestOperation,
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: Uint8Array,
  ): Promise<HttpTransportResponse> {
    this.assertSignedApiUrl(descriptor, url);
    const authorization = await this.requireAuthorizationHeaders(operation, input);
    return callHttpTransport(this.transport, {
      method,
      url,
      headers: { ...authorization, Accept: '*/*', ...headers },
      ...(body === undefined ? {} : { body }),
    });
  }

  private async requireAuthorizationHeaders(
    operation: ConnectedServerRequestOperation,
    input: StorageAuthorizationInput,
  ): Promise<Record<string, string>> {
    let headers: Record<string, string> | null;
    try {
      headers = await this.authorizationProvider.getRequestHeaders(operation, copyAuthorizationInput(input));
    } catch {
      headers = null;
    }
    if (!validAuthorizationHeaders(headers)) {
      throw new StorageAdapterError('auth_required', 'Connected server credentials are unavailable', false);
    }
    return { ...headers };
  }

  private requireReady(): ReadyState {
    if (this.ready === null) {
      throw new StorageAdapterError('auth_required', 'Connected server authorization is required', false);
    }
    if (!verifyStorageCapabilityDescriptor(this.ready.descriptor, {
      now: this.now,
      expectedOperatorKey: this.expectedOperatorKey,
      allowInsecureLocalNetwork: this.allowInsecureLocalNetwork,
      requiredOperations: CONNECTED_SERVER_REQUIRED_OPERATIONS,
    })) {
      this.clearReady();
      throw new StorageAdapterError('auth_required', 'Connected server descriptor must be refreshed', false);
    }
    return this.ready;
  }

  private apiUrl(descriptor: StorageCapabilityDescriptor, relativePath: string): string {
    const base = descriptor.endpoint.endsWith('/') ? descriptor.endpoint : `${descriptor.endpoint}/`;
    const url = new URL(relativePath.replace(/^\/+/, ''), base);
    this.assertSignedApiUrl(descriptor, url.href);
    return url.href;
  }

  private assertSignedApiUrl(descriptor: StorageCapabilityDescriptor, value: string): void {
    const base = new URL(
      descriptor.endpoint.endsWith('/') ? descriptor.endpoint : `${descriptor.endpoint}/`,
    );
    const url = new URL(value);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      throw new StorageAdapterError('provider_error', 'Connected server route escaped its signed endpoint', false);
    }
  }

  private challengeUrl(descriptor: StorageCapabilityDescriptor): string {
    const expectedSuffix = STORAGE_CHALLENGE_PATH.slice(STORAGE_CHALLENGE_PATH.lastIndexOf('/') + 1);
    return this.apiUrl(descriptor, expectedSuffix);
  }

  private objectUrl(descriptor: StorageCapabilityDescriptor, objectId: string): string {
    assertObjectId(objectId);
    return this.apiUrl(descriptor, `objects/${encodeURIComponent(objectId)}`);
  }

  private resolveObjectRef(descriptor: StorageCapabilityDescriptor, ref: StorageObjectRef): string {
    const expected = this.objectUrl(descriptor, ref.objectId);
    if (ref.remoteRef === undefined) return expected;
    if (ref.remoteRef !== expected) {
      throw new StorageAdapterError('provider_error', 'Connected server remote reference escaped its endpoint', false);
    }
    return expected;
  }

  private clearReady(): void {
    this.ready = null;
    this.verifiedReadWrite = false;
  }

  private healthResult(
    state: StorageHealth['state'],
    verifiedReadWrite: boolean,
    errorCode?: string,
  ): StorageHealth {
    const now = this.now();
    const timestamp = now instanceof Date
      ? now.toISOString()
      : typeof now === 'number'
        ? new Date(now).toISOString()
        : new Date(now).toISOString();
    return {
      state,
      verifiedReadWrite,
      checkedAt: timestamp,
      ...(errorCode === undefined ? {} : { errorCode }),
    };
  }
}

export { ConnectedServerStorageAdapter as ConnectedStorageServerAdapter };

function parseUploadProgress(
  body: Record<string, unknown>,
  objectId: string,
  totalBlocks: number,
): number | null {
  if (body.ok !== true
    || body.contentId !== objectId
    || !Array.isArray(body.stored)
    || body.stored.length !== totalBlocks
    || !body.stored.every((value) => typeof value === 'boolean')
    || typeof body.complete !== 'boolean') {
    throw new StorageAdapterError('provider_error', 'Connected server upload response is malformed', false);
  }
  if (body.nextMissing === null) {
    if (body.complete !== true || body.stored.some((value) => value !== true)) {
      throw new StorageAdapterError('provider_error', 'Connected server upload completion is inconsistent', false);
    }
    return null;
  }
  if (!nonNegativeSafeInteger(body.nextMissing)
    || body.nextMissing >= totalBlocks
    || body.complete !== false
    || body.stored[body.nextMissing] !== false) {
    throw new StorageAdapterError('provider_error', 'Connected server upload cursor is invalid', false);
  }
  return body.nextMissing;
}

function parseHostedObject(value: unknown): HostedObjectWire {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || !OBJECT_ID.test(value.id)
    || !nonNegativeSafeInteger(value.encryptedBytes)
    || typeof value.ciphertextHash !== 'string'
    || !SHA512_HEX.test(value.ciphertextHash)
    || typeof value.dataClass !== 'string'
    || !DATA_CLASS.test(value.dataClass)
    || typeof value.version !== 'string'
    || value.version.length === 0
    || value.version.length > 512
    || containsControlCharacter(value.version)
    || typeof value.createdAt !== 'string'
    || !Number.isFinite(Date.parse(value.createdAt))) {
    throw new StorageAdapterError('provider_error', 'Connected server object metadata is malformed', false);
  }
  return {
    id: value.id,
    encryptedBytes: value.encryptedBytes,
    ciphertextHash: value.ciphertextHash,
    dataClass: value.dataClass,
    version: value.version,
    createdAt: value.createdAt,
  };
}

function objectMetadata(
  descriptor: StorageCapabilityDescriptor,
  object: HostedObjectWire,
): StorageObjectMetadata {
  const base = descriptor.endpoint.endsWith('/') ? descriptor.endpoint : `${descriptor.endpoint}/`;
  return {
    objectId: object.id,
    dataClass: object.dataClass,
    remoteRef: new URL(`objects/${encodeURIComponent(object.id)}`, base).href,
    remoteVersion: object.version,
    encryptedBytes: object.encryptedBytes,
    ciphertextHash: object.ciphertextHash,
  };
}

function validateStorageObject(input: EncryptedStorageObject, maximumObjectBytes: number): void {
  assertObjectId(input.objectId);
  if (!DATA_CLASS.test(input.dataClass)) {
    throw new StorageAdapterError('provider_error', 'Connected server data class is invalid', false);
  }
  if (!nonNegativeSafeInteger(input.encryptedBytes)
    || input.encryptedBytes !== input.ciphertext.length) {
    throw new StorageAdapterError('corrupt_ciphertext', 'Connected server ciphertext length is invalid', false);
  }
  if (input.encryptedBytes > maximumObjectBytes) {
    throw new StorageAdapterError('quota_exceeded', 'Ciphertext exceeds the connected server object limit', false);
  }
  if (!SHA512_HEX.test(input.ciphertextHash) || sha512Hex(input.ciphertext) !== input.ciphertextHash) {
    throw new StorageAdapterError('corrupt_ciphertext', 'Connected server ciphertext hash is invalid', false);
  }
}

function uploadSession(input: EncryptedStorageObject, totalBlocks: number): string {
  return `connected-v1:${input.objectId}:${totalBlocks}:${input.ciphertextHash}`;
}

function validateResumeToken(
  resume: StorageResumeToken,
  providerSession: string,
  encryptedBytes: number,
  uploadBlockBytes: number,
): number {
  if (resume.providerSession !== providerSession
    || !nonNegativeSafeInteger(resume.offset)
    || resume.offset >= encryptedBytes
    || resume.offset % uploadBlockBytes !== 0) {
    throw new StorageAdapterError('conflict', 'Connected server resume token is invalid', false);
  }
  return resume.offset;
}

function verifiedChecksumResult(
  input: EncryptedStorageObject,
  remoteRef: string,
  remoteVersion: string | null,
): StorageWriteResult {
  return {
    complete: true,
    verified: true,
    verification: { kind: 'provider_checksum', algorithm: 'sha512', value: input.ciphertextHash },
    remoteRef,
    remoteVersion,
    encryptedBytes: input.encryptedBytes,
    ciphertextHash: input.ciphertextHash,
  };
}

function unverifiedResult(
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

function copyAuthorizationInput(input: StorageAuthorizationInput): StorageAuthorizationInput {
  return {
    kind: input.kind,
    ...(input.accountHint === undefined ? {} : { accountHint: input.accountHint }),
    ...(input.credentialRef === undefined ? {} : { credentialRef: input.credentialRef }),
  } as StorageAuthorizationInput;
}

function validAuthorizationHeaders(value: Record<string, string> | null): value is Record<string, string> {
  if (value === null || Object.keys(value).length === 0) return false;
  const forbidden = new Set(['connection', 'content-length', 'host', 'transfer-encoding']);
  return Object.entries(value).every(([name, headerValue]) => (
    /^[A-Za-z0-9-]+$/u.test(name)
    && !forbidden.has(name.toLowerCase())
    && headerValue.length > 0
    && headerValue.length <= MAX_HEADER_VALUE_CHARS
    && !containsControlCharacter(headerValue)
  ));
}

function validateCredentialRef(value: string): string {
  if (!value || value.length > 512 || containsControlCharacter(value)) {
    throw new StorageAdapterError('provider_error', 'Connected server credential reference is invalid', false);
  }
  return value;
}

function validateRange(range: StorageByteRange): void {
  if (!nonNegativeSafeInteger(range.offset)
    || !nonNegativeSafeInteger(range.length)
    || range.offset + range.length > Number.MAX_SAFE_INTEGER) {
    throw new StorageAdapterError('provider_error', 'Connected server byte range is invalid', false);
  }
}

function validateContentRange(
  headers: Readonly<Record<string, string>>,
  requested: StorageByteRange,
  receivedBytes: number,
  maximumObjectBytes: number,
): void {
  const value = responseHeader(headers, 'content-range');
  const match = value === null ? null : /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(value);
  const start = Number(match?.[1]);
  const end = Number(match?.[2]);
  const total = Number(match?.[3]);
  if (match === null
    || !nonNegativeSafeInteger(start)
    || !nonNegativeSafeInteger(end)
    || !nonNegativeSafeInteger(total)
    || start !== requested.offset
    || end < start
    || end >= total
    || total > maximumObjectBytes
    || end - start + 1 !== receivedBytes
    || receivedBytes === 0
    || receivedBytes > requested.length) {
    throw new StorageAdapterError('provider_error', 'Connected server content-range is invalid', false);
  }
}

function assertObjectId(value: string): void {
  if (!OBJECT_ID.test(value)) {
    throw new StorageAdapterError('provider_error', 'Connected server object id is invalid', false);
  }
}

function requiredHeader(
  headers: Readonly<Record<string, string>>,
  name: string,
  maximumChars: number,
): string {
  const value = responseHeader(headers, name);
  if (value === null || value.length === 0 || value.length > maximumChars || containsControlCharacter(value)) {
    throw new StorageAdapterError('provider_error', `Connected server ${name} header is invalid`, false);
  }
  return value;
}

function requiredSha512(value: string | null): string {
  if (value === null || !SHA512_HEX.test(value)) {
    throw new StorageAdapterError('provider_error', 'Connected server checksum header is invalid', false);
  }
  return value;
}

function requiredDataClass(value: string | null): string {
  if (value === null || !DATA_CLASS.test(value)) {
    throw new StorageAdapterError('provider_error', 'Connected server data-class header is invalid', false);
  }
  return value;
}

function requiredByteCount(value: string | null): number {
  if (value === null || !/^\d+$/u.test(value)) {
    throw new StorageAdapterError('provider_error', 'Connected server byte-count header is invalid', false);
  }
  const parsed = Number(value);
  if (!nonNegativeSafeInteger(parsed)) {
    throw new StorageAdapterError('provider_error', 'Connected server byte-count header is invalid', false);
  }
  return parsed;
}

function decodeJson(body: Uint8Array, maximumBytes: number): unknown {
  if (body.length > maximumBytes) {
    throw new StorageAdapterError('provider_error', 'Connected server response exceeded the safety limit', false);
  }
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new StorageAdapterError('provider_error', 'Connected server returned malformed JSON', false);
  }
}

function decodeJsonRecord(body: Uint8Array, maximumBytes: number): Record<string, unknown> {
  const value = decodeJson(body, maximumBytes);
  if (!isRecord(value)) {
    throw new StorageAdapterError('provider_error', 'Connected server returned a malformed object', false);
  }
  return value;
}

function throwForConnectedStatus(status: number): never {
  if (status === 401 || status === 402) {
    throw new StorageAdapterError('auth_required', 'Connected server authorization is required', false);
  }
  if (status === 403) {
    throw new StorageAdapterError('revoked', 'Connected server authorization was refused', false);
  }
  if (status === 404) {
    throw new StorageAdapterError('not_found', 'Connected server object was not found', false);
  }
  if (status === 408 || status === 425) {
    throw new StorageAdapterError('unreachable', 'Connected server request could not complete', true);
  }
  if (status === 409 || status === 412 || status === 416) {
    throw new StorageAdapterError('conflict', 'Connected server object changed concurrently', false);
  }
  if (status === 413 || status === 507) {
    throw new StorageAdapterError('quota_exceeded', 'Connected server storage capacity was exceeded', false);
  }
  if (status === 429) {
    throw new StorageAdapterError('rate_limited', 'Connected server rate limit was reached', true);
  }
  if (status >= 500) {
    throw new StorageAdapterError('provider_error', 'Connected server returned a server error', true);
  }
  throw new StorageAdapterError('provider_error', 'Connected server returned an unexpected status', false);
}

function normalizeConnectedError(error: unknown): StorageAdapterError {
  return error instanceof StorageAdapterError
    ? error
    : new StorageAdapterError('provider_error', 'Connected server operation failed', false);
}

function positiveSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new StorageAdapterError('provider_error', `Connected server ${name} is invalid`, false);
  }
  return value;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
