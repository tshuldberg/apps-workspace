import { hmacSha256, sha256Bytes, sha256Hex } from '../../encryption/sha256';
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
import type {
  CredentialProvider,
  HttpTransport,
  HttpTransportResponse,
  StorageCredentialOperation,
} from './http';
import {
  assertSafeObjectId,
  bytesToBase64,
  bytesToHex,
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

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export type S3AddressingStyle = 'auto' | 'path' | 'virtual';

export interface S3AdapterOptions {
  endpoint: string;
  bucket: string;
  region: string;
  service?: string;
  prefix?: string;
  addressingStyle?: S3AddressingStyle;
  transport: HttpTransport;
  credentialProvider: CredentialProvider<S3Credentials>;
  allowInsecureLocalNetwork?: boolean;
  maximumObjectBytes?: number;
  multipartThresholdBytes?: number;
  partSizeBytes?: number;
  maximumPartsPerCall?: number;
  pageSize?: number;
  maximumResponseBytes?: number;
  maximumListPages?: number;
  now?: () => Date;
}

export interface S3SigV4Request {
  method: string;
  url: string;
  headers?: Readonly<Record<string, string>>;
  body?: Uint8Array;
  payloadHash?: string;
}

export interface S3SigV4Options {
  credentials: S3Credentials;
  region: string;
  service?: string;
  now: Date;
}

export interface S3SigV4Result {
  headers: Record<string, string>;
  signature: string;
  canonicalRequest: string;
  stringToSign: string;
  signedHeaders: string;
  payloadHash: string;
}

type ResolvedAddressingStyle = Exclude<S3AddressingStyle, 'auto'>;

interface MultipartTokenPayload {
  version: 1;
  uploadId: string;
  key: string;
}

interface UploadedPart {
  partNumber: number;
  etag: string;
  checksum: string;
  size: number;
}

const DEFAULT_MAXIMUM_OBJECT_BYTES = 5 * 1024 * 1024 * 1024 * 1024;
const DEFAULT_MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024;
const DEFAULT_PART_SIZE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAXIMUM_RESPONSE_BYTES = 4 * 1024 * 1024;
const DEFAULT_PREFIX = 'Meerkat';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAXIMUM_LIST_PAGES = 1_000;
const MAXIMUM_S3_PARTS = 10_000;
const encoder = new TextEncoder();

export class S3StorageAdapter implements StorageDestinationAdapter {
  private readonly endpoint: URL;
  private readonly bucket: string;
  private readonly region: string;
  private readonly service: string;
  private readonly prefix: string;
  private readonly configuredStyle: S3AddressingStyle;
  private readonly transport: HttpTransport;
  private readonly credentialProvider: CredentialProvider<S3Credentials>;
  private readonly maximumObjectBytes: number;
  private readonly multipartThresholdBytes: number;
  private readonly partSizeBytes: number;
  private readonly maximumPartsPerCall: number;
  private readonly pageSize: number;
  private readonly maximumResponseBytes: number;
  private readonly maximumListPages: number;
  private readonly now: () => Date;
  private resolvedStyle: ResolvedAddressingStyle | null;
  private authorized = false;
  private revoked = false;
  private verifiedReadWrite = false;

  constructor(options: S3AdapterOptions) {
    this.endpoint = parseS3Endpoint(options.endpoint, options.allowInsecureLocalNetwork === true);
    this.bucket = validateBucket(options.bucket);
    this.region = validateScopePart(options.region, 'region');
    this.service = validateScopePart(options.service ?? 's3', 'service');
    this.prefix = normalizePrefix(options.prefix ?? DEFAULT_PREFIX);
    this.configuredStyle = options.addressingStyle ?? 'auto';
    this.transport = options.transport;
    this.credentialProvider = options.credentialProvider;
    this.maximumObjectBytes = positiveSafeInteger(
      options.maximumObjectBytes ?? DEFAULT_MAXIMUM_OBJECT_BYTES,
      'maximumObjectBytes',
    );
    this.multipartThresholdBytes = positiveSafeInteger(
      options.multipartThresholdBytes ?? DEFAULT_MULTIPART_THRESHOLD_BYTES,
      'multipartThresholdBytes',
    );
    this.partSizeBytes = positiveSafeInteger(
      options.partSizeBytes ?? DEFAULT_PART_SIZE_BYTES,
      'partSizeBytes',
    );
    this.maximumPartsPerCall = positiveSafeInteger(
      options.maximumPartsPerCall ?? 1,
      'maximumPartsPerCall',
    );
    this.pageSize = positiveSafeInteger(options.pageSize ?? DEFAULT_PAGE_SIZE, 'pageSize');
    if (this.pageSize > 1_000) {
      throw new StorageAdapterError('provider_error', 'pageSize cannot exceed the S3 limit', false);
    }
    this.maximumResponseBytes = positiveSafeInteger(
      options.maximumResponseBytes ?? DEFAULT_MAXIMUM_RESPONSE_BYTES,
      'maximumResponseBytes',
    );
    this.maximumListPages = positiveSafeInteger(
      options.maximumListPages ?? DEFAULT_MAXIMUM_LIST_PAGES,
      'maximumListPages',
    );
    this.now = options.now ?? (() => new Date());
    this.resolvedStyle = this.configuredStyle === 'auto' ? null : this.configuredStyle;
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
    this.verifiedReadWrite = false;
    if (this.configuredStyle === 'auto') this.resolvedStyle = null;
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
      const style = await this.resolveAddressingStyle();
      const response = await this.signedRequest('health', 'HEAD', this.buildUrl(style), {});
      if (response.status !== 200 && response.status !== 204) throwForS3Response(response, this.maximumResponseBytes);
      return this.healthResult('ok', this.verifiedReadWrite);
    } catch (error) {
      const normalized = normalizeS3Error(error);
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
    let usedBytes = 0;
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await this.listObjects(cursor);
      for (const item of page.items) {
        usedBytes += item.encryptedBytes;
        if (!Number.isSafeInteger(usedBytes)) {
          throw new StorageAdapterError('provider_error', 'S3 usage exceeds the safe integer limit', false);
        }
      }
      cursor = page.nextCursor ?? undefined;
      pages += 1;
      if (pages > this.maximumListPages) {
        throw new StorageAdapterError('provider_error', 'S3 quota listing exceeded the page limit', false);
      }
    } while (cursor !== undefined);
    return { usedBytes, capBytes: null, estimated: true };
  }

  async putObject(
    input: EncryptedStorageObject,
    resume?: StorageResumeToken,
  ): Promise<StorageWriteResult> {
    this.requireAuthorized();
    this.validateInput(input);
    const style = await this.resolveAddressingStyle();
    const key = this.objectKey(input.objectId);
    const remoteRef = this.remoteRef(key);

    const existing = await this.headObject({ objectId: input.objectId, remoteRef });
    if (existing !== null) {
      const bytes = await this.getObject({ objectId: input.objectId, remoteRef });
      if (bytes === null) {
        throw new StorageAdapterError('conflict', 'S3 object changed during conflict inspection', false);
      }
      if (!equalBytes(bytes, input.ciphertext)) {
        throw new StorageAdapterError(
          'corrupt_ciphertext',
          'the same object id already contains different ciphertext',
          false,
        );
      }
      this.verifiedReadWrite = true;
      return completeWriteResult(
        input,
        remoteRef,
        existing.remoteVersion,
        { kind: 'read_back', ciphertextHash: input.ciphertextHash },
      );
    }

    if (input.encryptedBytes <= this.multipartThresholdBytes) {
      if (resume !== undefined) {
        throw new StorageAdapterError('conflict', 'multipart token does not match a single PUT', false);
      }
      return this.putSingleObject(input, style, key, remoteRef);
    }
    return this.putMultipartObject(input, style, key, remoteRef, resume);
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null> {
    this.requireAuthorized();
    const key = this.resolveObjectKey(ref);
    const style = await this.resolveAddressingStyle();
    const response = await this.signedRequest('read', 'HEAD', this.buildUrl(style, key), {});
    if (response.status === 404) return null;
    if (response.status !== 200 && response.status !== 204) throwForS3Response(response, this.maximumResponseBytes);
    return {
      objectId: ref.objectId,
      dataClass: safeMetadataValue(
        responseHeader(response.headers, 'x-amz-meta-mylife-data-class') ?? '',
      ),
      remoteRef: this.remoteRef(key),
      remoteVersion: normalizeEtag(responseHeader(response.headers, 'etag')),
      encryptedBytes: parseRequiredByteCount(responseHeader(response.headers, 'content-length'), 'S3'),
      ciphertextHash: null,
    };
  }

  async getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null> {
    this.requireAuthorized();
    const key = this.resolveObjectKey(ref);
    const style = await this.resolveAddressingStyle();
    const headers: Record<string, string> = {};
    if (range !== undefined) {
      validateRange(range);
      if (range.length === 0) return new Uint8Array(0);
      headers.range = `bytes=${range.offset}-${range.offset + range.length - 1}`;
    }
    const response = await this.signedRequest('read', 'GET', this.buildUrl(style, key), headers);
    if (response.status === 404) return null;
    if (response.status !== 200 && !(range !== undefined && response.status === 206)) {
      throwForS3Response(response, this.maximumResponseBytes);
    }
    if (response.body.length > this.maximumObjectBytes) {
      throw new StorageAdapterError('provider_error', 'S3 object exceeds the configured limit', false);
    }
    if (range !== undefined && response.status === 200) {
      if (range.offset > response.body.length) {
        throw new StorageAdapterError('provider_error', 'S3 ignored an invalid byte range', false);
      }
      return response.body.slice(range.offset, range.offset + range.length);
    }
    if (range !== undefined && response.body.length > range.length) {
      throw new StorageAdapterError('provider_error', 'S3 returned more range bytes than requested', false);
    }
    return response.body.slice();
  }

  async listObjects(cursor?: string): Promise<StorageObjectPage> {
    this.requireAuthorized();
    validateS3Cursor(cursor);
    const style = await this.resolveAddressingStyle();
    const query: Array<readonly [string, string]> = [
      ['list-type', '2'],
      ['max-keys', String(this.pageSize)],
      ['prefix', this.prefix],
    ];
    if (cursor !== undefined) query.push(['continuation-token', cursor]);
    const response = await this.signedRequest('list', 'GET', this.buildUrl(style, undefined, query), {});
    if (response.status !== 200) throwForS3Response(response, this.maximumResponseBytes);
    const xml = decodeBoundedText(response.body, this.maximumResponseBytes);
    const items = xmlElementBlocks(xml, 'Contents').map((block) => this.parseListObject(block));
    if (items.length > this.pageSize) {
      throw new StorageAdapterError('provider_error', 'S3 returned more list objects than requested', false);
    }
    const truncated = xmlElementText(xml, 'IsTruncated')?.toLowerCase() === 'true';
    const nextCursor = truncated ? xmlElementText(xml, 'NextContinuationToken') : null;
    if (truncated && nextCursor === null) {
      throw new StorageAdapterError('provider_error', 'S3 omitted the continuation token', false);
    }
    validateS3Cursor(nextCursor ?? undefined);
    return { items, nextCursor };
  }

  async deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult> {
    this.requireAuthorized();
    const key = this.resolveObjectKey(ref);
    const remoteRef = this.remoteRef(key);
    const existing = await this.headObject({ objectId: ref.objectId, remoteRef });
    if (existing === null) return { deleted: false, remoteRef };
    const style = await this.resolveAddressingStyle();
    const response = await this.signedRequest('delete', 'DELETE', this.buildUrl(style, key), {});
    if (response.status !== 200 && response.status !== 202 && response.status !== 204) {
      throwForS3Response(response, this.maximumResponseBytes);
    }
    return { deleted: true, remoteRef };
  }

  private async putSingleObject(
    input: EncryptedStorageObject,
    style: ResolvedAddressingStyle,
    key: string,
    remoteRef: string,
  ): Promise<StorageWriteResult> {
    const checksum = bytesToBase64(sha256Bytes(input.ciphertext));
    const response = await this.signedRequest('write', 'PUT', this.buildUrl(style, key), {
      'content-type': 'application/octet-stream',
      'if-none-match': '*',
      'x-amz-checksum-sha256': checksum,
      'x-amz-meta-mylife-data-class': safeMetadataValue(input.dataClass),
    }, input.ciphertext);
    if (response.status !== 200 && response.status !== 201 && response.status !== 204) {
      throwForS3Response(response, this.maximumResponseBytes);
    }
    const remoteVersion = normalizeEtag(responseHeader(response.headers, 'etag'));
    const echoedChecksum = responseHeader(response.headers, 'x-amz-checksum-sha256')?.trim() ?? null;
    if (echoedChecksum === checksum) {
      this.verifiedReadWrite = true;
      return completeWriteResult(
        input,
        remoteRef,
        remoteVersion,
        { kind: 'provider_checksum', algorithm: 'sha256', value: checksum },
      );
    }
    const evidence = await this.readBackEvidence(input, remoteRef);
    if (evidence !== null) this.verifiedReadWrite = true;
    return completeWriteResult(input, remoteRef, remoteVersion, evidence);
  }

  private async putMultipartObject(
    input: EncryptedStorageObject,
    style: ResolvedAddressingStyle,
    key: string,
    remoteRef: string,
    resume: StorageResumeToken | undefined,
  ): Promise<StorageWriteResult> {
    const totalParts = Math.ceil(input.encryptedBytes / this.partSizeBytes);
    if (totalParts > MAXIMUM_S3_PARTS) {
      throw new StorageAdapterError('quota_exceeded', 'ciphertext requires too many S3 parts', false);
    }

    let uploadId: string;
    let callerHasToken = resume !== undefined;
    if (resume === undefined) {
      uploadId = await this.createMultipartUpload(style, key, input.dataClass);
    } else {
      const token = decodeMultipartToken(resume.providerSession, key);
      uploadId = token.uploadId;
    }

    let completionStarted = false;
    let completionSucceeded = false;
    try {
      const parts = resume === undefined
        ? []
        : await this.listUploadedParts(style, key, uploadId, input);
      let offset = parts.reduce((total, part) => total + part.size, 0);
      if (!Number.isSafeInteger(offset) || (resume !== undefined && offset < resume.offset)) {
        throw new StorageAdapterError('conflict', 'S3 multipart cursor does not match uploaded parts', false);
      }
      if (resume !== undefined && resume.offset > input.encryptedBytes) {
        throw new StorageAdapterError('conflict', 'S3 multipart cursor exceeds the object', false);
      }

      let uploadedThisCall = 0;
      while (offset < input.encryptedBytes && uploadedThisCall < this.maximumPartsPerCall) {
        const partNumber = parts.length + 1;
        const end = Math.min(offset + this.partSizeBytes, input.encryptedBytes);
        const bytes = input.ciphertext.slice(offset, end);
        const part = await this.uploadPart(style, key, uploadId, partNumber, bytes);
        parts.push(part);
        offset = end;
        uploadedThisCall += 1;
      }

      if (offset < input.encryptedBytes) {
        callerHasToken = true;
        return {
          complete: false,
          verified: false,
          verification: { kind: 'none' },
          remoteRef,
          remoteVersion: null,
          encryptedBytes: offset,
          ciphertextHash: input.ciphertextHash,
          resumeToken: {
            providerSession: encodeMultipartToken({ version: 1, uploadId, key }),
            offset,
          },
        };
      }

      completionStarted = true;
      const completed = await this.completeMultipartUpload(style, key, uploadId, parts);
      completionSucceeded = true;
      const fullChecksum = bytesToBase64(sha256Bytes(input.ciphertext));
      if (completed.checksum === fullChecksum) {
        this.verifiedReadWrite = true;
        return completeWriteResult(
          input,
          remoteRef,
          completed.etag,
          { kind: 'provider_checksum', algorithm: 'sha256', value: fullChecksum },
        );
      }
      const evidence = await this.readBackEvidence(input, remoteRef);
      if (evidence !== null) this.verifiedReadWrite = true;
      return completeWriteResult(input, remoteRef, completed.etag, evidence);
    } catch (error) {
      const normalized = normalizeS3Error(error);
      if (
        !completionSucceeded
        && (completionStarted || !callerHasToken || !normalized.retryable)
      ) {
        await this.abortMultipartUploadBestEffort(style, key, uploadId);
      }
      throw normalized;
    }
  }

  private async createMultipartUpload(
    style: ResolvedAddressingStyle,
    key: string,
    dataClass: string,
  ): Promise<string> {
    const response = await this.signedRequest(
      'write',
      'POST',
      this.buildUrl(style, key, [['uploads', '']]),
      {
        'content-type': 'application/octet-stream',
        'x-amz-checksum-algorithm': 'SHA256',
        'x-amz-meta-mylife-data-class': safeMetadataValue(dataClass),
      },
      new Uint8Array(0),
    );
    if (response.status !== 200) throwForS3Response(response, this.maximumResponseBytes);
    const xml = decodeBoundedText(response.body, this.maximumResponseBytes);
    const uploadId = xmlElementText(xml, 'UploadId');
    if (
      uploadId === null
      || uploadId.length === 0
      || uploadId.length > 2_048
      || containsControlCharacter(uploadId)
    ) {
      throw new StorageAdapterError('provider_error', 'S3 returned an invalid multipart upload id', false);
    }
    return uploadId;
  }

  private async uploadPart(
    style: ResolvedAddressingStyle,
    key: string,
    uploadId: string,
    partNumber: number,
    bytes: Uint8Array,
  ): Promise<UploadedPart> {
    const checksum = bytesToBase64(sha256Bytes(bytes));
    const response = await this.signedRequest(
      'write',
      'PUT',
      this.buildUrl(style, key, [
        ['partNumber', String(partNumber)],
        ['uploadId', uploadId],
      ]),
      { 'x-amz-checksum-sha256': checksum },
      bytes,
    );
    if (response.status !== 200) throwForS3Response(response, this.maximumResponseBytes);
    const etag = normalizeEtag(responseHeader(response.headers, 'etag'));
    if (etag === null) {
      throw new StorageAdapterError('provider_error', 'S3 upload part omitted its version token', false);
    }
    const echoedChecksum = responseHeader(response.headers, 'x-amz-checksum-sha256')?.trim();
    if (echoedChecksum !== undefined && echoedChecksum !== checksum) {
      throw new StorageAdapterError('corrupt_ciphertext', 'S3 upload part checksum did not match', false);
    }
    return { partNumber, etag, checksum, size: bytes.length };
  }

  private async listUploadedParts(
    style: ResolvedAddressingStyle,
    key: string,
    uploadId: string,
    input: EncryptedStorageObject,
  ): Promise<UploadedPart[]> {
    const parts: UploadedPart[] = [];
    let marker: string | null = null;
    let pages = 0;
    do {
      const query: Array<readonly [string, string]> = [['uploadId', uploadId]];
      if (marker !== null) query.push(['part-number-marker', marker]);
      const response = await this.signedRequest('write', 'GET', this.buildUrl(style, key, query), {});
      if (response.status === 404) {
        throw new StorageAdapterError('conflict', 'S3 multipart upload no longer exists', false);
      }
      if (response.status !== 200) throwForS3Response(response, this.maximumResponseBytes);
      const xml = decodeBoundedText(response.body, this.maximumResponseBytes);
      for (const block of xmlElementBlocks(xml, 'Part')) {
        const partNumber = parseRequiredPositiveInteger(xmlElementText(block, 'PartNumber'), 'part number');
        const size = parseRequiredByteCount(xmlElementText(block, 'Size'), 'S3 part');
        const etag = normalizeEtag(xmlElementText(block, 'ETag'));
        if (etag === null || partNumber !== parts.length + 1) {
          throw new StorageAdapterError('conflict', 'S3 multipart part list is not contiguous', false);
        }
        const expectedOffset = (partNumber - 1) * this.partSizeBytes;
        const expectedBytes = input.ciphertext.slice(
          expectedOffset,
          Math.min(expectedOffset + this.partSizeBytes, input.encryptedBytes),
        );
        if (size !== expectedBytes.length || size === 0) {
          throw new StorageAdapterError('conflict', 'S3 multipart part size does not match the cursor', false);
        }
        const expectedChecksum = bytesToBase64(sha256Bytes(expectedBytes));
        const providerChecksum = xmlElementText(block, 'ChecksumSHA256');
        if (providerChecksum !== null && providerChecksum !== expectedChecksum) {
          throw new StorageAdapterError('corrupt_ciphertext', 'S3 multipart part checksum did not match', false);
        }
        parts.push({ partNumber, size, etag, checksum: expectedChecksum });
      }
      const truncated = xmlElementText(xml, 'IsTruncated')?.toLowerCase() === 'true';
      marker = truncated ? xmlElementText(xml, 'NextPartNumberMarker') : null;
      if (truncated && marker === null) {
        throw new StorageAdapterError('provider_error', 'S3 omitted the part-list marker', false);
      }
      pages += 1;
      if (pages > this.maximumListPages || parts.length > MAXIMUM_S3_PARTS) {
        throw new StorageAdapterError('provider_error', 'S3 multipart listing exceeded the safety limit', false);
      }
    } while (marker !== null);
    return parts;
  }

  private async completeMultipartUpload(
    style: ResolvedAddressingStyle,
    key: string,
    uploadId: string,
    parts: readonly UploadedPart[],
  ): Promise<{ checksum: string | null; etag: string | null }> {
    const body = encoder.encode(
      '<CompleteMultipartUpload>'
      + parts.map((part) => '<Part>'
        + `<PartNumber>${part.partNumber}</PartNumber>`
        + `<ETag>${escapeXml(part.etag)}</ETag>`
        + `<ChecksumSHA256>${part.checksum}</ChecksumSHA256>`
        + '</Part>').join('')
      + '</CompleteMultipartUpload>',
    );
    const response = await this.signedRequest(
      'write',
      'POST',
      this.buildUrl(style, key, [['uploadId', uploadId]]),
      { 'content-type': 'application/xml' },
      body,
    );
    if (response.status !== 200) throwForS3Response(response, this.maximumResponseBytes);
    const xml = decodeBoundedText(response.body, this.maximumResponseBytes);
    if (xmlElementText(xml, 'Code') !== null && /<\s*(?:[A-Za-z_][\w.-]*:)?Error\b/i.test(xml)) {
      throw new StorageAdapterError('provider_error', 'S3 rejected multipart completion', true);
    }
    return {
      checksum: responseHeader(response.headers, 'x-amz-checksum-sha256')?.trim()
        ?? xmlElementText(xml, 'ChecksumSHA256'),
      etag: normalizeEtag(responseHeader(response.headers, 'etag') ?? xmlElementText(xml, 'ETag')),
    };
  }

  private async abortMultipartUploadBestEffort(
    style: ResolvedAddressingStyle,
    key: string,
    uploadId: string,
  ): Promise<void> {
    try {
      const response = await this.signedRequest(
        'write',
        'DELETE',
        this.buildUrl(style, key, [['uploadId', uploadId]]),
        {},
      );
      if (![200, 202, 204, 404].includes(response.status)) {
        throwForS3Response(response, this.maximumResponseBytes);
      }
    } catch {
      // The original multipart failure remains the actionable error.
    }
  }

  private async readBackEvidence(
    input: EncryptedStorageObject,
    remoteRef: string,
  ): Promise<StorageVerificationEvidence | null> {
    const bytes = await this.getObject({ objectId: input.objectId, remoteRef });
    if (bytes === null) return null;
    if (!equalBytes(bytes, input.ciphertext) || sha512Hex(bytes) !== input.ciphertextHash) {
      throw new StorageAdapterError('corrupt_ciphertext', 'S3 read-back did not match ciphertext', false);
    }
    return { kind: 'read_back', ciphertextHash: input.ciphertextHash };
  }

  private async resolveAddressingStyle(): Promise<ResolvedAddressingStyle> {
    if (this.resolvedStyle !== null) return this.resolvedStyle;
    const candidates = automaticStyleCandidates(this.endpoint, this.bucket);
    let lastResponse: HttpTransportResponse | null = null;
    for (const style of candidates) {
      const response = await this.signedRequest('health', 'HEAD', this.buildUrl(style), {});
      if (response.status === 200 || response.status === 204) {
        this.resolvedStyle = style;
        return style;
      }
      lastResponse = response;
      if (response.status !== 400 && response.status !== 404 && response.status !== 405) {
        throwForS3Response(response, this.maximumResponseBytes);
      }
    }
    if (lastResponse !== null) throwForS3Response(lastResponse, this.maximumResponseBytes);
    throw new StorageAdapterError('provider_error', 'S3 addressing style could not be resolved', false);
  }

  private async signedRequest(
    operation: StorageCredentialOperation,
    method: string,
    url: URL,
    headers: Record<string, string>,
    body?: Uint8Array,
  ): Promise<HttpTransportResponse> {
    this.requireAuthorized();
    const result = await requestWithSingleOriginRedirect(
      this.transport,
      url.href,
      async (requestUrl) => {
        const credentials = await this.requireCredentials(operation);
        const signed = signS3Request(
          {
            method,
            url: requestUrl,
            headers,
            ...(body === undefined ? {} : { body }),
          },
          {
            credentials,
            region: this.region,
            service: this.service,
            now: this.now(),
          },
        );
        return {
          method,
          url: requestUrl,
          headers: signed.headers,
          ...(body === undefined ? {} : { body }),
        };
      },
    );
    return result.response;
  }

  private buildUrl(
    style: ResolvedAddressingStyle,
    key?: string,
    query: readonly (readonly [string, string])[] = [],
  ): URL {
    const url = new URL(this.endpoint.href);
    if (style === 'virtual') url.hostname = `${this.bucket}.${url.hostname}`;
    const basePath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    const segments = [
      ...(style === 'path' ? [this.bucket] : []),
      ...(key === undefined ? [] : key.split('/')),
    ];
    const suffix = segments.map(awsUriEncode).join('/');
    url.pathname = `${basePath}/${suffix}`.replace(/\/{2,}/g, '/');
    url.search = '';
    for (const [name, value] of query) url.searchParams.append(name, value);
    return url;
  }

  private objectKey(objectId: string): string {
    assertSafeObjectId(objectId);
    return `${this.prefix}${objectId}`;
  }

  private remoteRef(key: string): string {
    return `s3://${this.bucket}/${key.split('/').map(awsUriEncode).join('/')}`;
  }

  private resolveObjectKey(ref: StorageObjectRef): string {
    const expectedKey = this.objectKey(ref.objectId);
    const expectedRef = this.remoteRef(expectedKey);
    if (ref.remoteRef !== undefined && ref.remoteRef !== expectedRef) {
      throw new StorageAdapterError('provider_error', 'S3 remote reference escaped the app root', false);
    }
    return expectedKey;
  }

  private parseListObject(xml: string): StorageObjectMetadata {
    const key = xmlElementText(xml, 'Key');
    if (key === null || !key.startsWith(this.prefix)) {
      throw new StorageAdapterError('provider_error', 'S3 listing escaped the app prefix', false);
    }
    const objectId = key.slice(this.prefix.length);
    assertSafeObjectId(objectId);
    if (key !== this.objectKey(objectId)) {
      throw new StorageAdapterError('provider_error', 'S3 listing contained a nested object key', false);
    }
    return {
      objectId,
      dataClass: 'encrypted_object',
      remoteRef: this.remoteRef(key),
      remoteVersion: normalizeEtag(xmlElementText(xml, 'ETag')),
      encryptedBytes: parseRequiredByteCount(xmlElementText(xml, 'Size'), 'S3'),
      ciphertextHash: null,
    };
  }

  private async requireCredentials(operation: StorageCredentialOperation): Promise<S3Credentials> {
    let credentials: S3Credentials | null;
    try {
      credentials = await this.credentialProvider.get(operation);
    } catch {
      throw new StorageAdapterError('auth_required', 'S3 credentials are unavailable', false);
    }
    if (!validS3Credentials(credentials)) {
      throw new StorageAdapterError('auth_required', 'S3 credentials are unavailable', false);
    }
    return credentials;
  }

  private async readCredentialsForAuthorization(): Promise<S3Credentials | null> {
    try {
      const credentials = await this.credentialProvider.get('health');
      return validS3Credentials(credentials) ? credentials : null;
    } catch {
      return null;
    }
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
      throw new StorageAdapterError('quota_exceeded', 'ciphertext exceeds the S3 object limit', false);
    }
    if (sha512Hex(input.ciphertext) !== input.ciphertextHash) {
      throw new StorageAdapterError('corrupt_ciphertext', 'ciphertext SHA-512 does not match bytes', false);
    }
  }

  private requireAuthorized(): void {
    if (!this.authorized) {
      throw new StorageAdapterError('auth_required', 'S3 authorization is required', false);
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
      checkedAt: this.now().toISOString(),
      ...(errorCode === undefined ? {} : { errorCode }),
    };
  }
}

/** Create canonical SigV4 headers and expose intermediate values for known-answer tests. */
export function signS3Request(request: S3SigV4Request, options: S3SigV4Options): S3SigV4Result {
  const url = new URL(request.url);
  const credentials = options.credentials;
  if (!validS3Credentials(credentials)) {
    throw new StorageAdapterError('auth_required', 'S3 credentials are unavailable', false);
  }
  const region = validateScopePart(options.region, 'region');
  const service = validateScopePart(options.service ?? 's3', 'service');
  const amzDate = formatAmzDate(options.now);
  const shortDate = amzDate.slice(0, 8);
  const payloadHash = request.payloadHash ?? sha256Hex(request.body ?? new Uint8Array(0));
  if (payloadHash !== 'UNSIGNED-PAYLOAD' && !/^[0-9a-f]{64}$/.test(payloadHash)) {
    throw new StorageAdapterError('provider_error', 'S3 payload hash is invalid', false);
  }

  const canonicalHeaderMap = canonicalizeHeaderMap(request.headers ?? {});
  canonicalHeaderMap.set('host', url.host);
  canonicalHeaderMap.set('x-amz-content-sha256', payloadHash);
  canonicalHeaderMap.set('x-amz-date', amzDate);
  if (credentials.sessionToken !== undefined) {
    canonicalHeaderMap.set('x-amz-security-token', normalizeHeaderValue(credentials.sessionToken));
  }
  const headerNames = [...canonicalHeaderMap.keys()].sort();
  const signedHeaders = headerNames.join(';');
  const canonicalHeaders = headerNames
    .map((name) => `${name}:${canonicalHeaderMap.get(name) ?? ''}\n`)
    .join('');
  const canonicalRequest = [
    request.method.toUpperCase(),
    canonicalUri(url),
    canonicalQuery(url),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${shortDate}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(encoder.encode(canonicalRequest)),
  ].join('\n');

  const secret = encoder.encode(`AWS4${credentials.secretAccessKey}`);
  const dateKey = hmacSha256(secret, encoder.encode(shortDate));
  const regionKey = hmacSha256(dateKey, encoder.encode(region));
  const serviceKey = hmacSha256(regionKey, encoder.encode(service));
  const signingKey = hmacSha256(serviceKey, encoder.encode('aws4_request'));
  const signatureBytes = hmacSha256(signingKey, encoder.encode(stringToSign));
  const signature = bytesToHex(signatureBytes);
  secret.fill(0);
  dateKey.fill(0);
  regionKey.fill(0);
  serviceKey.fill(0);
  signingKey.fill(0);
  signatureBytes.fill(0);

  const headers: Record<string, string> = {};
  for (const name of headerNames) headers[name] = canonicalHeaderMap.get(name) ?? '';
  headers.Authorization = 'AWS4-HMAC-SHA256 '
    + `Credential=${credentials.accessKeyId}/${scope},`
    + `SignedHeaders=${signedHeaders},`
    + `Signature=${signature}`;
  return { headers, signature, canonicalRequest, stringToSign, signedHeaders, payloadHash };
}

function parseS3Endpoint(value: string, allowInsecureLocalNetwork: boolean): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StorageAdapterError('provider_error', 'S3 endpoint is invalid', false);
  }
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new StorageAdapterError('provider_error', 'S3 endpoint contains unsupported components', false);
  }
  if (url.protocol !== 'https:') {
    if (
      url.protocol !== 'http:'
      || !allowInsecureLocalNetwork
      || !isPrivateOrLocalHost(url.hostname)
    ) {
      throw new StorageAdapterError('provider_error', 'S3 requires HTTPS outside a private network', false);
    }
  }
  return url;
}

function validateBucket(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]{1,61}[A-Za-z0-9]$/.test(value) || value.includes('..')) {
    throw new StorageAdapterError('provider_error', 'S3 bucket name is invalid', false);
  }
  return value;
}

function validateScopePart(value: string, label: string): string {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(value)) {
    throw new StorageAdapterError('provider_error', `S3 ${label} is invalid`, false);
  }
  return value;
}

function normalizePrefix(value: string): string {
  const trimmed = value.replace(/^\/+|\/+$/g, '');
  if (trimmed.length === 0) {
    throw new StorageAdapterError('provider_error', 'S3 app prefix is empty', false);
  }
  const segments = trimmed.split('/');
  for (const segment of segments) assertSafeObjectId(segment);
  return `${segments.join('/')}/`;
}

function automaticStyleCandidates(endpoint: URL, bucket: string): readonly ResolvedAddressingStyle[] {
  const virtualCompatible = isDnsCompatibleBucket(bucket)
    && !isIpAddress(endpoint.hostname)
    && endpoint.hostname.toLowerCase() !== 'localhost'
    && !(endpoint.protocol === 'https:' && bucket.includes('.'));
  return virtualCompatible ? ['virtual', 'path'] : ['path'];
}

function isDnsCompatibleBucket(bucket: string): boolean {
  return bucket === bucket.toLowerCase()
    && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)
    && !bucket.includes('..');
}

function isIpAddress(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
}

function validS3Credentials(credentials: unknown): credentials is S3Credentials {
  if (!isRecord(credentials)) return false;
  const accessKeyId = credentials.accessKeyId;
  const secretAccessKey = credentials.secretAccessKey;
  const sessionToken = credentials.sessionToken;
  return typeof accessKeyId === 'string'
    && /^[A-Za-z0-9/+=._-]{3,256}$/.test(accessKeyId)
    && typeof secretAccessKey === 'string'
    && secretAccessKey.length > 0
    && secretAccessKey.length <= 1_024
    && !containsControlCharacter(secretAccessKey)
    && (sessionToken === undefined
      || (typeof sessionToken === 'string'
        && sessionToken.length > 0
        && sessionToken.length <= 8_192
        && !containsControlCharacter(sessionToken)));
}

function canonicalizeHeaderMap(headers: Readonly<Record<string, string>>): Map<string, string> {
  const output = new Map<string, string>();
  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = rawName.trim().toLowerCase();
    if (!/^[a-z0-9!#$%&'*+.^_`|~-]+$/.test(name) || name === 'authorization') continue;
    const value = rawValue.trim().replace(/[\t\n\r ]+/g, ' ');
    const prior = output.get(name);
    output.set(name, prior === undefined ? value : `${prior},${value}`);
  }
  return output;
}

function canonicalUri(url: URL): string {
  return url.pathname
    .split('/')
    .map((segment) => {
      try {
        return awsUriEncode(decodeURIComponent(segment));
      } catch {
        throw new StorageAdapterError('provider_error', 'S3 request path is invalid', false);
      }
    })
    .join('/');
}

function canonicalQuery(url: URL): string {
  return [...url.searchParams.entries()]
    .map(([name, value]) => [awsUriEncode(name), awsUriEncode(value)] as const)
    .sort(([leftName, leftValue], [rightName, rightValue]) => {
      const nameOrder = compareCodeUnits(leftName, rightName);
      return nameOrder === 0 ? compareCodeUnits(leftValue, rightValue) : nameOrder;
    })
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
}

function awsUriEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ));
}

function formatAmzDate(date: Date): string {
  if (!Number.isFinite(date.getTime())) {
    throw new StorageAdapterError('provider_error', 'S3 signing date is invalid', false);
  }
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
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

function parseRequiredByteCount(value: string | null, provider: string): number {
  if (value === null || !/^[0-9]+$/.test(value)) {
    throw new StorageAdapterError('provider_error', `${provider} response omitted a valid byte count`, false);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new StorageAdapterError('provider_error', `${provider} byte count exceeds the safe limit`, false);
  }
  return parsed;
}

function parseRequiredPositiveInteger(value: string | null, label: string): number {
  const parsed = parseRequiredByteCount(value, `S3 ${label}`);
  if (parsed <= 0) {
    throw new StorageAdapterError('provider_error', `S3 ${label} must be positive`, false);
  }
  return parsed;
}

function normalizeEtag(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.length > 1_024 || containsControlCharacter(trimmed)
    ? null
    : trimmed;
}

function safeMetadataValue(value: string): string {
  return /^[A-Za-z0-9._-]{1,100}$/.test(value) ? value : 'encrypted_object';
}

function validateS3Cursor(cursor: string | undefined): void {
  if (
    cursor !== undefined
    && (cursor.length === 0 || cursor.length > 4_096 || containsControlCharacter(cursor))
  ) {
    throw new StorageAdapterError('provider_error', 'S3 list cursor is invalid', false);
  }
}

function encodeMultipartToken(payload: MultipartTokenPayload): string {
  return `s3-multipart-v1:${encodeURIComponent(JSON.stringify(payload))}`;
}

function decodeMultipartToken(value: string, expectedKey: string): MultipartTokenPayload {
  const prefix = 's3-multipart-v1:';
  if (!value.startsWith(prefix) || value.length > 8_192) {
    throw new StorageAdapterError('conflict', 'S3 multipart token is invalid', false);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(value.slice(prefix.length)));
  } catch {
    throw new StorageAdapterError('conflict', 'S3 multipart token is invalid', false);
  }
  if (!isRecord(parsed)) {
    throw new StorageAdapterError('conflict', 'S3 multipart token is invalid', false);
  }
  const version = parsed.version;
  const uploadId = parsed.uploadId;
  const key = parsed.key;
  if (
    version !== 1
    || typeof uploadId !== 'string'
    || uploadId.length === 0
    || uploadId.length > 2_048
    || containsControlCharacter(uploadId)
    || key !== expectedKey
  ) {
    throw new StorageAdapterError('conflict', 'S3 multipart token does not match the object', false);
  }
  return { version: 1, uploadId, key: expectedKey };
}

function completeWriteResult(
  input: EncryptedStorageObject,
  remoteRef: string,
  remoteVersion: string | null,
  evidence: StorageVerificationEvidence | null,
): StorageWriteResult {
  if (evidence === null || evidence.kind === 'none') {
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
  return {
    complete: true,
    verified: true,
    verification: evidence,
    remoteRef,
    remoteVersion,
    encryptedBytes: input.encryptedBytes,
    ciphertextHash: input.ciphertextHash,
  };
}

function throwForS3Response(response: HttpTransportResponse, maximumResponseBytes: number): never {
  const xml = response.body.length === 0 ? '' : decodeBoundedText(response.body, maximumResponseBytes);
  const code = xmlElementText(xml, 'Code');
  if (code === 'ExpiredToken' || code === 'InvalidToken') {
    throw new StorageAdapterError('auth_required', 'S3 temporary authorization expired', false);
  }
  if (code === 'AccessDenied' || code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch') {
    throw new StorageAdapterError('revoked', 'S3 authorization was refused', false);
  }
  if (code === 'SlowDown' || code === 'Throttling') {
    throw new StorageAdapterError('rate_limited', 'S3 rate limit was reached', true);
  }
  if (code === 'NoSuchKey' || code === 'NoSuchBucket') {
    throw new StorageAdapterError('not_found', 'S3 resource was not found', false);
  }
  if (code === 'EntityTooLarge' || code === 'QuotaExceeded' || code === 'InsufficientStorage') {
    throw new StorageAdapterError('quota_exceeded', 'S3 storage capacity was exceeded', false);
  }
  if (code === 'BadDigest' || code === 'InvalidPart') {
    throw new StorageAdapterError('corrupt_ciphertext', 'S3 rejected ciphertext integrity', false);
  }
  if (code === 'PreconditionFailed' || code === 'ConditionalRequestConflict') {
    throw new StorageAdapterError('conflict', 'S3 object changed concurrently', false);
  }
  throwForHttpStatus(response.status, 'S3');
}

function normalizeS3Error(error: unknown): StorageAdapterError {
  return error instanceof StorageAdapterError
    ? error
    : new StorageAdapterError('provider_error', 'S3 operation failed', false);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeHeaderValue(value: string): string {
  return value.trim().replace(/[\t\n\r ]+/g, ' ');
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
