import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import type http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  issueMeerkatHostedEntitlement,
  MEERKAT_HOSTED_STORAGE_FEATURE,
} from '@mylife/entitlements/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createHostedStorageApiHandler,
  handleHostedStorageApiRequest,
  type HostedStorageApiOptions,
} from '../hosted-storage-api';
import { InMemoryHostedStorageMetadataStore } from '../hosted-storage-metadata';
import { FileSeederPieceStore } from '../seeder-node';
import {
  HostedStorageBlockDeleteError,
  type HostedStorageBlockStore,
  type StorageBlockDeleteResult,
} from '../storage-ingest';
import { FileStorageIngestStore } from '../storage-ingest-store-file';

const SECRET = 'hosted-storage-api-test-secret';
const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const CAP_BYTES = 1_000_000;

const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');
const sha512 = (bytes: Uint8Array): string =>
  createHash('sha512').update(bytes).digest('hex');

class MemoryBlockStore implements HostedStorageBlockStore {
  private readonly blocks = new Map<string, Uint8Array>();

  constructor(private readonly cap: number = CAP_BYTES) {}

  private key(contentId: string, index: number): string {
    return `${contentId}\u0000${index}`;
  }

  usedBytes(): number {
    return [...this.blocks.values()].reduce((total, bytes) => total + bytes.length, 0);
  }

  capBytes(): number {
    return this.cap;
  }

  hasBlock(contentId: string, index: number): boolean {
    return this.blocks.has(this.key(contentId, index));
  }

  putBlock(contentId: string, index: number, bytes: Uint8Array): void {
    this.blocks.set(this.key(contentId, index), Uint8Array.from(bytes));
  }

  tamperBlock(contentId: string, index: number, bytes: Uint8Array): void {
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
    const deletedBlocks = this.blocks.size;
    const deletedBytes = this.usedBytes();
    this.blocks.clear();
    return { deletedBlocks, deletedBytes };
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
    this.responseHeaders.set(
      name.toLowerCase(),
      Array.isArray(value) ? value.join(', ') : String(value),
    );
    return this;
  }

  getHeader(name: string): string | undefined {
    return this.responseHeaders.get(name.toLowerCase());
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
    this.chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
    this.headersSent = true;
    return true;
  }

  end(chunk?: string | Uint8Array): this {
    if (chunk !== undefined) this.write(chunk);
    this.headersSent = true;
    this.emit('finish');
    return this;
  }

  capture(): Captured {
    return {
      status: this.statusCode,
      headers: Object.fromEntries(this.responseHeaders),
      body: Buffer.concat(this.chunks),
    };
  }
}

interface Captured {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

interface RequestInput {
  method: string;
  path: string;
  subject?: string;
  entitlement?: string | null;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
}

interface TestContext {
  metadata: InMemoryHostedStorageMetadataStore;
  stores: Map<string, MemoryBlockStore>;
  options: HostedStorageApiOptions;
  entitlement: string;
}

function request(input: RequestInput): http.IncomingMessage {
  const body = typeof input.body === 'string'
    ? Buffer.from(input.body)
    : input.body
      ? Buffer.from(input.body)
      : Buffer.alloc(0);
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headers[name.toLowerCase()] = value;
  }
  if (input.subject) headers.authorization = `Bearer ${input.subject}`;
  if (input.entitlement !== null && input.entitlement !== undefined) {
    headers['x-mk-entitlement'] = input.entitlement;
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

async function call(context: TestContext, input: RequestInput): Promise<Captured> {
  const req = request(input);
  const output = new CapturingResponse();
  await handleHostedStorageApiRequest(
    req,
    output as unknown as http.ServerResponse,
    context.options,
  );
  return output.capture();
}

function json(response: Captured): Record<string, unknown> {
  return JSON.parse(response.body.toString('utf8')) as Record<string, unknown>;
}

async function makeContext(): Promise<TestContext> {
  const metadata = new InMemoryHostedStorageMetadataStore();
  const stores = new Map<string, MemoryBlockStore>([
    [TENANT_A, new MemoryBlockStore()],
    [TENANT_B, new MemoryBlockStore()],
  ]);
  const entitlement = (await issueMeerkatHostedEntitlement({
    secret: SECRET,
    features: [MEERKAT_HOSTED_STORAGE_FEATURE],
    issuedAt: '2026-07-01T00:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
  })).token;
  const options: HostedStorageApiOptions = {
    entitlementSecret: SECRET,
    hash: sha256,
    authorize: (req) => {
      const authorization = req.headers.authorization;
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
      return result.status === 'created'
        || result.status === 'updated'
        || result.status === 'replayed';
    },
    metadata,
  };
  return { metadata, stores, options, entitlement };
}

async function uploadBlocks(
  context: TestContext,
  subject: string,
  objectId: string,
  blocks: readonly Uint8Array[],
  indices: readonly number[] = blocks.map((_, index) => index),
  path = '/api/storage/v1/objects',
): Promise<Captured[]> {
  const responses: Captured[] = [];
  for (const index of indices) {
    const bytes = blocks[index];
    if (!bytes) throw new Error(`Missing test block ${index}`);
    responses.push(await call(context, {
      method: 'POST',
      path,
      subject,
      entitlement: context.entitlement,
      headers: {
        'content-type': 'application/octet-stream',
        'x-mk-content-id': objectId,
        'x-mk-block-index': String(index),
        'x-mk-total-blocks': String(blocks.length),
        'x-mk-block-hash': sha256(bytes),
      },
      body: bytes,
    }));
  }
  return responses;
}

async function completeObject(
  context: TestContext,
  subject: string,
  objectId: string,
  blocks: readonly Uint8Array[],
  dataClass = 'encrypted_backup_manifest',
): Promise<Captured> {
  const bytes = Buffer.concat(blocks.map((block) => Buffer.from(block)));
  return call(context, {
    method: 'POST',
    path: `/api/storage/v1/objects/${objectId}/complete`,
    subject,
    entitlement: context.entitlement,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      encryptedBytes: bytes.length,
      ciphertextHash: sha512(bytes),
      dataClass,
    }),
  });
}

async function putCompleteObject(
  context: TestContext,
  subject: string,
  objectId: string,
  blocks: readonly Uint8Array[],
): Promise<Captured> {
  const uploaded = await uploadBlocks(context, subject, objectId, blocks);
  expect(uploaded.every((response) => response.status === 200)).toBe(true);
  return completeObject(context, subject, objectId, blocks);
}

function backupBody(
  backupId: string,
  manifestObjectId: string,
  hash: string,
  formatVersion = 1,
): string {
  return JSON.stringify({
    formatVersion,
    backupId,
    encryptedManifestHash: hash,
    createdAt: '2026-07-14T12:00:00.000Z',
    manifestObjectId,
  });
}

describe('hosted storage API v1', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext();
  });

  it('fails closed on missing and invalid entitlement for every route', async () => {
    const bytes = Buffer.from('opaque');
    const routes: Array<Omit<RequestInput, 'subject' | 'entitlement'>> = [
      {
        method: 'POST',
        path: '/api/storage/v1/objects',
        headers: {
          'x-mk-content-id': 'route-object',
          'x-mk-block-index': '0',
          'x-mk-total-blocks': '1',
          'x-mk-block-hash': sha256(bytes),
        },
        body: bytes,
      },
      { method: 'POST', path: '/api/storage/v1/objects/route-object/complete', body: '{}' },
      { method: 'HEAD', path: '/api/storage/v1/objects/route-object' },
      { method: 'GET', path: '/api/storage/v1/objects/route-object' },
      { method: 'GET', path: '/api/storage/v1/objects' },
      { method: 'DELETE', path: '/api/storage/v1/objects/route-object' },
      { method: 'GET', path: '/api/storage/v1/quota' },
      { method: 'GET', path: '/api/storage/v1/health' },
      { method: 'GET', path: '/api/storage/v1/backups' },
      { method: 'PUT', path: '/api/storage/v1/backups/backup-1/manifest', body: '{}' },
      {
        method: 'POST',
        path: '/api/storage/upload',
        headers: {
          'x-mk-content-id': 'legacy-object',
          'x-mk-block-index': '0',
          'x-mk-total-blocks': '1',
          'x-mk-block-hash': sha256(bytes),
        },
        body: bytes,
      },
    ];

    for (const route of routes) {
      const missing = await call(context, { ...route, subject: TENANT_A, entitlement: null });
      expect(missing.status, `${route.method} ${route.path} missing`).toBe(402);
      const invalid = await call(context, {
        ...route,
        subject: TENANT_A,
        entitlement: 'not-a-valid-entitlement',
      });
      expect(invalid.status, `${route.method} ${route.path} invalid`).toBe(403);
      const unauthorized = await call(context, {
        ...route,
        entitlement: context.entitlement,
      });
      expect(unauthorized.status, `${route.method} ${route.path} auth`).toBe(401);
    }
    expect(context.stores.get(TENANT_A)?.usedBytes()).toBe(0);
  });

  it('keeps authenticated account deletion available without a paid entitlement', async () => {
    const unauthenticated = await call(context, {
      method: 'POST', path: '/api/storage/v1/account/delete', entitlement: null,
    });
    expect(unauthenticated.status).toBe(401);

    await context.metadata.provisionTenant({
      subjectId: TENANT_A,
      capBytes: 1_024,
      policy: {
        policyVersion: 1,
        maxObjectBytes: 1_024,
        maxObjectCount: 10,
        maxConcurrentReservations: 2,
        reservationTtlSeconds: 60,
        retentionDays: 30,
      },
    });
    context.options.resolveStore = () => null;
    context.options.resolveDeletionStore = (subjectId) => context.stores.get(subjectId) ?? null;

    const expired = await call(context, {
      method: 'POST', path: '/api/storage/v1/account/delete', subject: TENANT_A, entitlement: null,
    });
    expect(expired.status).toBe(200);
    expect((json(expired).deleted as { tenantRows: number }).tenantRows).toBe(1);
  });

  it('returns exact missing indices and checksum evidence only after full re-verification', async () => {
    const blocks = [Buffer.from('alpha'), Buffer.from('bravo'), Buffer.from('charlie')];
    await uploadBlocks(context, TENANT_A, 'missing-object', blocks, [0, 2]);

    const missing = await completeObject(context, TENANT_A, 'missing-object', blocks);
    expect(missing.status).toBe(409);
    expect(json(missing)).toEqual({ error: 'missing_blocks', missingIndices: [1] });

    await uploadBlocks(context, TENANT_A, 'missing-object', blocks, [1]);
    const completed = await completeObject(context, TENANT_A, 'missing-object', blocks);
    const combined = Buffer.concat(blocks);
    expect(completed.status).toBe(201);
    expect(json(completed).checksum).toEqual({ algorithm: 'sha512', value: sha512(combined) });

    const replay = await completeObject(context, TENANT_A, 'missing-object', blocks);
    expect(replay.status).toBe(200);
    expect(json(replay).checksum).toEqual(json(completed).checksum);
  });

  it('refuses checksum evidence when a stored block no longer matches its advertisement', async () => {
    const block = Buffer.from('advertised-ciphertext');
    await uploadBlocks(context, TENANT_A, 'corrupt-object', [block]);
    context.stores.get(TENANT_A)?.tamperBlock(
      'corrupt-object',
      0,
      Buffer.from('tampered-ciphertext'),
    );

    const completed = await completeObject(context, TENANT_A, 'corrupt-object', [block]);
    expect(completed.status).toBe(409);
    expect(json(completed)).toEqual({ error: 'corrupt_blocks', corruptIndices: [0] });
    expect(json(completed).checksum).toBeUndefined();
    expect(await context.metadata.getApiObject(TENANT_A, 'corrupt-object')).toBeNull();
  });

  it('serves metadata and exact byte ranges and rejects invalid ranges honestly', async () => {
    const blocks = [Buffer.from('abcd'), Buffer.from('efghi'), Buffer.from('jkl')];
    const complete = await putCompleteObject(context, TENANT_A, 'range-object', blocks);
    expect(complete.status).toBe(201);
    const expected = Buffer.concat(blocks);
    const checksum = sha512(expected);

    const head = await call(context, {
      method: 'HEAD',
      path: '/api/storage/v1/objects/range-object',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(head.status).toBe(200);
    expect(head.body).toHaveLength(0);
    expect(head.headers['content-length']).toBe(String(expected.length));
    expect(head.headers['x-mk-ciphertext-hash']).toBe(checksum);
    expect(head.headers['x-mk-object-version']).toBeTruthy();

    const whole = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/objects/range-object',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(whole.status).toBe(200);
    expect(whole.body).toEqual(expected);

    const middle = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/objects/range-object',
      subject: TENANT_A,
      entitlement: context.entitlement,
      headers: { range: 'bytes=2-8' },
    });
    expect(middle.status).toBe(206);
    expect(middle.body.toString()).toBe(expected.subarray(2, 9).toString());
    expect(middle.headers['content-range']).toBe(`bytes 2-8/${expected.length}`);

    const suffix = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/objects/range-object',
      subject: TENANT_A,
      entitlement: context.entitlement,
      headers: { range: 'bytes=-4' },
    });
    expect(suffix.status).toBe(206);
    expect(suffix.body).toEqual(expected.subarray(-4));

    const invalid = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/objects/range-object',
      subject: TENANT_A,
      entitlement: context.entitlement,
      headers: { range: `bytes=${expected.length}-` },
    });
    expect(invalid.status).toBe(416);
    expect(invalid.headers['content-range']).toBe(`bytes */${expected.length}`);
    expect(json(invalid)).toEqual({ error: 'range_not_satisfiable' });
  });

  it('paginates objects with opaque stable cursors', async () => {
    for (const objectId of ['object-c', 'object-a', 'object-b']) {
      const complete = await putCompleteObject(
        context,
        TENANT_A,
        objectId,
        [Buffer.from(`ciphertext-${objectId}`)],
      );
      expect(complete.status).toBe(201);
    }

    const first = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/objects?limit=2',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(first.status).toBe(200);
    const firstBody = json(first);
    const firstItems = firstBody.items as Array<{ id: string }>;
    const cursor = firstBody.nextCursor;
    expect(firstItems).toHaveLength(2);
    expect(typeof cursor).toBe('string');
    expect(cursor).not.toContain(firstItems[1]?.id);

    const second = await call(context, {
      method: 'GET',
      path: `/api/storage/v1/objects?limit=2&cursor=${String(cursor)}`,
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    const secondItems = json(second).items as Array<{ id: string }>;
    expect(second.status).toBe(200);
    expect(secondItems).toHaveLength(1);
    expect(new Set([...firstItems, ...secondItems].map((item) => item.id))).toEqual(
      new Set(['object-a', 'object-b', 'object-c']),
    );
    expect(json(second).nextCursor).toBeNull();

    const badCursor = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/objects?cursor=not-opaque',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(badCursor.status).toBe(400);
    expect(json(badCursor).error).toBe('invalid_cursor');
  });

  it('keeps object, list, delete, quota, and backup data isolated by tenant', async () => {
    const aBytes = Buffer.from('tenant-a-ciphertext');
    const bBytes = Buffer.from('b');
    expect((await putCompleteObject(context, TENANT_A, 'a-object', [aBytes])).status).toBe(201);
    expect((await putCompleteObject(context, TENANT_B, 'b-object', [bBytes])).status).toBe(201);

    const foreignHead = await call(context, {
      method: 'HEAD',
      path: '/api/storage/v1/objects/a-object',
      subject: TENANT_B,
      entitlement: context.entitlement,
    });
    const foreignGet = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/objects/a-object',
      subject: TENANT_B,
      entitlement: context.entitlement,
    });
    expect(foreignHead.status).toBe(404);
    expect(foreignGet.status).toBe(404);

    const bList = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/objects',
      subject: TENANT_B,
      entitlement: context.entitlement,
    });
    expect((json(bList).items as Array<{ id: string }>).map((item) => item.id)).toEqual(['b-object']);

    const bQuota = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/quota',
      subject: TENANT_B,
      entitlement: context.entitlement,
    });
    expect(json(bQuota)).toEqual({ usedBytes: bBytes.length, capBytes: CAP_BYTES });

    const foreignDelete = await call(context, {
      method: 'DELETE',
      path: '/api/storage/v1/objects/a-object',
      subject: TENANT_B,
      entitlement: context.entitlement,
    });
    expect(json(foreignDelete).deleted).toBe(false);
    const aStillExists = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/objects/a-object',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(aStillExists.status).toBe(200);
    expect(aStillExists.body).toEqual(aBytes);

    const locator = await call(context, {
      method: 'PUT',
      path: '/api/storage/v1/backups/a-backup/manifest',
      subject: TENANT_A,
      entitlement: context.entitlement,
      body: backupBody('a-backup', 'a-object', sha512(aBytes)),
    });
    expect(locator.status).toBe(201);

    const bBackups = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/backups',
      subject: TENANT_B,
      entitlement: context.entitlement,
    });
    expect(json(bBackups).items).toEqual([]);
    const foreignLocator = await call(context, {
      method: 'PUT',
      path: '/api/storage/v1/backups/foreign-backup/manifest',
      subject: TENANT_B,
      entitlement: context.entitlement,
      body: backupBody('foreign-backup', 'a-object', sha512(aBytes)),
    });
    expect(foreignLocator.status).toBe(404);
  });

  it('round-trips only encrypted backup locator fields', async () => {
    const manifestBytes = Buffer.from('{ciphertext,not-json-to-the-server}');
    await putCompleteObject(context, TENANT_A, 'manifest-object', [manifestBytes]);
    const hash = sha512(manifestBytes);
    const put = await call(context, {
      method: 'PUT',
      path: '/api/storage/v1/backups/backup-roundtrip/manifest',
      subject: TENANT_A,
      entitlement: context.entitlement,
      body: backupBody('backup-roundtrip', 'manifest-object', hash, 7),
    });
    expect(put.status).toBe(201);
    expect(json(put)).toEqual({
      formatVersion: 7,
      backupId: 'backup-roundtrip',
      encryptedManifestHash: hash,
      createdAt: '2026-07-14T12:00:00.000Z',
      manifestObjectId: 'manifest-object',
    });

    for (const backupId of ['backup-a', 'backup-z']) {
      const extra = await call(context, {
        method: 'PUT',
        path: `/api/storage/v1/backups/${backupId}/manifest`,
        subject: TENANT_A,
        entitlement: context.entitlement,
        body: backupBody(backupId, 'manifest-object', hash, 7),
      });
      expect(extra.status).toBe(201);
    }
    const firstPage = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/backups?limit=2',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    const firstPageBody = json(firstPage);
    expect(firstPageBody.items).toHaveLength(2);
    expect(typeof firstPageBody.nextCursor).toBe('string');
    const secondPage = await call(context, {
      method: 'GET',
      path: `/api/storage/v1/backups?limit=2&cursor=${String(firstPageBody.nextCursor)}`,
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    const allLocators = [
      ...(firstPageBody.items as Array<{ backupId: string }>),
      ...(json(secondPage).items as Array<{ backupId: string }>),
    ];
    expect(new Set(allLocators.map((locator) => locator.backupId))).toEqual(new Set([
      'backup-a', 'backup-roundtrip', 'backup-z',
    ]));
    expect(json(secondPage).nextCursor).toBeNull();

    const plaintextField = JSON.parse(
      backupBody('backup-with-plaintext', 'manifest-object', hash),
    ) as Record<string, unknown>;
    plaintextField.manifest = { workspaces: ['plaintext'] };
    const rejected = await call(context, {
      method: 'PUT',
      path: '/api/storage/v1/backups/backup-with-plaintext/manifest',
      subject: TENANT_A,
      entitlement: context.entitlement,
      body: JSON.stringify(plaintextField),
    });
    expect(rejected.status).toBe(400);
  });

  it('frees real quota on idempotent object delete', async () => {
    const bytes = Buffer.from('delete-me');
    await putCompleteObject(context, TENANT_A, 'delete-object', [bytes]);
    const before = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/quota',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(json(before).usedBytes).toBe(bytes.length);
    const health = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/health',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(json(health)).toEqual({ ok: true, provisioned: true });

    const first = await call(context, {
      method: 'DELETE',
      path: '/api/storage/v1/objects/delete-object',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(json(first)).toMatchObject({
      deleted: true,
      objectId: 'delete-object',
      freedBytes: bytes.length,
      deletedBlocks: 1,
    });
    const second = await call(context, {
      method: 'DELETE',
      path: '/api/storage/v1/objects/delete-object',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(json(second)).toMatchObject({ deleted: false, freedBytes: 0, deletedBlocks: 0 });

    const after = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/quota',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(json(after).usedBytes).toBe(0);
  });

  it('enforces the cap before a versioned upload writes any bytes', async () => {
    context.stores.set(TENANT_A, new MemoryBlockStore(5));
    const bytes = Buffer.from('sixsix');
    const [response] = await uploadBlocks(context, TENANT_A, 'over-cap-object', [bytes]);
    expect(response?.status).toBe(413);
    expect(json(response!).error).toBe('storage_cap');
    expect(context.stores.get(TENANT_A)?.usedBytes()).toBe(0);
    expect(await context.metadata.getApiUpload(TENANT_A, 'over-cap-object')).not.toBeNull();

    const deleted = await call(context, {
      method: 'DELETE',
      path: '/api/storage/v1/objects/over-cap-object',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(json(deleted)).toMatchObject({ deleted: true, freedBytes: 0, deletedBlocks: 0 });
  });

  it('queues the existing deletion job path when physical deletion cannot finish', async () => {
    const bytes = Buffer.from('queued-delete');
    await putCompleteObject(context, TENANT_A, 'queued-object', [bytes]);
    const store = context.stores.get(TENANT_A);
    if (!store) throw new Error('missing tenant store');
    const originalDelete = store.deleteContent.bind(store);
    store.deleteContent = () => {
      throw new HostedStorageBlockDeleteError(
        'tenants/tenant-a/queued-object/0',
        new Error('object store unavailable'),
      );
    };
    const queued: string[] = [];
    context.options.deletionJobs = {
      enqueue: async (objectKey, nowMs) => {
        queued.push(objectKey);
        const instant = new Date(nowMs).toISOString();
        return {
          status: 'enqueued',
          job: {
            objectKey,
            state: 'pending',
            versionId: null,
            attempt: 0,
            nextAttemptAt: instant,
            lastError: null,
            enqueuedAt: instant,
            updatedAt: instant,
          },
        };
      },
    };

    const response = await call(context, {
      method: 'DELETE',
      path: '/api/storage/v1/objects/queued-object',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(response.status).toBe(503);
    expect(json(response)).toEqual({ error: 'deletion_pending' });
    expect(queued).toEqual(['tenants/tenant-a/queued-object/0']);
    expect(await context.metadata.getApiObject(TENANT_A, 'queued-object')).not.toBeNull();

    store.deleteContent = originalDelete;
    const retry = await call(context, {
      method: 'DELETE',
      path: '/api/storage/v1/objects/queued-object',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(json(retry).deleted).toBe(true);
  });

  it('deletes all tenant bytes and metadata with exact idempotent counts', async () => {
    const oauthSubjects: string[] = [];
    let oauthVaults = 2;
    context.options.deleteOAuthAccount = async (subjectId) => {
      oauthSubjects.push(subjectId);
      const deletedVaults = oauthVaults;
      oauthVaults = 0;
      return { deletedVaults };
    };
    const manifest = Buffer.from('manifest-ciphertext');
    const payload = Buffer.from('payload-ciphertext');
    await putCompleteObject(context, TENANT_A, 'account-manifest', [manifest]);
    await putCompleteObject(context, TENANT_A, 'account-payload', [payload]);
    await putCompleteObject(context, TENANT_B, 'tenant-b-survives', [Buffer.from('b-safe')]);
    const backup = await call(context, {
      method: 'PUT',
      path: '/api/storage/v1/backups/account-backup/manifest',
      subject: TENANT_A,
      entitlement: context.entitlement,
      body: backupBody('account-backup', 'account-manifest', sha512(manifest)),
    });
    expect(backup.status).toBe(201);
    const reservation = await context.metadata.reserve({
      reservationId: 'account-reservation',
      subjectId: TENANT_A,
      contentId: 'legacy-content',
      blockIndex: 0,
      objectKey: 'tenants/tenant-a/legacy-content/0',
      checksum: sha256(Buffer.from('reserved')),
      sizeBytes: 8,
    });
    expect(reservation.status).toBe('reserved');
    if (reservation.status !== 'reserved') throw new Error('expected storage reservation');
    const transition = {
      reservationId: 'account-reservation',
      fencingToken: reservation.reservation.fencingToken,
      observation: {
        objectKey: 'tenants/tenant-a/legacy-content/0',
        checksum: sha256(Buffer.from('reserved')),
        sizeBytes: 8,
        versionId: 'legacy-version',
      },
    };
    expect(await context.metadata.stage(transition)).toMatchObject({ status: 'staged' });
    expect(await context.metadata.activate(transition)).toMatchObject({ status: 'activated' });
    expect(await context.metadata.putManifest({
      subjectId: TENANT_A,
      contentId: 'legacy-content',
      manifest: { encryptedReference: 'opaque-only' },
      isPinned: true,
      expectedLifecycleVersion: null,
    })).toMatchObject({ status: 'inserted' });

    const deleted = await call(context, {
      method: 'POST',
      path: '/api/storage/v1/account/delete',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(deleted.status).toBe(200);
    expect(json(deleted).deleted).toEqual({
      objects: 2,
      blocks: 2,
      backups: 1,
      uploadBlockRows: 2,
      storageObjectRows: 1,
      reservationRows: 1,
      seederManifestRows: 1,
      tenantRows: 1,
      policyRows: 1,
      metadataRows: 10,
      encryptedBytes: manifest.length + payload.length,
      oauthVaults: 2,
    });

    const replay = await call(context, {
      method: 'POST',
      path: '/api/storage/v1/account/delete',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(replay.status).toBe(200);
    expect(json(replay).deleted).toEqual({
      objects: 0,
      blocks: 0,
      backups: 0,
      uploadBlockRows: 0,
      storageObjectRows: 0,
      reservationRows: 0,
      seederManifestRows: 0,
      tenantRows: 0,
      policyRows: 0,
      metadataRows: 0,
      encryptedBytes: 0,
      oauthVaults: 0,
    });
    expect(oauthSubjects).toEqual([TENANT_A, TENANT_A]);

    const health = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/health',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(json(health)).toEqual({ ok: true, provisioned: false });
    const bObject = await call(context, {
      method: 'GET',
      path: '/api/storage/v1/objects/tenant-b-survives',
      subject: TENANT_B,
      entitlement: context.entitlement,
    });
    expect(bObject.status).toBe(200);
    expect(bObject.body.toString()).toBe('b-safe');
  });

  it('preserves the legacy upload alias response and returns typed version errors', async () => {
    const bytes = Buffer.from('legacy-opaque');
    const [legacy] = await uploadBlocks(
      context,
      TENANT_A,
      'legacy-object',
      [bytes],
      [0],
      '/api/storage/upload',
    );
    expect(legacy?.status).toBe(200);
    expect(json(legacy!)).toEqual({
      ok: true,
      contentId: 'legacy-object',
      stored: [true],
      nextMissing: null,
      complete: true,
      usedBytes: bytes.length,
      capBytes: CAP_BYTES,
    });

    const version = await call(context, {
      method: 'GET',
      path: '/api/storage/v2/objects',
      subject: TENANT_A,
      entitlement: context.entitlement,
    });
    expect(version.status).toBe(404);
    expect(json(version)).toEqual({
      error: 'unsupported_storage_api_version',
      requestedVersion: 'v2',
      supportedVersions: ['v1'],
    });
  });

  it('reuses the hosted limiter with canonical route keys', async () => {
    const checked: string[] = [];
    context.options.requestLimiter = {
      check: (_req, pathname) => {
        checked.push(pathname);
        return { allowed: true, retryAfterSeconds: 0 };
      },
    };
    const bytes = Buffer.from('rate-limited-opaque');
    await uploadBlocks(context, TENANT_A, 'limited-object', [bytes]);
    await completeObject(context, TENANT_A, 'limited-object', [bytes]);
    await call(context, {
      method: 'PUT',
      path: '/api/storage/v1/backups/limited-backup/manifest',
      subject: TENANT_A,
      entitlement: context.entitlement,
      body: backupBody('limited-backup', 'limited-object', sha512(bytes)),
    });
    const requests: Array<Pick<RequestInput, 'method' | 'path'>> = [
      { method: 'HEAD', path: '/api/storage/v1/objects/limited-object' },
      { method: 'GET', path: '/api/storage/v1/objects/limited-object' },
      { method: 'GET', path: '/api/storage/v1/objects' },
      { method: 'GET', path: '/api/storage/v1/quota' },
      { method: 'GET', path: '/api/storage/v1/health' },
      { method: 'GET', path: '/api/storage/v1/backups' },
      { method: 'DELETE', path: '/api/storage/v1/objects/limited-object' },
      { method: 'POST', path: '/api/storage/v1/account/delete' },
      { method: 'GET', path: '/api/storage/v9/objects' },
    ];
    for (const next of requests) {
      await call(context, {
        ...next,
        subject: TENANT_A,
        entitlement: context.entitlement,
      });
    }
    expect(new Set(checked)).toEqual(new Set([
      '/api/storage/v1/objects',
      '/api/storage/v1/objects/:id/complete',
      '/api/storage/v1/objects/:id',
      '/api/storage/v1/quota',
      '/api/storage/v1/health',
      '/api/storage/v1/backups',
      '/api/storage/v1/backups/:id/manifest',
      '/api/storage/v1/account/delete',
      '/api/storage/v1/*',
    ]));
  });

  it('reads and deletes blocks through the durable file backing', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hosted-storage-api-file-'));
    try {
      const store = new FileStorageIngestStore(
        directory,
        new FileSeederPieceStore(directory),
        CAP_BYTES,
      );
      const first = Buffer.from('file-first');
      const second = Buffer.from('file-second');
      await store.putBlock('file-a', 0, first);
      await store.putBlock('file-b', 0, second);
      expect(await store.getBlock('file-a', 0)).toEqual(new Uint8Array(first));
      expect(await store.deleteContent('file-a')).toEqual({
        deletedBlocks: 1,
        deletedBytes: first.length,
      });
      expect(await store.usedBytes()).toBe(second.length);
      expect(await store.deleteAll()).toEqual({
        deletedBlocks: 1,
        deletedBytes: second.length,
      });
      expect(await store.usedBytes()).toBe(0);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('keeps tokens, tenant ids, and ciphertext hashes out of failure logs', async () => {
    await context.options.provisionTenant(TENANT_A);
    const ciphertextHash = 'ab'.repeat(64);
    const logs: Array<Record<string, unknown>> = [];
    const output = new CapturingResponse();
    const finished = new Promise<void>((resolve) => output.once('finish', resolve));
    const handler = createHostedStorageApiHandler({
      ...context.options,
      resolveStore: () => {
        throw new Error(`${context.entitlement} ${TENANT_A} ${ciphertextHash}`);
      },
      log: (_event, detail) => logs.push(detail),
    });
    handler(
      request({
        method: 'GET',
        path: '/api/storage/v1/quota',
        subject: TENANT_A,
        entitlement: context.entitlement,
      }),
      output as unknown as http.ServerResponse,
    );
    await finished;

    expect(output.capture().status).toBe(500);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(context.entitlement);
    expect(serialized).not.toContain(TENANT_A);
    expect(serialized).not.toContain(ciphertextHash);
    expect(logs).toEqual([expect.objectContaining({
      method: 'GET',
      path: '/api/storage/v1/quota',
      errorType: 'Error',
    })]);
  });
});
