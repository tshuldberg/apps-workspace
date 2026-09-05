/**
 * Resumable hosted-storage ingest (Plan 22 S0.4) -- POST /api/storage/upload.
 *
 * Writes opaque, hash-addressed blocks into a per-tenant store. The honesty +
 * security posture mirrors the seeder serve/pin path:
 *  - GATED fail-closed by the meerkat:hosted-storage entitlement (the SAME token
 *    the relay verifies; S0.6 / TC-15);
 *  - PER-BLOCK hash verify on receive -- a block whose bytes do not match its
 *    advertised hash is rejected and never stored (mirrors servePiece verify,
 *    TC-12);
 *  - CAP-enforced server-side: a block that would exceed the tenant cap is rejected
 *    with storage_cap BEFORE any bytes are written (TC-13); an idempotent re-upload
 *    of an already-stored block never re-charges the cap;
 *  - RESUMABLE: the response carries the stored-block bitfield + the first missing
 *    block, so an interrupted upload resumes without restarting from zero.
 *
 * The tenant store is injected (StorageIngestStore) so this stays decoupled and
 * testable; a deployed hosted service backs it with the per-tenant SeederPieceStore.
 * Wire format: raw block bytes in the body + block metadata in headers (no base64
 * overhead, no multipart parser). The hosted store receives only opaque bytes
 * (sealed by the app when confidential); the operator holds no keys.
 */

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  MEERKAT_HOSTED_STORAGE_FEATURE,
  verifyHostedFeatureEntitlement,
} from '@mylife/entitlements/server';
import type { UploadHashFn } from '@mylife/sync';
import type { MeerkatHostedSubject } from './hosted-api';
import { applyHttpCors } from './http-cors';
import type { HostedRequestLimiter } from './hosted-rate-limiter';

/** Per-tenant block store the ingest writes into. A deployed service backs this
 * with the tenant's SeederPieceStore + real byte accounting. */
export interface StorageIngestStore {
  /** Current total stored bytes (cap accounting). */
  usedBytes(): number | Promise<number>;
  /** Hard storage cap in bytes. */
  capBytes(): number;
  /** True if this exact (contentId, index) block is already stored. */
  hasBlock(contentId: string, index: number): boolean | Promise<boolean>;
  /** Store a block (opaque, hash-addressed). */
  putBlock(contentId: string, index: number, bytes: Uint8Array): void | Promise<void>;
  /** The stored-block bitfield for resume: completed[i] for i in [0, total). */
  storedBitfield(contentId: string, total: number): boolean[] | Promise<boolean[]>;
  /** Serialize cap accounting and writes across processes for this tenant. */
  withWriteLock?<T>(operation: () => Promise<T>): Promise<T>;
}

export interface StorageBlockDeleteResult {
  deletedBlocks: number;
  deletedBytes: number;
}

export class HostedStorageBlockDeleteError extends Error {
  readonly objectKey: string;

  constructor(objectKey: string, cause: unknown) {
    super('Hosted storage block deletion failed', { cause });
    this.name = 'HostedStorageBlockDeleteError';
    this.objectKey = objectKey;
  }
}

/** Read/delete extension used by the full hosted storage API. */
export interface HostedStorageBlockStore extends StorageIngestStore {
  getBlock(contentId: string, index: number): Uint8Array | null | Promise<Uint8Array | null>;
  deleteContent(contentId: string): StorageBlockDeleteResult | Promise<StorageBlockDeleteResult>;
  deleteAll(): StorageBlockDeleteResult | Promise<StorageBlockDeleteResult>;
}

export interface StorageIngestBlockMetadata {
  subjectId: string;
  contentId: string;
  blockIndex: number;
  totalBlocks: number;
  blockHash: string;
  sizeBytes: number;
}

export type StorageIngestBlockMetadataResult =
  | 'accepted'
  | 'conflict'
  | 'not_provisioned';

export interface StorageIngestOptions {
  entitlementSecret: string;
  /** Content hash (hex) -- the same algorithm the manifest used (sha256). */
  hash: UploadHashFn;
  authorize(
    req: http.IncomingMessage,
  ): MeerkatHostedSubject | null | Promise<MeerkatHostedSubject | null>;
  /** The subject's tenant store, or null when not provisioned ("Not connected"). */
  resolveStore(
    subjectId: string,
  ): StorageIngestStore | null | Promise<StorageIngestStore | null>;
  /** Provision persistent tenant metadata before resolving the byte store. */
  prepareStore?(subjectId: string): boolean | Promise<boolean>;
  /** Persist the upload advertisement before the corresponding byte write. */
  recordBlockMetadata?(
    input: StorageIngestBlockMetadata,
  ): StorageIngestBlockMetadataResult | Promise<StorageIngestBlockMetadataResult>;
  /** Default true: the ingest path requires the meerkat:hosted-storage entitlement. */
  requireEntitlement?: boolean;
  /** Header carrying the bearer entitlement token. Default 'x-mk-entitlement'. */
  entitlementHeader?: string;
  /** Per-request body cap (DoS guard, distinct from the tenant storage cap). Default 4 MB. */
  maxBlockBytes?: number;
  /** Route path. Default '/api/storage/upload'. */
  path?: string;
  corsAllowedOrigins?: readonly string[];
  requestLimiter?: Pick<HostedRequestLimiter, 'check'>;
  /** Deterministic entitlement clock. Defaults to Date.now. */
  now?: () => number;
  /** Structured server-side diagnostics. Never returned to the client. */
  log?: (event: string, detail: Record<string, unknown>) => void;
}

export type StorageIngestHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void;

const DEFAULT_MAX_BLOCK_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BLOCKS = 100_000;
const DEFAULT_ENTITLEMENT_HEADER = 'x-mk-entitlement';
const DEFAULT_PATH = '/api/storage/upload';
const SAFE_CONTENT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;

function headerStr(req: http.IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

function routePath(req: http.IncomingMessage): string {
  try {
    return new URL(req.url ?? '/', 'http://localhost').pathname;
  } catch {
    return req.url ?? '/';
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(json),
  });
  res.end(json);
}

/** Read the raw body, returning null if it exceeds maxBytes (DoS guard). */
async function readBody(req: http.IncomingMessage, maxBytes: number): Promise<Uint8Array | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > maxBytes) return null;
    chunks.push(buf);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/** Testable dispatcher for the storage-ingest endpoint. */
export async function handleStorageUpload(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: StorageIngestOptions,
): Promise<void> {
  if (!applyHttpCors(req, res, {
    allowedOrigins: options.corsAllowedOrigins,
    methods: ['POST', 'OPTIONS'],
    headers: [
      'Authorization', 'Content-Type', 'X-Mk-Entitlement', 'X-Mk-Content-Id',
      'X-Mk-Block-Index', 'X-Mk-Total-Blocks', 'X-Mk-Block-Hash',
    ],
  })) {
    sendJson(res, 403, { error: 'origin_not_allowed' });
    return;
  }
  if ((req.method ?? 'GET') === 'OPTIONS') {
    res.writeHead(204, { 'Content-Length': '0' });
    res.end();
    return;
  }
  if (routePath(req) !== (options.path ?? DEFAULT_PATH)) {
    res.writeHead(404).end();
    return;
  }
  if ((req.method ?? 'GET') !== 'POST') {
    res.writeHead(405).end();
    return;
  }

  const rate = options.requestLimiter?.check(req, routePath(req));
  if (rate && !rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    sendJson(res, 429, { error: 'rate_limited' });
    return;
  }

  const subject = await options.authorize(req);
  if (!subject) {
    sendJson(res, 401, { error: 'auth_required' });
    return;
  }

  // Fail-closed entitlement gate -- the SAME token the relay verifies (TC-15).
  if (options.requireEntitlement !== false) {
    const tokenHeader = headerStr(req, options.entitlementHeader ?? DEFAULT_ENTITLEMENT_HEADER);
    const verdict = await verifyHostedFeatureEntitlement(
      tokenHeader ?? null,
      options.entitlementSecret,
      MEERKAT_HOSTED_STORAGE_FEATURE,
      { nowMs: options.now?.() ?? Date.now() },
    );
    if (!verdict.ok) {
      const status = verdict.reason === 'missing' ? 402 : 403;
      sendJson(res, status, { error: 'entitlement_required', reason: verdict.reason });
      return;
    }
  }

  if (options.prepareStore && !await options.prepareStore(subject.subjectId)) {
    sendJson(res, 404, { connected: false });
    return;
  }

  const store = await options.resolveStore(subject.subjectId);
  if (!store) {
    sendJson(res, 404, { connected: false });
    return;
  }

  const contentId = headerStr(req, 'x-mk-content-id');
  const blockIndex = Number(headerStr(req, 'x-mk-block-index'));
  const totalBlocks = Number(headerStr(req, 'x-mk-total-blocks'));
  const blockHash = headerStr(req, 'x-mk-block-hash');
  if (
    !contentId
    || !blockHash
    || !SAFE_CONTENT_ID.test(contentId)
    || !SHA256_HEX.test(blockHash)
    || !Number.isInteger(blockIndex)
    || blockIndex < 0
    || !Number.isInteger(totalBlocks)
    || totalBlocks <= 0
    || totalBlocks > MAX_TOTAL_BLOCKS
    || blockIndex >= totalBlocks
  ) {
    sendJson(res, 400, { error: 'bad_request' });
    return;
  }

  const bytes = await readBody(req, options.maxBlockBytes ?? DEFAULT_MAX_BLOCK_BYTES);
  if (!bytes) {
    sendJson(res, 413, { error: 'too_large', reason: 'block_too_large' });
    return;
  }

  // Per-block hash verify BEFORE storing (TC-12): a forged/corrupted block is rejected.
  if ((await options.hash(bytes)) !== blockHash) {
    sendJson(res, 400, { error: 'hash_mismatch' });
    return;
  }

  const metadataResult = await options.recordBlockMetadata?.({
    subjectId: subject.subjectId,
    contentId,
    blockIndex,
    totalBlocks,
    blockHash,
    sizeBytes: bytes.length,
  });
  if (metadataResult === 'conflict') {
    sendJson(res, 409, { error: 'upload_conflict' });
    return;
  }
  if (metadataResult === 'not_provisioned') {
    sendJson(res, 404, { connected: false });
    return;
  }

  // Cap-enforce BEFORE writing (TC-13). A re-upload of an already-stored block is
  // idempotent and never re-charges the cap.
  const write = async (): Promise<boolean> => {
    const already = await store.hasBlock(contentId, blockIndex);
    if (!already) {
      const used = await store.usedBytes();
      if (used + bytes.length > store.capBytes()) return false;
      await store.putBlock(contentId, blockIndex, bytes);
    }
    return true;
  };
  const storedWithinCap = store.withWriteLock ? await store.withWriteLock(write) : await write();
  if (!storedWithinCap) {
    sendJson(res, 413, { error: 'storage_cap', reason: 'storage_cap' });
    return;
  }

  const stored = await store.storedBitfield(contentId, totalBlocks);
  const nextMissing = stored.findIndex((s) => !s);
  sendJson(res, 200, {
    ok: true,
    contentId,
    stored,
    nextMissing: nextMissing === -1 ? null : nextMissing,
    complete: nextMissing === -1,
    usedBytes: await store.usedBytes(),
    capBytes: store.capBytes(),
  });
}

/** Create a deployable HTTP handler for the storage-ingest endpoint. */
export function createStorageIngestHandler(options: StorageIngestOptions): StorageIngestHandler {
  return (req, res) => {
    void handleStorageUpload(req, res, options).catch((error) => {
      if (!res.headersSent) {
        const errorId = randomUUID();
        options.log?.('storage_request_error', {
          errorId,
          method: req.method ?? 'GET',
          path: routePath(req),
          message: error instanceof Error ? error.message : String(error),
        });
        sendJson(res, 500, {
          error: 'internal_error',
          errorId,
        });
      } else {
        res.end();
      }
    });
  };
}
