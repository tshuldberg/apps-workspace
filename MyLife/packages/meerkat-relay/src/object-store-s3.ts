/**
 * S3-backed MeerkatObjectStore (WP-2B) plus the presigner the hosted metadata store needs.
 *
 * This adapter maps the one object-store contract (object-store.ts) onto @aws-sdk/client-s3
 * without changing the contract. Every honesty decision the contract demands is encoded here,
 * not merely documented; the header records the ones that are not obvious from the code.
 *
 * STATE + VERSION LIVE IN OBJECT METADATA, NOT IN A VERSIONED BUCKET.
 *  - A stored object's durability state (`quarantined` | `durable` | `rejected`) rides in the
 *    user metadata header `x-amz-meta-mk-state`. A `rejected` finalize stores a ZERO-BYTE
 *    object (no retrievable bytes) whose metadata records the observed mismatch; a serve path
 *    reading a `rejected` object gets no bytes, and observe() surfaces `state: 'rejected'` so
 *    it can never be promoted or served. `quarantined` and `durable` objects carry the real
 *    bytes. We do NOT require S3 bucket versioning: correctness comes from our own metadata,
 *    so the adapter works against a plain bucket (MinIO default, plain S3).
 *  - The contract's monotonic per-key `versionId` maps onto a per-key version COUNTER we carry
 *    in `x-amz-meta-mk-version`. Because the contract requires the counter to survive a
 *    delete-then-rewrite of the same key (a deleted S3 object takes its metadata with it), the
 *    high-water mark is persisted in a bytes-free SIDECAR object under a reserved prefix
 *    (`__mkver/<b64url(key)>`, zero bytes, counter in `x-amz-meta-mk-version`). The sidecar is
 *    never listed as inventory (the prefix is excluded) and never served; it exists only so a
 *    rewritten key's version strictly exceeds every prior generation, exactly like the file
 *    adapter's `versionCounters` map. The write path reads the sidecar, increments, writes the
 *    object with the new counter, then advances the sidecar. This read-increment-write is NOT
 *    atomic under two concurrent writers to the SAME key (S3 offers no compare-and-set here);
 *    correctness relies on the upstream fenced metadata flows already serializing same-key
 *    writers (the hosted metadata store's fencing token, the archive lifecycle's per-key job),
 *    so no two uncoordinated writers ever race the same key's counter.
 *
 * WHOLE-OBJECT CHECKSUM IS VERIFIED BY READ-BACK, NOT BY S3 COMPOSITE CHECKSUM.
 *  - S3 multipart composite checksums (and ETags) are hashes-of-hashes, NOT the whole-object
 *    sha256, so they cannot verify the content address the contract is built on. This adapter
 *    therefore verifies the WHOLE-OBJECT sha256 by streaming the stored object back through an
 *    incremental sha256 (GetObject -> createHash) at every point the contract says a checksum
 *    must be verified before bytes become observable: after a single-shot put, after
 *    CompleteMultipartUpload, and after the promote CopyObject. This is the same honesty the
 *    file adapter uses (re-verify by streaming hash before flipping state); it needs no local
 *    part-manifest state, so a multipart upload split across two adapter INSTANCES verifies
 *    correctly, because the verification reads S3's own assembled object rather than any bytes
 *    the instance happened to hold. Memory stays bounded: the read-back is streamed, never
 *    buffered whole.
 *  - On a mismatch, the just-written object is deleted and replaced by the bytes-free
 *    `rejected` marker, so a mismatched finalize never leaves retrievable bytes.
 *
 * PROMOTE IS SERVER-SIDE COPY + READ-BACK VERIFY.
 *  - promote does a server-side CopyObject from the quarantine key to the durable key, then
 *    re-verifies the durable object's whole-object sha256 by read-back before its metadata is
 *    flipped to `durable`; only then is the quarantine object deleted. A mismatch leaves the
 *    durable key unwritten (the copy is removed) and the quarantine object intact.
 *
 * UNAVAILABILITY IS TYPED DISTINCTLY FROM ABSENCE.
 *  - Only a clean S3 "no such key" (404 / NoSuchKey / NotFound) is absence (null). Every other
 *    SDK or network fault wraps into ObjectStoreUnavailableError, so a storage fault can never
 *    masquerade as a missing object. Transient faults are retried a bounded number of times
 *    with jittered backoff; a persistent fault still surfaces as unavailable, never as absence.
 *
 * PRESIGNER.
 *  - The adapter also implements HostedUploadTargetPresigner: a presigned PUT whose signature
 *    binds the exact content length and the x-amz-content-sha256 the caller declared, so a
 *    client cannot upload different or larger bytes than the metadata store reserved. Only a
 *    network store can mint one, which is why the hosted adapter injects it from here.
 *
 * CONFIG.
 *  - Endpoint, region, bucket, and credentials are explicit and typed. In production mode a
 *    plain http:// endpoint is refused unless an explicit `allowInsecureHttp` opt-in is set
 *    for a trusted self-host network, mirroring the humanity redeem client's TLS pattern.
 */

import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  assertInventoryLimit,
  assertMultipartPartList,
  assertObjectChecksum,
  assertObjectKey,
  assertObjectKeyPrefix,
  assertObjectSizeBytes,
  assertPartNumber,
  assertUploadId,
  toObjectStoreUnavailableError,
  type MeerkatObjectStore,
  type ObjectAppendPartInput,
  type ObjectAppendPartResult,
  type ObjectBeginMultipartInput,
  type ObjectCompleteMultipartInput,
  type ObjectCompleteMultipartResult,
  type ObjectDeletionReceipt,
  type ObjectFinalizeResult,
  type ObjectInventoryCursor,
  type ObjectInventoryPage,
  type ObjectMultipartUpload,
  type ObjectObservation,
  type ObjectPromoteInput,
  type ObjectPromoteResult,
  type ObjectPutInput,
  type ObjectReadResult,
  type ObjectState,
} from './object-store';
import type { HostedObjectUploadTarget } from './hosted-storage-metadata';
import type { HostedUploadTargetPresigner } from './object-store-hosted-adapter';

/** Reserved key prefix for the bytes-free per-key version high-water sidecar. Never inventory. */
const VERSION_SIDECAR_PREFIX = '__mkver/';
/** User-metadata header names (S3 lowercases and strips the `x-amz-meta-` prefix on read). */
const META_STATE = 'mk-state';
const META_VERSION = 'mk-version';
const META_CHECKSUM = 'mk-checksum';
const META_SIZE = 'mk-size';

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_BACKOFF_MS = 25;
const DEFAULT_MAX_BACKOFF_MS = 500;
const DEFAULT_PRESIGN_TTL_SECONDS = 900;
const MAX_PRESIGN_TTL_SECONDS = 3_600;

export interface S3ObjectStoreOptions {
  region: string;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  /** Path-style addressing (MinIO and most self-host S3 gateways need this). Defaults to true. */
  forcePathStyle?: boolean;
  /** True in a first-party/production deployment; refuses http:// endpoints unless opted in. */
  productionMode?: boolean;
  /** Explicit opt-in for a trusted private-network http:// endpoint (self-host). */
  allowInsecureHttp?: boolean;
  /** Bounded retry envelope for transient faults. */
  maxAttempts?: number;
  /** Default presigned-PUT lifetime, clamped to [1, MAX_PRESIGN_TTL_SECONDS]. */
  presignTtlSeconds?: number;
  /** Test seam: inject a preconfigured client (skips endpoint/credential validation of options). */
  client?: S3Client;
}

interface ObjectHead {
  state: ObjectState;
  versionCounter: number;
  checksumSha256: string;
  sizeBytes: number;
  contentLength: number;
}

function versionToken(counter: number): string {
  return `v${counter}`;
}

function encodeSidecarKey(key: string): string {
  return `${VERSION_SIDECAR_PREFIX}${Buffer.from(key, 'utf8').toString('base64url')}`;
}

/** A clean "object does not exist" from S3, as opposed to any other fault. */
function isNotFound(error: unknown): boolean {
  const err = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  const name = err?.name ?? err?.Code;
  if (name === 'NoSuchKey' || name === 'NotFound' || name === 'NoSuchUpload') return true;
  return err?.$metadata?.httpStatusCode === 404;
}

function validateEndpoint(endpoint: string, productionMode: boolean, allowInsecureHttp: boolean): void {
  let parsed: URL;
  try {
    parsed = new URL(endpoint.trim());
  } catch {
    throw new TypeError('S3 endpoint is not a valid URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new TypeError('S3 endpoint must use http:// or https://');
  }
  if (parsed.protocol === 'http:' && productionMode && !allowInsecureHttp) {
    throw new TypeError('Production S3 endpoints require https:// unless an explicit trusted-network opt-in is set');
  }
}

async function streamToHashAndSize(
  body: Readable | ReadableStream | Blob | undefined,
): Promise<{ checksum: string; sizeBytes: number }> {
  const hash = createHash('sha256');
  let sizeBytes = 0;
  if (body === undefined) return { checksum: hash.digest('hex'), sizeBytes };
  const stream = body instanceof Readable ? body : Readable.fromWeb(body as never);
  for await (const chunk of stream) {
    const buffer = chunk as Buffer;
    hash.update(buffer);
    sizeBytes += buffer.length;
  }
  return { checksum: hash.digest('hex'), sizeBytes };
}

export class S3ObjectStore implements MeerkatObjectStore, HostedUploadTargetPresigner {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly maxAttempts: number;
  private readonly presignTtlSeconds: number;

  constructor(options: S3ObjectStoreOptions) {
    this.bucket = options.bucket.trim();
    if (!this.bucket) throw new TypeError('S3 bucket is required');
    const productionMode = options.productionMode === true;
    if (options.client) {
      this.client = options.client;
    } else {
      const endpoint = options.endpoint.trim();
      validateEndpoint(endpoint, productionMode, options.allowInsecureHttp === true);
      const region = options.region.trim();
      const accessKeyId = options.accessKeyId.trim();
      const secretAccessKey = options.secretAccessKey;
      if (!region) throw new TypeError('S3 region is required');
      if (!accessKeyId || !secretAccessKey) throw new TypeError('S3 credentials are required');
      const config: S3ClientConfig = {
        region,
        endpoint,
        forcePathStyle: options.forcePathStyle ?? true,
        credentials: {
          accessKeyId,
          secretAccessKey,
          ...(options.sessionToken ? { sessionToken: options.sessionToken } : {}),
        },
      };
      this.client = new S3Client(config);
    }
    this.maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 8));
    const ttl = options.presignTtlSeconds ?? DEFAULT_PRESIGN_TTL_SECONDS;
    this.presignTtlSeconds = Math.max(1, Math.min(ttl, MAX_PRESIGN_TTL_SECONDS));
  }

  /**
   * Release the underlying SDK client's sockets. A service composing this store on a fatal path
   * or graceful shutdown calls this so no connection leaks, mirroring the postgres pool close.
   */
  destroy(): void {
    this.client.destroy();
  }

  // --- fault handling ------------------------------------------------------

  /**
   * Runs an S3 call under a bounded, jittered retry envelope. A clean NotFound is NOT a fault
   * and is rethrown for the caller to interpret as absence; every other fault after the last
   * attempt wraps into ObjectStoreUnavailableError so absence and unavailability never conflate.
   */
  private async call<T>(operation: string, run: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await run();
      } catch (error) {
        if (isNotFound(error)) throw error;
        lastError = error;
        if (attempt < this.maxAttempts) {
          const backoff = Math.min(DEFAULT_BASE_BACKOFF_MS * 2 ** (attempt - 1), DEFAULT_MAX_BACKOFF_MS);
          const jitter = Math.floor(Math.random() * backoff);
          await new Promise((resolve) => setTimeout(resolve, jitter));
        }
      }
    }
    throw toObjectStoreUnavailableError(operation, lastError);
  }

  // --- head / version primitives -------------------------------------------

  private async headObject(operation: string, key: string): Promise<ObjectHead | null> {
    try {
      const head = await this.call(operation, () => (
        this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      ));
      const meta = head.Metadata ?? {};
      const state = meta[META_STATE];
      if (state !== 'quarantined' && state !== 'durable' && state !== 'rejected') {
        // An object without our metadata is not one this store wrote; treat it as absent so a
        // foreign object can never be served or promoted through this adapter.
        return null;
      }
      return {
        state,
        versionCounter: Number(meta[META_VERSION] ?? '0'),
        checksumSha256: meta[META_CHECKSUM] ?? '',
        sizeBytes: Number(meta[META_SIZE] ?? '0'),
        contentLength: head.ContentLength ?? 0,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /** Reads the per-key high-water version counter from its bytes-free sidecar (0 if none). */
  private async readVersionHighWater(operation: string, key: string): Promise<number> {
    try {
      const head = await this.call(operation, () => (
        this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: encodeSidecarKey(key) }))
      ));
      return Number(head.Metadata?.[META_VERSION] ?? '0');
    } catch (error) {
      if (isNotFound(error)) return 0;
      throw error;
    }
  }

  /** Advances the sidecar high-water mark to `counter` so a later rewrite exceeds every prior gen. */
  private async writeVersionHighWater(operation: string, key: string, counter: number): Promise<void> {
    await this.call(operation, () => this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: encodeSidecarKey(key),
      Body: new Uint8Array(0),
      Metadata: { [META_VERSION]: String(counter) },
    })));
  }

  /** The next version counter for a key: max(current object, sidecar high-water) + 1. */
  private async nextVersion(operation: string, key: string): Promise<number> {
    const [head, highWater] = await Promise.all([
      this.headObject(operation, key),
      this.readVersionHighWater(operation, key),
    ]);
    return Math.max(head?.versionCounter ?? 0, highWater) + 1;
  }

  private observationOf(key: string, head: ObjectHead): ObjectObservation {
    return {
      key,
      checksumSha256: head.checksumSha256,
      sizeBytes: head.sizeBytes,
      versionId: versionToken(head.versionCounter),
      state: head.state,
    };
  }

  /** Streams the stored bytes of a key through an incremental sha256, never buffering the whole. */
  private async verifyStoredChecksum(operation: string, key: string): Promise<{ checksum: string; sizeBytes: number }> {
    const got = await this.call(operation, () => (
      this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    ));
    return streamToHashAndSize(got.Body as Readable | undefined);
  }

  /** Writes the bytes-free rejected marker for a key (state=rejected, zero bytes) at `counter`. */
  private async writeRejectedMarker(
    operation: string,
    key: string,
    counter: number,
    observedChecksum: string,
    observedSize: number,
  ): Promise<ObjectObservation> {
    await this.call(operation, () => this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: new Uint8Array(0),
      Metadata: {
        [META_STATE]: 'rejected',
        [META_VERSION]: String(counter),
        [META_CHECKSUM]: observedChecksum,
        [META_SIZE]: String(observedSize),
      },
    })));
    await this.writeVersionHighWater(operation, key, counter);
    return {
      key,
      checksumSha256: observedChecksum,
      sizeBytes: observedSize,
      versionId: versionToken(counter),
      state: 'rejected',
    };
  }

  // --- write path ----------------------------------------------------------

  async put(input: ObjectPutInput): Promise<ObjectFinalizeResult> {
    assertObjectKey('object key', input.key);
    assertObjectChecksum('object checksum', input.checksumSha256);
    const bytes = Uint8Array.from(input.bytes);
    const counter = await this.nextVersion('put', input.key);
    // Land the bytes quarantined-tagged, then re-verify by read-back before they are observable.
    await this.call('put', () => this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      Body: bytes,
      Metadata: {
        [META_STATE]: 'quarantined',
        [META_VERSION]: String(counter),
        [META_CHECKSUM]: input.checksumSha256,
        [META_SIZE]: String(bytes.length),
      },
    })));
    const verified = await this.verifyStoredChecksum('put', input.key);
    if (verified.checksum !== input.checksumSha256 || verified.sizeBytes !== bytes.length) {
      const object = await this.writeRejectedMarker('put', input.key, counter, verified.checksum, verified.sizeBytes);
      const status = verified.sizeBytes !== bytes.length && verified.checksum === input.checksumSha256
        ? 'size_mismatch'
        : 'checksum_mismatch';
      return { status, object };
    }
    await this.writeVersionHighWater('put', input.key, counter);
    return {
      status: 'stored',
      object: {
        key: input.key,
        checksumSha256: input.checksumSha256,
        sizeBytes: bytes.length,
        versionId: versionToken(counter),
        state: 'quarantined',
      },
    };
  }

  async beginMultipart(input: ObjectBeginMultipartInput): Promise<ObjectMultipartUpload> {
    assertObjectKey('object key', input.key);
    assertObjectChecksum('object checksum', input.checksumSha256);
    assertObjectSizeBytes('object bytes', input.sizeBytes);
    const created = await this.call('beginMultipart', () => this.client.send(new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: input.key,
      Metadata: {
        [META_STATE]: 'quarantined',
        [META_CHECKSUM]: input.checksumSha256,
        [META_SIZE]: String(input.sizeBytes),
      },
    })));
    const uploadId = created.UploadId;
    if (!uploadId) throw toObjectStoreUnavailableError('beginMultipart', new Error('S3 returned no UploadId'));
    // The contract's uploadId charset is narrower than S3's; hash S3's opaque id into it while
    // keeping the real S3 id recoverable from the object's pending state via ListParts by key.
    return {
      key: input.key,
      uploadId: s3UploadHandle(uploadId),
      checksumSha256: input.checksumSha256,
      sizeBytes: input.sizeBytes,
    };
  }

  async appendPart(input: ObjectAppendPartInput): Promise<ObjectAppendPartResult> {
    assertObjectKey('object key', input.key);
    assertUploadId('upload id', input.uploadId);
    assertPartNumber('part number', input.partNumber);
    assertObjectChecksum('part checksum', input.checksumSha256);
    const bytes = Uint8Array.from(input.bytes);
    if (objectChecksum(bytes) !== input.checksumSha256) return { status: 'checksum_mismatch' };
    const realUploadId = await this.resolveUploadId(input.key, input.uploadId);
    if (!realUploadId) return { status: 'unknown_upload' };
    try {
      await this.call('appendPart', () => this.client.send(new UploadPartCommand({
        Bucket: this.bucket,
        Key: input.key,
        UploadId: realUploadId,
        PartNumber: input.partNumber,
        Body: bytes,
      })));
    } catch (error) {
      if (isNotFound(error)) return { status: 'unknown_upload' };
      throw error;
    }
    return {
      status: 'appended',
      part: { partNumber: input.partNumber, checksumSha256: input.checksumSha256, sizeBytes: bytes.length },
    };
  }

  async completeMultipart(input: ObjectCompleteMultipartInput): Promise<ObjectCompleteMultipartResult> {
    assertObjectKey('object key', input.key);
    assertUploadId('upload id', input.uploadId);
    const declaredSize = assertMultipartPartList(input.parts);
    const realUploadId = await this.resolveUploadId(input.key, input.uploadId);
    if (!realUploadId) {
      // Replay after the pending upload was consumed resolves to the produced object when it is
      // still present and not rejected, so a retry after a lost response is idempotent.
      const existing = await this.headObject('completeMultipart', input.key);
      if (existing && existing.state !== 'rejected') {
        return { status: 'stored', object: this.observationOf(input.key, existing) };
      }
      return { status: 'unknown_upload' };
    }
    // Confirm every declared part actually landed at the declared size, and capture each part's
    // ETag (S3/MinIO require { PartNumber, ETag } in the completion request) before completing.
    const landed = await this.listUploadedParts('completeMultipart', input.key, realUploadId);
    for (const part of input.parts) {
      const record = landed.get(part.partNumber);
      if (record === undefined || record.size !== part.sizeBytes) {
        return { status: 'missing_parts' };
      }
    }
    if (landed.size !== input.parts.length) return { status: 'missing_parts' };

    const counter = await this.nextVersion('completeMultipart', input.key);
    try {
      await this.call('completeMultipart', () => this.client.send(new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: input.key,
        UploadId: realUploadId,
        MultipartUpload: {
          Parts: input.parts.map((part) => ({
            PartNumber: part.partNumber,
            ETag: landed.get(part.partNumber)!.etag,
          })),
        },
      })));
    } catch (error) {
      if (isNotFound(error)) return { status: 'unknown_upload' };
      throw error;
    }
    // CompleteMultipartUpload preserves the create-time metadata (mk-checksum, mk-size) but does
    // not carry our per-key version counter, so read the assembled object's create-time declared
    // checksum and restamp the metadata (state + counter) in place before the read-back verify.
    const assembledHead = await this.headObject('completeMultipart', input.key);
    const declaredChecksum = assembledHead?.checksumSha256 ?? '';
    await this.restampMetadata('completeMultipart', input.key, {
      [META_STATE]: 'quarantined',
      [META_VERSION]: String(counter),
      [META_CHECKSUM]: declaredChecksum,
      [META_SIZE]: String(declaredSize),
    });
    const verified = await this.verifyStoredChecksum('completeMultipart', input.key);
    if (verified.sizeBytes !== declaredSize) {
      const object = await this.writeRejectedMarker(
        'completeMultipart', input.key, counter, verified.checksum, verified.sizeBytes);
      return { status: 'size_mismatch', object };
    }
    if (verified.checksum !== declaredChecksum) {
      const object = await this.writeRejectedMarker(
        'completeMultipart', input.key, counter, verified.checksum, verified.sizeBytes);
      return { status: 'checksum_mismatch', object };
    }
    await this.writeVersionHighWater('completeMultipart', input.key, counter);
    return {
      status: 'stored',
      object: {
        key: input.key,
        checksumSha256: declaredChecksum,
        sizeBytes: verified.sizeBytes,
        versionId: versionToken(counter),
        state: 'quarantined',
      },
    };
  }

  // --- promote -------------------------------------------------------------

  async promote(input: ObjectPromoteInput): Promise<ObjectPromoteResult> {
    assertObjectKey('quarantine key', input.quarantineKey);
    assertObjectKey('durable key', input.durableKey);
    assertObjectChecksum('expected checksum', input.expectedChecksumSha256);
    const source = await this.headObject('promote', input.quarantineKey);
    if (!source || source.state === 'rejected') {
      const durable = await this.headObject('promote', input.durableKey);
      if (durable && durable.state === 'durable' && durable.checksumSha256 === input.expectedChecksumSha256) {
        return { status: 'promoted', object: this.observationOf(input.durableKey, durable) };
      }
      return { status: 'source_missing' };
    }
    if (source.state !== 'quarantined') {
      const durable = await this.headObject('promote', input.durableKey);
      if (durable && durable.state === 'durable' && durable.checksumSha256 === input.expectedChecksumSha256) {
        return { status: 'promoted', object: this.observationOf(input.durableKey, durable) };
      }
      return { status: 'source_not_quarantined' };
    }
    // Re-verify the quarantined bytes before anything durable is written.
    const sourceVerified = await this.verifyStoredChecksum('promote', input.quarantineKey);
    if (sourceVerified.checksum !== input.expectedChecksumSha256) return { status: 'checksum_mismatch' };

    const counter = await this.nextVersion('promote', input.durableKey);
    await this.call('promote', () => this.client.send(new CopyObjectCommand({
      Bucket: this.bucket,
      Key: input.durableKey,
      CopySource: `${this.bucket}/${encodeURIComponent(input.quarantineKey)}`,
      MetadataDirective: 'REPLACE',
      Metadata: {
        [META_STATE]: 'durable',
        [META_VERSION]: String(counter),
        [META_CHECKSUM]: source.checksumSha256,
        [META_SIZE]: String(source.sizeBytes),
      },
    })));
    // Re-verify the durable copy by read-back before it is considered promoted; a mismatch
    // removes the durable key and leaves the quarantine object intact.
    const durableVerified = await this.verifyStoredChecksum('promote', input.durableKey);
    if (durableVerified.checksum !== input.expectedChecksumSha256) {
      await this.call('promote', () => this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket, Key: input.durableKey,
      })));
      return { status: 'checksum_mismatch' };
    }
    await this.writeVersionHighWater('promote', input.durableKey, counter);
    await this.call('promote', () => this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket, Key: input.quarantineKey,
    })));
    return {
      status: 'promoted',
      object: {
        key: input.durableKey,
        checksumSha256: source.checksumSha256,
        sizeBytes: source.sizeBytes,
        versionId: versionToken(counter),
        state: 'durable',
      },
    };
  }

  // --- read path -----------------------------------------------------------

  async observe(key: string): Promise<ObjectObservation | null> {
    assertObjectKey('object key', key);
    const head = await this.headObject('observe', key);
    return head ? this.observationOf(key, head) : null;
  }

  async read(key: string): Promise<ObjectReadResult | null> {
    assertObjectKey('object key', key);
    const head = await this.headObject('read', key);
    if (!head) return null;
    // A rejected object stores no retrievable bytes: it reads as absent from the byte path.
    if (head.state === 'rejected') return null;
    let body: Readable | undefined;
    try {
      const got = await this.call('read', () => (
        this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
      ));
      body = got.Body as Readable | undefined;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
    const chunks: Buffer[] = [];
    if (body) {
      const stream = body instanceof Readable ? body : Readable.fromWeb(body as never);
      for await (const chunk of stream) chunks.push(chunk as Buffer);
    }
    const bytes = new Uint8Array(Buffer.concat(chunks));
    return { object: this.observationOf(key, head), bytes };
  }

  async deleteObject(key: string): Promise<ObjectDeletionReceipt> {
    assertObjectKey('object key', key);
    const head = await this.headObject('deleteObject', key);
    const versionId = versionToken(head?.versionCounter ?? await this.readVersionHighWater('deleteObject', key));
    await this.call('deleteObject', () => this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket, Key: key,
    })));
    return { key, versionId, deleted: true };
  }

  async listInventory(input: {
    after?: ObjectInventoryCursor;
    prefix?: string;
    limit: number;
  }): Promise<ObjectInventoryPage> {
    assertInventoryLimit(input.limit);
    if (input.after) assertObjectKey('inventory cursor key', input.after.key);
    if (input.prefix !== undefined) assertObjectKeyPrefix('inventory prefix', input.prefix);
    const prefix = input.prefix ?? '';
    const entries: ObjectInventoryPage['entries'] = [];
    // The cursor is a key high-water mark (StartAfter), not S3's opaque ContinuationToken, so it
    // maps cleanly onto the contract's key cursor and stays stable across adapter instances. A
    // prefix maps onto S3's NATIVE ListObjectsV2 Prefix, so the server returns only matching keys
    // (the cap accounting scan is O(tenant objects), not O(bucket)). We keep listing (excluding the
    // version sidecar prefix) until we have gathered ONE MORE real object than the limit: that
    // extra proves more remain, so nextCursor is the last KEPT key.
    let startAfter = input.after?.key;
    let sawMore = false;
    let exhausted = false;
    while (entries.length <= input.limit && !exhausted) {
      const listed = await this.call('listInventory', () => this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1_000,
        ...(prefix ? { Prefix: prefix } : {}),
        ...(startAfter ? { StartAfter: startAfter } : {}),
      })));
      const contents = listed.Contents ?? [];
      if (contents.length === 0) { exhausted = true; break; }
      for (const object of contents) {
        const key = object.Key;
        startAfter = key ?? startAfter;
        if (!key || key.startsWith(VERSION_SIDECAR_PREFIX)) continue;
        const head = await this.headObject('listInventory', key);
        if (!head) continue;
        if (entries.length >= input.limit) { sawMore = true; break; }
        entries.push({
          key,
          checksumSha256: head.checksumSha256,
          sizeBytes: head.sizeBytes,
          versionId: versionToken(head.versionCounter),
          state: head.state,
        });
      }
      if (sawMore) break;
      if (!listed.IsTruncated) exhausted = true;
    }
    const last = entries.at(-1);
    return { entries, nextCursor: sawMore && last ? { key: last.key } : null };
  }

  // --- presigner -----------------------------------------------------------

  async createUploadTarget(input: {
    objectKey: string;
    checksum: string;
    sizeBytes: number;
    fencingToken: number;
    expiresAt: string;
  }): Promise<HostedObjectUploadTarget> {
    assertObjectKey('object key', input.objectKey);
    assertObjectChecksum('object checksum', input.checksum);
    assertObjectSizeBytes('object bytes', input.sizeBytes);
    // Bind the exact content length and declared content sha256 into the signature so a client
    // cannot upload different or larger bytes than the metadata store reserved.
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.objectKey,
      ContentLength: input.sizeBytes,
      ChecksumSHA256: Buffer.from(input.checksum, 'hex').toString('base64'),
      Metadata: {
        [META_STATE]: 'quarantined',
        [META_CHECKSUM]: input.checksum,
        [META_SIZE]: String(input.sizeBytes),
      },
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: this.presignTtlSeconds,
      signableHeaders: new Set(['content-length', 'x-amz-checksum-sha256']),
    }).catch((error) => { throw toObjectStoreUnavailableError('createUploadTarget', error); });
    return {
      objectKey: input.objectKey,
      method: 'PUT',
      url,
      headers: {
        'content-length': String(input.sizeBytes),
        'x-amz-checksum-sha256': Buffer.from(input.checksum, 'hex').toString('base64'),
      },
      expiresAt: input.expiresAt,
      fencingToken: input.fencingToken,
    };
  }

  // --- multipart helpers ---------------------------------------------------

  /** Restamps an object's user metadata in place via a self-copy (S3 has no partial metadata update). */
  private async restampMetadata(
    operation: string,
    key: string,
    metadata: Record<string, string>,
  ): Promise<void> {
    await this.call(operation, () => this.client.send(new CopyObjectCommand({
      Bucket: this.bucket,
      Key: key,
      CopySource: `${this.bucket}/${encodeURIComponent(key)}`,
      MetadataDirective: 'REPLACE',
      Metadata: metadata,
    })));
  }

  /**
   * Resolves the narrow contract uploadId back to S3's opaque UploadId by matching the handle
   * against the live multipart uploads for the key. Returns null when no live upload matches
   * (already completed/aborted), which the caller maps to unknown_upload / idempotent replay.
   */
  private async resolveUploadId(key: string, handle: string): Promise<string | undefined> {
    const uploads = await this.call('resolveUploadId', () => this.client.send(
      new ListMultipartUploadsCommand({ Bucket: this.bucket, Prefix: key }),
    ));
    for (const upload of uploads.Uploads ?? []) {
      if (upload.Key === key && upload.UploadId && s3UploadHandle(upload.UploadId) === handle) {
        return upload.UploadId;
      }
    }
    return undefined;
  }

  private async listUploadedParts(
    operation: string,
    key: string,
    realUploadId: string,
  ): Promise<Map<number, { size: number; etag: string }>> {
    const parts = new Map<number, { size: number; etag: string }>();
    let partMarker: string | undefined;
    for (;;) {
      const listed = await this.call(operation, () => this.client.send(
        new ListPartsCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: realUploadId,
          ...(partMarker ? { PartNumberMarker: partMarker } : {}),
        }),
      ));
      for (const part of listed.Parts ?? []) {
        if (typeof part.PartNumber === 'number') {
          parts.set(part.PartNumber, { size: part.Size ?? 0, etag: part.ETag ?? '' });
        }
      }
      if (!listed.IsTruncated || !listed.NextPartNumberMarker) break;
      partMarker = listed.NextPartNumberMarker;
    }
    return parts;
  }

  /** Aborts a pending multipart upload; best-effort cleanup so an abandoned upload does not linger. */
  async abortMultipart(key: string, handle: string): Promise<void> {
    const realUploadId = await this.resolveUploadId(key, handle);
    if (!realUploadId) return;
    await this.call('abortMultipart', () => this.client.send(new AbortMultipartUploadCommand({
      Bucket: this.bucket, Key: key, UploadId: realUploadId,
    })));
  }
}

/** sha256 hex of opaque bytes; the store's content-address function. */
function objectChecksum(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Maps S3's opaque UploadId into the contract's narrow uploadId charset, stably and reversibly-by-match. */
function s3UploadHandle(s3UploadId: string): string {
  return createHash('sha256').update(s3UploadId, 'utf8').digest('hex').slice(0, 32);
}
