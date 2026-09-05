/**
 * Plan 22 S0.4 -- resumable hosted-storage ingest (POST /api/storage/upload).
 *
 * The ingest writes opaque, hash-addressed blocks into a per-tenant store. It is:
 *  - gated fail-closed by the meerkat:hosted-storage entitlement (S0.6 / TC-15);
 *  - per-block hash-verified on receive, rejecting a forged/corrupted block before
 *    it is ever stored (mirrors servePiece verify, TC-12);
 *  - cap-enforced server-side: a block that would exceed the tenant cap is rejected
 *    with storage_cap BEFORE any bytes are written (TC-13);
 *  - resumable: the response carries the stored-block bitfield so the client resumes
 *    from the first missing block.
 */

import http from 'node:http';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  issueMeerkatHostedEntitlement,
  MEERKAT_HOSTED_RELAY_FEATURE,
} from '@mylife/entitlements/server';
import {
  createStorageIngestHandler,
  type StorageIngestOptions,
  type StorageIngestStore,
} from '../storage-ingest';
import type { MeerkatHostedSubject } from '../hosted-api';
import { FileStorageIngestStore } from '../storage-ingest-store-file';
import { FileSeederPieceStore } from '../seeder-node';

const SECRET = 'storage-ingest-secret';
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

class MemoryIngestStore implements StorageIngestStore {
  private blocks = new Map<string, Uint8Array>();
  constructor(private readonly cap: number) {}
  private key(contentId: string, index: number): string {
    return `${contentId}#${index}`;
  }
  usedBytes(): number {
    let n = 0;
    for (const b of this.blocks.values()) n += b.length;
    return n;
  }
  capBytes(): number {
    return this.cap;
  }
  hasBlock(contentId: string, index: number): boolean {
    return this.blocks.has(this.key(contentId, index));
  }
  putBlock(contentId: string, index: number, bytes: Uint8Array): void {
    this.blocks.set(this.key(contentId, index), bytes);
  }
  storedBitfield(contentId: string, total: number): boolean[] {
    const out: boolean[] = [];
    for (let i = 0; i < total; i += 1) out.push(this.blocks.has(this.key(contentId, i)));
    return out;
  }
  blockCount(): number {
    return this.blocks.size;
  }
}

const servers: Array<{ close: () => Promise<void> }> = [];
const tempDirs: string[] = [];
afterEach(async () => {
  while (servers.length) await servers.pop()!.close();
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function token(features?: string[]): Promise<string> {
  const issued = await issueMeerkatHostedEntitlement({
    secret: SECRET,
    features,
    issuedAt: '2026-06-20T00:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
  return issued.token;
}

async function startIngest(
  store: StorageIngestStore | null,
  extra: Partial<StorageIngestOptions> = {},
): Promise<{ url: string }> {
  const storeBySubject = new Map<string, StorageIngestStore>();
  if (store) storeBySubject.set('paid', store);
  const options: StorageIngestOptions = {
    entitlementSecret: SECRET,
    hash: sha256,
    authorize: (req): MeerkatHostedSubject | null =>
      req.headers.authorization === 'Bearer paid' ? { subjectId: 'paid' } : null,
    resolveStore: (subjectId) => storeBySubject.get(subjectId) ?? null,
    ...extra,
  };
  const server = http.createServer(createStorageIngestHandler(options));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('no bind');
  servers.push({ close: () => new Promise<void>((r) => server.close(() => r())) });
  return { url: `http://127.0.0.1:${address.port}` };
}

interface UploadHeaders {
  authorization?: string;
  entitlement?: string;
  contentId?: string;
  blockIndex?: number;
  totalBlocks?: number;
  blockHash?: string;
}

async function upload(url: string, bytes: Uint8Array, h: UploadHeaders): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/octet-stream' };
  if (h.authorization) headers.authorization = h.authorization;
  if (h.entitlement) headers['x-mk-entitlement'] = h.entitlement;
  if (h.contentId) headers['x-mk-content-id'] = h.contentId;
  if (h.blockIndex !== undefined) headers['x-mk-block-index'] = String(h.blockIndex);
  if (h.totalBlocks !== undefined) headers['x-mk-total-blocks'] = String(h.totalBlocks);
  if (h.blockHash) headers['x-mk-block-hash'] = h.blockHash;
  return fetch(`${url}/api/storage/upload`, { method: 'POST', headers, body: bytes });
}

function block(n: number, fill: number): Uint8Array {
  const a = new Uint8Array(n);
  a.fill(fill);
  return a;
}

describe('POST /api/storage/upload', () => {
  it('401s without authorization', async () => {
    const { url } = await startIngest(new MemoryIngestStore(1_000_000));
    const b = block(10, 1);
    const res = await upload(url, b, {
      entitlement: await token(),
      contentId: 'c1',
      blockIndex: 0,
      totalBlocks: 1,
      blockHash: sha256(b),
    });
    expect(res.status).toBe(401);
  });

  it('rejects fail-closed without the meerkat:hosted-storage entitlement (TC-15)', async () => {
    const store = new MemoryIngestStore(1_000_000);
    const { url } = await startIngest(store);
    const b = block(10, 1);
    const base = { authorization: 'Bearer paid', contentId: 'c1', blockIndex: 0, totalBlocks: 1, blockHash: sha256(b) };

    // No token at all.
    expect((await upload(url, b, base)).status).toBeGreaterThanOrEqual(400);
    // A token WITHOUT hosted-storage (relay-only).
    const relayOnly = await token([MEERKAT_HOSTED_RELAY_FEATURE]);
    expect((await upload(url, b, { ...base, entitlement: relayOnly })).status).toBeGreaterThanOrEqual(400);
    expect(store.blockCount()).toBe(0); // nothing stored on a rejected gate
  });

  it('rejects a block whose bytes do not match the advertised hash, storing nothing (TC-12)', async () => {
    const store = new MemoryIngestStore(1_000_000);
    const { url } = await startIngest(store);
    const b = block(10, 1);
    const res = await upload(url, b, {
      authorization: 'Bearer paid',
      entitlement: await token(),
      contentId: 'c1',
      blockIndex: 0,
      totalBlocks: 1,
      blockHash: sha256(block(10, 2)), // wrong hash (different bytes)
    });
    expect(res.status).toBe(400);
    expect(store.blockCount()).toBe(0);
  });

  it('rejects a block that would exceed the tenant cap BEFORE writing (TC-13)', async () => {
    const store = new MemoryIngestStore(15); // cap 15 bytes
    const { url } = await startIngest(store);
    const b = block(20, 1); // 20 > 15
    const res = await upload(url, b, {
      authorization: 'Bearer paid',
      entitlement: await token(),
      contentId: 'c1',
      blockIndex: 0,
      totalBlocks: 1,
      blockHash: sha256(b),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ reason: 'storage_cap' });
    expect(store.blockCount()).toBe(0); // no bytes written
  });

  it('stores verified blocks and returns the resumable bitfield; resumes from the first missing block', async () => {
    const store = new MemoryIngestStore(1_000_000);
    const { url } = await startIngest(store);
    const tkn = await token();
    const mk = (i: number) => {
      const b = block(8, i + 1);
      return { b, h: { authorization: 'Bearer paid', entitlement: tkn, contentId: 'doc', blockIndex: i, totalBlocks: 3, blockHash: sha256(b) } };
    };

    // Upload block 0, then 2 (skip 1) -> bitfield [true,false,true], resume at 1.
    const b0 = mk(0);
    let res = await upload(url, b0.b, b0.h);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ stored: [true, false, false], nextMissing: 1, complete: false });

    const b2 = mk(2);
    res = await upload(url, b2.b, b2.h);
    expect(await res.json()).toMatchObject({ stored: [true, false, true], nextMissing: 1, complete: false });

    // Idempotent re-upload of block 0 does not change the bitfield.
    res = await upload(url, b0.b, b0.h);
    expect(await res.json()).toMatchObject({ stored: [true, false, true], nextMissing: 1 });

    // Upload the missing block 1 -> complete.
    const b1 = mk(1);
    res = await upload(url, b1.b, b1.h);
    expect(await res.json()).toMatchObject({ stored: [true, true, true], nextMissing: null, complete: true });
    expect(store.blockCount()).toBe(3);
  });

  it('reports "Not connected" (404) when the subject has no provisioned store', async () => {
    const { url } = await startIngest(null);
    const b = block(10, 1);
    const res = await upload(url, b, {
      authorization: 'Bearer paid',
      entitlement: await token(),
      contentId: 'c1',
      blockIndex: 0,
      totalBlocks: 1,
      blockHash: sha256(b),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ connected: false });
  });

  it('rejects traversal ids, malformed hashes, and unbounded bitfields before storage', async () => {
    const store = new MemoryIngestStore(1_000_000);
    const { url } = await startIngest(store);
    const b = block(10, 1);
    const base = {
      authorization: 'Bearer paid',
      entitlement: await token(),
      blockIndex: 0,
      totalBlocks: 1,
      blockHash: sha256(b),
    };
    expect((await upload(url, b, { ...base, contentId: '../escape' })).status).toBe(400);
    expect((await upload(url, b, { ...base, contentId: 'safe', blockHash: 'not-a-sha256' })).status).toBe(400);
    expect((await upload(url, b, { ...base, contentId: 'safe', totalBlocks: 100_001 })).status).toBe(400);
    expect(store.blockCount()).toBe(0);
  });

  it('rate-limits storage independently and never exposes internal exception text', async () => {
    const logs: Array<Record<string, unknown>> = [];
    const denied = await startIngest(new MemoryIngestStore(1_000_000), {
      requestLimiter: { check: () => ({ allowed: false, retryAfterSeconds: 7 }) },
    });
    const b = block(10, 1);
    const headers = {
      authorization: 'Bearer paid',
      entitlement: await token(),
      contentId: 'safe',
      blockIndex: 0,
      totalBlocks: 1,
      blockHash: sha256(b),
    };
    const limited = await upload(denied.url, b, headers);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('7');

    const failed = await startIngest(new MemoryIngestStore(1_000_000), {
      resolveStore: () => { throw new Error('secret backend detail'); },
      log: (_event, detail) => logs.push(detail),
    });
    const response = await upload(failed.url, b, headers);
    expect(response.status).toBe(500);
    const body = await response.json() as { error: string; errorId: string; message?: string };
    expect(body).toMatchObject({ error: 'internal_error' });
    expect(body.errorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.message).toBeUndefined();
    expect(JSON.stringify(logs)).toContain('secret backend detail');
  });

  it('persists uploaded blocks and serializes concurrent cap accounting across adapters', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-storage-ingest-'));
    tempDirs.push(dir);
    const store = new FileStorageIngestStore(dir, new FileSeederPieceStore(dir), 15);
    const { url } = await startIngest(store);
    const entitlement = await token();
    const a = block(10, 1);
    const b = block(10, 2);
    const makeHeaders = (contentId: string, bytes: Uint8Array) => ({
      authorization: 'Bearer paid',
      entitlement,
      contentId,
      blockIndex: 0,
      totalBlocks: 1,
      blockHash: sha256(bytes),
    });
    const results = await Promise.all([
      upload(url, a, makeHeaders('content-a', a)),
      upload(url, b, makeHeaders('content-b', b)),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 413]);
    expect(await store.usedBytes()).toBe(10);

    const restarted = new FileStorageIngestStore(dir, new FileSeederPieceStore(dir), 15);
    expect(await restarted.usedBytes()).toBe(10);
    expect(
      await restarted.hasBlock('content-a', 0) || await restarted.hasBlock('content-b', 0),
    ).toBe(true);
  });
});
