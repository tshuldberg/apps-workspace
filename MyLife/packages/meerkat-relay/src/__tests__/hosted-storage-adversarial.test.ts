import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type http from 'node:http';
import { Readable } from 'node:stream';
import {
  issueMeerkatHostedEntitlement,
  MEERKAT_HOSTED_STORAGE_FEATURE,
} from '@mylife/entitlements/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  handleHostedStorageApiRequest,
  type HostedStorageApiOptions,
} from '../hosted-storage-api';
import { InMemoryHostedStorageMetadataStore } from '../hosted-storage-metadata';
import {
  HostedStorageBlockDeleteError,
  type HostedStorageBlockStore,
  type StorageBlockDeleteResult,
} from '../storage-ingest';

const SECRET = 'hosted-storage-adversarial-secret';
const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const NOW_MS = Date.parse('2026-07-14T12:00:00.000Z');
const CAP_BYTES = 1_000_000;

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function sha512(bytes: Uint8Array): string {
  return createHash('sha512').update(bytes).digest('hex');
}

class AdversarialBlockStore implements HostedStorageBlockStore {
  private readonly blocks = new Map<string, Uint8Array>();
  private failAccountDeleteOnce = false;

  private key(contentId: string, index: number): string {
    return `${contentId}\u0000${index}`;
  }

  usedBytes(): number {
    return [...this.blocks.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  }

  capBytes(): number {
    return CAP_BYTES;
  }

  hasBlock(contentId: string, index: number): boolean {
    return this.blocks.has(this.key(contentId, index));
  }

  putBlock(contentId: string, index: number, bytes: Uint8Array): void {
    this.blocks.set(this.key(contentId, index), Uint8Array.from(bytes));
  }

  storedBitfield(contentId: string, total: number): boolean[] {
    return Array.from({ length: total }, (_, index) => this.hasBlock(contentId, index));
  }

  getBlock(contentId: string, index: number): Uint8Array | null {
    const bytes = this.blocks.get(this.key(contentId, index));
    return bytes ? Uint8Array.from(bytes) : null;
  }

  deleteContent(contentId: string): StorageBlockDeleteResult {
    let deletedBlocks = 0;
    let deletedBytes = 0;
    const prefix = `${contentId}\u0000`;
    for (const [key, bytes] of this.blocks) {
      if (!key.startsWith(prefix)) continue;
      this.blocks.delete(key);
      deletedBlocks += 1;
      deletedBytes += bytes.length;
    }
    return { deletedBlocks, deletedBytes };
  }

  deleteAll(): StorageBlockDeleteResult {
    if (this.failAccountDeleteOnce) {
      this.failAccountDeleteOnce = false;
      const first = this.blocks.entries().next().value as [string, Uint8Array] | undefined;
      if (first !== undefined) this.blocks.delete(first[0]);
      throw new HostedStorageBlockDeleteError(
        `tenants/${TENANT_A}/account-delete/partial`,
        new Error('injected object-store interruption'),
      );
    }
    const result = { deletedBlocks: this.blocks.size, deletedBytes: this.usedBytes() };
    this.blocks.clear();
    return result;
  }

  failNextAccountDeleteAfterOneBlock(): void {
    this.failAccountDeleteOnce = true;
  }

  withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}

class CapturingResponse extends EventEmitter {
  statusCode = 200;
  headersSent = false;
  private readonly responseHeaders = new Map<string, string>();
  private readonly chunks: Buffer[] = [];

  setHeader(name: string, value: string | number | readonly string[]): this {
    this.responseHeaders.set(name.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value));
    return this;
  }

  writeHead(
    statusCode: number,
    headers?: Record<string, string | number | readonly string[] | undefined>,
  ): this {
    this.statusCode = statusCode;
    for (const [name, value] of Object.entries(headers ?? {})) {
      if (value !== undefined) this.setHeader(name, value);
    }
    this.headersSent = true;
    return this;
  }

  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(Buffer.from(chunk));
    this.headersSent = true;
    return true;
  }

  end(chunk?: string | Uint8Array): this {
    if (chunk !== undefined) this.write(chunk);
    this.headersSent = true;
    this.emit('finish');
    return this;
  }

  capture(): CapturedResponse {
    return {
      status: this.statusCode,
      body: Buffer.concat(this.chunks),
    };
  }
}

interface CapturedResponse {
  status: number;
  body: Buffer;
}

interface RequestInput {
  method: string;
  path: string;
  subject: string;
  entitlement: string;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
}

interface AdversarialContext {
  metadata: InMemoryHostedStorageMetadataStore;
  stores: Map<string, AdversarialBlockStore>;
  options: HostedStorageApiOptions;
  validEntitlement: string;
  setClock(nowMs: number): void;
}

function incoming(input: RequestInput): http.IncomingMessage {
  const body = typeof input.body === 'string'
    ? Buffer.from(input.body)
    : input.body ? Buffer.from(input.body) : Buffer.alloc(0);
  const headers: Record<string, string> = {
    authorization: `Bearer ${input.subject}`,
    'x-mk-entitlement': input.entitlement,
  };
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headers[name.toLowerCase()] = value;
  }
  const stream = Readable.from(body.length > 0 ? [body] : []);
  Object.assign(stream, {
    method: input.method,
    url: input.path,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
  });
  return stream as http.IncomingMessage;
}

async function call(context: AdversarialContext, input: RequestInput): Promise<CapturedResponse> {
  const response = new CapturingResponse();
  await handleHostedStorageApiRequest(
    incoming(input),
    response as unknown as http.ServerResponse,
    context.options,
  );
  return response.capture();
}

function json(response: CapturedResponse): Record<string, unknown> {
  return JSON.parse(response.body.toString('utf8')) as Record<string, unknown>;
}

async function entitlement(issuedAt: string, expiresAt: string): Promise<string> {
  return (await issueMeerkatHostedEntitlement({
    secret: SECRET,
    features: [MEERKAT_HOSTED_STORAGE_FEATURE],
    issuedAt,
    expiresAt,
  })).token;
}

async function createContext(): Promise<AdversarialContext> {
  let clock = NOW_MS;
  const metadata = new InMemoryHostedStorageMetadataStore(() => clock);
  const stores = new Map<string, AdversarialBlockStore>([
    [TENANT_A, new AdversarialBlockStore()],
    [TENANT_B, new AdversarialBlockStore()],
  ]);
  const validEntitlement = await entitlement(
    '2026-07-14T11:00:00.000Z',
    '2026-07-14T13:00:00.000Z',
  );
  const options: HostedStorageApiOptions = {
    entitlementSecret: SECRET,
    hash: sha256,
    authorize: (request) => {
      const authorization = request.headers.authorization;
      if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
      const subjectId = authorization.slice('Bearer '.length);
      return stores.has(subjectId) ? { subjectId } : null;
    },
    resolveStore: (subjectId) => stores.get(subjectId) ?? null,
    provisionTenant: async (subjectId) => {
      const store = stores.get(subjectId);
      if (!store) return false;
      const result = await metadata.provisionTenant({
        subjectId,
        capBytes: store.capBytes(),
        policy: {
          policyVersion: 1,
          maxObjectBytes: store.capBytes(),
          maxObjectCount: 1_000,
          maxConcurrentReservations: 32,
          reservationTtlSeconds: 3_600,
          retentionDays: 30,
        },
      });
      return ['created', 'updated', 'replayed'].includes(result.status);
    },
    metadata,
    now: () => clock,
  };
  return {
    metadata,
    stores,
    options,
    validEntitlement,
    setClock(nowMs): void { clock = nowMs; },
  };
}

async function uploadBlock(
  context: AdversarialContext,
  subject: string,
  entitlementToken: string,
  objectId: string,
  blockIndex: number,
  totalBlocks: number,
  bytes: Uint8Array,
): Promise<CapturedResponse> {
  return call(context, {
    method: 'POST',
    path: '/api/storage/v1/objects',
    subject,
    entitlement: entitlementToken,
    headers: {
      'content-type': 'application/octet-stream',
      'x-mk-content-id': objectId,
      'x-mk-block-index': String(blockIndex),
      'x-mk-total-blocks': String(totalBlocks),
      'x-mk-block-hash': sha256(bytes),
    },
    body: bytes,
  });
}

async function completeObject(
  context: AdversarialContext,
  subject: string,
  entitlementToken: string,
  objectId: string,
  bytes: Uint8Array,
  expectedHash = sha512(bytes),
): Promise<CapturedResponse> {
  return call(context, {
    method: 'POST',
    path: `/api/storage/v1/objects/${objectId}/complete`,
    subject,
    entitlement: entitlementToken,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      encryptedBytes: bytes.length,
      ciphertextHash: expectedHash,
      dataClass: 'encrypted_backup_manifest',
    }),
  });
}

async function putObject(
  context: AdversarialContext,
  subject: string,
  objectId: string,
  bytes: Uint8Array,
): Promise<void> {
  const upload = await uploadBlock(
    context, subject, context.validEntitlement, objectId, 0, 1, bytes,
  );
  expect(upload.status).toBe(200);
  expect((await completeObject(
    context, subject, context.validEntitlement, objectId, bytes,
  )).status).toBe(201);
}

function backupBody(backupId: string, manifestObjectId: string, encryptedManifestHash: string): string {
  return JSON.stringify({
    formatVersion: 1,
    backupId,
    encryptedManifestHash,
    createdAt: '2026-07-14T12:00:00.000Z',
    manifestObjectId,
  });
}

describe('hosted storage adversarial proof', () => {
  let context: AdversarialContext;

  beforeEach(async () => {
    context = await createContext();
  });

  it('tenant A tamper and replay attempts cannot read, overwrite, delete, or register tenant B objects and backups', async () => {
    // Arrange
    const objectId = 'shared-manifest-object';
    const tenantBBytes = Buffer.from('tenant-b-opaque-ciphertext');
    const tenantABytes = Buffer.from('tenant-a-tampered-ciphertext');
    await putObject(context, TENANT_B, objectId, tenantBBytes);
    const backupId = 'tenant-b-backup';
    const locator = backupBody(backupId, objectId, sha512(tenantBBytes));
    expect((await call(context, {
      method: 'PUT', path: `/api/storage/v1/backups/${backupId}/manifest`,
      subject: TENANT_B, entitlement: context.validEntitlement, body: locator,
    })).status).toBe(201);

    // Act
    const foreignRead = await call(context, {
      method: 'GET', path: `/api/storage/v1/objects/${objectId}`,
      subject: TENANT_A, entitlement: context.validEntitlement,
    });
    const foreignDelete = await call(context, {
      method: 'DELETE', path: `/api/storage/v1/objects/${objectId}`,
      subject: TENANT_A, entitlement: context.validEntitlement,
    });
    const locatorReplayBeforeOwnUpload = await call(context, {
      method: 'PUT', path: `/api/storage/v1/backups/${backupId}/manifest`,
      subject: TENANT_A, entitlement: context.validEntitlement, body: locator,
    });
    await uploadBlock(context, TENANT_A, context.validEntitlement, objectId, 0, 1, tenantABytes);
    const forgedCompletion = await completeObject(
      context, TENANT_A, context.validEntitlement, objectId, tenantABytes, sha512(tenantBBytes),
    );
    const ownCompletion = await completeObject(
      context, TENANT_A, context.validEntitlement, objectId, tenantABytes,
    );
    const locatorReplayAfterOwnUpload = await call(context, {
      method: 'PUT', path: `/api/storage/v1/backups/${backupId}/manifest`,
      subject: TENANT_A, entitlement: context.validEntitlement, body: locator,
    });
    const tenantBRead = await call(context, {
      method: 'GET', path: `/api/storage/v1/objects/${objectId}`,
      subject: TENANT_B, entitlement: context.validEntitlement,
    });
    const tenantABackups = await call(context, {
      method: 'GET', path: '/api/storage/v1/backups',
      subject: TENANT_A, entitlement: context.validEntitlement,
    });

    // Assert
    expect(foreignRead.status).toBe(404);
    expect(foreignDelete.status).toBe(404);
    expect(json(foreignDelete)).toEqual({ error: 'storage_not_provisioned' });
    expect(locatorReplayBeforeOwnUpload.status).toBe(404);
    expect(forgedCompletion.status).toBe(409);
    expect(ownCompletion.status).toBe(201);
    expect(locatorReplayAfterOwnUpload.status).toBe(404);
    expect(tenantBRead.status).toBe(200);
    expect(tenantBRead.body).toEqual(tenantBBytes);
    expect(json(tenantABackups).items).toEqual([]);
  });

  it('entitlement expiry mid-upload rejects the next block, preserves the cursor, and resumes after renewal', async () => {
    // Arrange
    const shortEntitlement = await entitlement(
      '2026-07-14T11:59:00.000Z',
      '2026-07-14T12:01:00.000Z',
    );
    const renewedEntitlement = await entitlement(
      '2026-07-14T12:01:00.000Z',
      '2026-07-14T13:00:00.000Z',
    );
    const first = Buffer.from('first-block');
    const second = Buffer.from('second-block');

    // Act
    const accepted = await uploadBlock(context, TENANT_A, shortEntitlement, 'expiring-object', 0, 2, first);
    context.setClock(Date.parse('2026-07-14T12:02:00.000Z'));
    const expired = await uploadBlock(context, TENANT_A, shortEntitlement, 'expiring-object', 1, 2, second);
    const uploadAfterExpiry = await context.metadata.getApiUpload(TENANT_A, 'expiring-object');
    const resumed = await uploadBlock(context, TENANT_A, renewedEntitlement, 'expiring-object', 1, 2, second);
    const combined = Buffer.concat([first, second]);
    const completed = await completeObject(
      context, TENANT_A, renewedEntitlement, 'expiring-object', combined,
    );

    // Assert
    expect(accepted.status).toBe(200);
    expect(expired.status).toBe(403);
    expect(json(expired)).toMatchObject({ error: 'entitlement_required', reason: 'expired' });
    expect(uploadAfterExpiry?.blocks.map((block) => block.blockIndex)).toEqual([0]);
    expect(context.stores.get(TENANT_A)?.usedBytes()).toBe(combined.length);
    expect(resumed.status).toBe(200);
    expect(completed.status).toBe(201);
  });

  it('account deletion interrupted after one physical block completes idempotently on retry', async () => {
    // Arrange
    const tenantAStore = context.stores.get(TENANT_A);
    if (!tenantAStore) throw new Error('tenant A store is missing');
    await putObject(context, TENANT_A, 'delete-object-a', Buffer.from('delete-a'));
    await putObject(context, TENANT_A, 'delete-object-b', Buffer.from('delete-b'));
    await putObject(context, TENANT_B, 'tenant-b-survives', Buffer.from('safe-b'));
    const queued: string[] = [];
    context.options.deletionJobs = {
      enqueue: async (objectKey, nowMs) => {
        queued.push(objectKey);
        const at = new Date(nowMs).toISOString();
        return {
          status: 'enqueued',
          job: {
            objectKey,
            state: 'pending',
            versionId: null,
            attempt: 0,
            nextAttemptAt: at,
            lastError: null,
            enqueuedAt: at,
            updatedAt: at,
          },
        };
      },
    };
    let oauthVaults = 1;
    context.options.deleteOAuthAccount = async () => {
      const deletedVaults = oauthVaults;
      oauthVaults = 0;
      return { deletedVaults };
    };
    tenantAStore.failNextAccountDeleteAfterOneBlock();

    // Act
    const interrupted = await call(context, {
      method: 'POST', path: '/api/storage/v1/account/delete',
      subject: TENANT_A, entitlement: context.validEntitlement,
    });
    const metadataAfterFault = await context.metadata.getTenant(TENANT_A);
    const retry = await call(context, {
      method: 'POST', path: '/api/storage/v1/account/delete',
      subject: TENANT_A, entitlement: context.validEntitlement,
    });
    const replay = await call(context, {
      method: 'POST', path: '/api/storage/v1/account/delete',
      subject: TENANT_A, entitlement: context.validEntitlement,
    });
    const tenantBRead = await call(context, {
      method: 'GET', path: '/api/storage/v1/objects/tenant-b-survives',
      subject: TENANT_B, entitlement: context.validEntitlement,
    });

    // Assert
    expect(interrupted.status).toBe(503);
    expect(json(interrupted)).toEqual({ error: 'deletion_pending' });
    expect(queued).toEqual([`tenants/${TENANT_A}/account-delete/partial`]);
    expect(metadataAfterFault).not.toBeNull();
    expect(retry.status).toBe(200);
    expect(tenantAStore.usedBytes()).toBe(0);
    expect(await context.metadata.getTenant(TENANT_A)).toBeNull();
    expect(json(replay).deleted).toMatchObject({
      objects: 0, blocks: 0, backups: 0, metadataRows: 0, encryptedBytes: 0, oauthVaults: 0,
    });
    expect(tenantBRead.status).toBe(200);
    expect(tenantBRead.body.toString()).toBe('safe-b');
  });
});
