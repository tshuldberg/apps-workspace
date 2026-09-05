/**
 * Durable community join queue (Plan 57 W4).
 *
 * The asleep-owner fix: today a join handshake lives in the relay's IN-MEMORY
 * mailbox (5-minute default TTL, cleared on restart), so a request parked while
 * the owner sleeps is usually gone before any owner device wakes. The community
 * node -- which already durably holds the community's descriptor and sealed
 * feed -- now also parks the join handshake's envelopes durably, for DAYS, and
 * survives restarts.
 *
 * Zero-knowledge boundary (same trust model as the relay mailbox, verbatim):
 *  - Entries are OPAQUE encoded MailboxEnvelopes (base64). The node never opens
 *    them; only the addressed recipient's X25519 key can. It learns which
 *    COMMUNITY a box belongs to -- exactly what it already legitimately knows
 *    from hosting the community's descriptor -- and nothing else: no sender, no
 *    kind tag, no payload.
 *  - Tokens are the existing HKDF community-join tokens (64 hex, derived from
 *    the descriptor's genesisNonce per recipient). Possession of a token is the
 *    read/ack capability, exactly as on the relay: any descriptor holder can
 *    derive any member's token, but only the recipient can OPEN the envelopes.
 *    Reads do NOT consume (unlike the relay's consume-on-resolve rendezvous);
 *    the recipient acks what it processed, so a crashed drain never loses a
 *    parked request.
 *
 * Fail-closed limits (all clamped): per-token entry cap, per-community token
 * cap, envelope size cap, and a TTL sweep. Over-limit parks are refused with a
 * typed reason, never silently dropped.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface CommunityJoinEntry {
  /** Store-assigned id the recipient acks with. */
  id: string;
  /** The OPAQUE encoded MailboxEnvelope, base64. Never parsed here. */
  envelopeB64: string;
  parkedAt: string;
  expiresAt: string;
}

export interface CommunityJoinQueueStore {
  park(communityId: string, token: string, entry: CommunityJoinEntry): void | Promise<void>;
  list(communityId: string, token: string): CommunityJoinEntry[] | Promise<CommunityJoinEntry[]>;
  ack(communityId: string, token: string, ids: readonly string[]): number | Promise<number>;
  /** Drop expired entries; returns the number removed. */
  sweep(nowMs: number): number | Promise<number>;
  /** Live entry count for a token (cap enforcement). */
  count(communityId: string, token: string): number | Promise<number>;
  /** Distinct live token count for a community (cap enforcement). */
  tokenCount(communityId: string): number | Promise<number>;
  /** Total parked envelope bytes (base64 length) for a community (cap enforcement). */
  byteCount(communityId: string): number | Promise<number>;
}

export const JOIN_QUEUE_LIMITS = {
  /** Max base64 length of one parked envelope (64 KiB of base64). */
  maxEnvelopeB64: 64 * 1024,
  /** Max live entries per token (one recipient's box). */
  maxPerToken: 32,
  /** Max distinct live tokens per community. */
  maxTokensPerCommunity: 512,
  /**
   * Max total parked envelope bytes per community (8 MiB of base64). Without it
   * the per-token x per-community caps multiply to ~1 GiB in ONE JSON file that
   * every park/list/ack re-parses (audit 2026-09-01, R2). Any descriptor holder
   * can derive every member's token, so the byte cap is the real bound.
   */
  maxBytesPerCommunity: 8 * 1024 * 1024,
  /** Directory-wide TTL sweeps run at most this often (not on every park). */
  sweepIntervalMs: 60_000,
  /** Default entry TTL: 7 days. */
  ttlMs: 7 * 24 * 60 * 60 * 1_000,
  /** TTL clamp: [1 hour, 30 days]. */
  minTtlMs: 60 * 60 * 1_000,
  maxTtlMs: 30 * 24 * 60 * 60 * 1_000,
} as const;

const TOKEN_RE = /^[0-9a-f]{64}$/;
const BASE64_RE = /^[A-Za-z0-9+/=]+$/;

export type ParkJoinVerdict =
  | { ok: true; id: string }
  | { ok: false; status: 400 | 401 | 404 | 429; reason: 'bad_token' | 'bad_envelope' | 'too_large' | 'unknown_community' | 'token_not_recognized' | 'box_full' | 'community_full' };

export interface CommunityJoinQueueOptions {
  store?: CommunityJoinQueueStore;
  /** Entry TTL in ms; clamped to [minTtlMs, maxTtlMs]. */
  ttlMs?: number;
  now?: () => number;
  /** Called after a REAL accepted park (the notify seam). Best-effort. */
  onParked?: (communityId: string) => void | Promise<void>;
  /** Per-community byte cap override; clamped to (0, maxBytesPerCommunity]. Tests. */
  maxBytesPerCommunity?: number;
}

function clampBytesPerCommunity(value: number | undefined): number {
  if (!Number.isFinite(value as number) || value === undefined || value <= 0) return JOIN_QUEUE_LIMITS.maxBytesPerCommunity;
  return Math.min(JOIN_QUEUE_LIMITS.maxBytesPerCommunity, Math.floor(value));
}

/** Clamp a configured TTL into the safe window (the clamp IS the property). */
export function clampJoinTtlMs(ttlMs: number | undefined): number {
  if (!Number.isFinite(ttlMs as number) || ttlMs === undefined) return JOIN_QUEUE_LIMITS.ttlMs;
  return Math.min(JOIN_QUEUE_LIMITS.maxTtlMs, Math.max(JOIN_QUEUE_LIMITS.minTtlMs, ttlMs));
}

export class CommunityJoinQueue {
  private readonly store: CommunityJoinQueueStore;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly onParked?: (communityId: string) => void | Promise<void>;
  private readonly maxBytesPerCommunity: number;
  private counter = 0;
  private lastSweepAtMs = Number.NEGATIVE_INFINITY;

  constructor(options: CommunityJoinQueueOptions = {}) {
    this.store = options.store ?? new InMemoryCommunityJoinStore();
    this.ttlMs = clampJoinTtlMs(options.ttlMs);
    this.now = options.now ?? (() => Date.now());
    this.onParked = options.onParked;
    this.maxBytesPerCommunity = clampBytesPerCommunity(options.maxBytesPerCommunity);
  }

  /**
   * Directory-wide sweep, throttled: the file store reads and rewrites EVERY
   * community file per sweep, so running it on every park let one client turn
   * each request into a full-directory rewrite. Reads stay exact regardless
   * (list filters expired entries itself).
   */
  private async maybeSweep(): Promise<void> {
    const nowMs = this.now();
    if (nowMs - this.lastSweepAtMs < JOIN_QUEUE_LIMITS.sweepIntervalMs) return;
    this.lastSweepAtMs = nowMs;
    await this.store.sweep(nowMs);
  }

  /**
   * Park one opaque envelope for a token. `communityKnown` is the node's own
   * hasCommunity answer and `tokenAuthorized` is the caller-computed gate --
   * either the token derives from the CURRENT roster (unauthenticated joiner
   * requests) or the caller presented a verified member feed-auth (grant parks
   * to any token) -- both checked by the HTTP layer so this stays storage-pure.
   * The gate is the exhaustion defense: an unauthenticated flood cannot mint
   * arbitrary token boxes to hit the per-community cap.
   */
  async park(
    communityId: string,
    token: string,
    envelopeB64: string,
    communityKnown: boolean,
    tokenAuthorized: boolean,
  ): Promise<ParkJoinVerdict> {
    if (!communityKnown) return { ok: false, status: 404, reason: 'unknown_community' };
    if (!TOKEN_RE.test(token)) return { ok: false, status: 400, reason: 'bad_token' };
    if (!tokenAuthorized) return { ok: false, status: 401, reason: 'token_not_recognized' };
    if (typeof envelopeB64 !== 'string' || envelopeB64.length === 0 || !BASE64_RE.test(envelopeB64)) {
      return { ok: false, status: 400, reason: 'bad_envelope' };
    }
    if (envelopeB64.length > JOIN_QUEUE_LIMITS.maxEnvelopeB64) {
      return { ok: false, status: 400, reason: 'too_large' };
    }
    await this.maybeSweep();
    const liveInBox = await this.store.count(communityId, token);
    if (liveInBox >= JOIN_QUEUE_LIMITS.maxPerToken) {
      return { ok: false, status: 429, reason: 'box_full' };
    }
    if (liveInBox === 0
      && await this.store.tokenCount(communityId) >= JOIN_QUEUE_LIMITS.maxTokensPerCommunity) {
      return { ok: false, status: 429, reason: 'community_full' };
    }
    if (await this.store.byteCount(communityId) + envelopeB64.length > this.maxBytesPerCommunity) {
      return { ok: false, status: 429, reason: 'community_full' };
    }
    const nowMs = this.now();
    this.counter += 1;
    const entry: CommunityJoinEntry = {
      id: `jq_${nowMs.toString(36)}_${this.counter.toString(36)}`,
      envelopeB64,
      parkedAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + this.ttlMs).toISOString(),
    };
    await this.store.park(communityId, token, entry);
    try {
      await this.onParked?.(communityId);
    } catch {
      // A notify failure never breaks the accepted park.
    }
    return { ok: true, id: entry.id };
  }

  /** List a token's live entries WITHOUT consuming (recipient acks explicitly). */
  async list(communityId: string, token: string): Promise<CommunityJoinEntry[] | { reason: 'bad_token' }> {
    if (!TOKEN_RE.test(token)) return { reason: 'bad_token' };
    await this.maybeSweep();
    const nowMs = this.now();
    const entries = await this.store.list(communityId, token);
    return entries.filter((entry) => Date.parse(entry.expiresAt) > nowMs);
  }

  /** Delete processed entries. Returns the number really removed. */
  async ack(communityId: string, token: string, ids: readonly string[]): Promise<number | { reason: 'bad_token' }> {
    if (!TOKEN_RE.test(token)) return { reason: 'bad_token' };
    const cleaned = ids.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 64);
    if (cleaned.length === 0) return 0;
    return this.store.ack(communityId, token, cleaned);
  }
}

// ---------------------------------------------------------------------------
// In-memory store (tests + Expo-free embedding)
// ---------------------------------------------------------------------------

export class InMemoryCommunityJoinStore implements CommunityJoinQueueStore {
  private readonly boxes = new Map<string, CommunityJoinEntry[]>();

  private key(communityId: string, token: string): string {
    return `${communityId}\u0000${token}`;
  }

  park(communityId: string, token: string, entry: CommunityJoinEntry): void {
    const key = this.key(communityId, token);
    const list = this.boxes.get(key) ?? [];
    list.push(entry);
    this.boxes.set(key, list);
  }

  list(communityId: string, token: string): CommunityJoinEntry[] {
    return [...(this.boxes.get(this.key(communityId, token)) ?? [])];
  }

  ack(communityId: string, token: string, ids: readonly string[]): number {
    const key = this.key(communityId, token);
    const list = this.boxes.get(key) ?? [];
    const drop = new Set(ids);
    const kept = list.filter((entry) => !drop.has(entry.id));
    const removed = list.length - kept.length;
    if (kept.length === 0) this.boxes.delete(key);
    else this.boxes.set(key, kept);
    return removed;
  }

  sweep(nowMs: number): number {
    let removed = 0;
    for (const [key, list] of [...this.boxes.entries()]) {
      const kept = list.filter((entry) => Date.parse(entry.expiresAt) > nowMs);
      removed += list.length - kept.length;
      if (kept.length === 0) this.boxes.delete(key);
      else this.boxes.set(key, kept);
    }
    return removed;
  }

  count(communityId: string, token: string): number {
    return this.boxes.get(this.key(communityId, token))?.length ?? 0;
  }

  tokenCount(communityId: string): number {
    let count = 0;
    for (const key of this.boxes.keys()) {
      if (key.startsWith(`${communityId}\u0000`)) count += 1;
    }
    return count;
  }

  byteCount(communityId: string): number {
    let bytes = 0;
    for (const [key, list] of this.boxes) {
      if (!key.startsWith(`${communityId}\u0000`)) continue;
      for (const entry of list) bytes += entry.envelopeB64.length;
    }
    return bytes;
  }
}

// ---------------------------------------------------------------------------
// File store (the DATA_DIR deploy pattern, like FileCommunityDescriptorStore):
// one JSON file per community under <dir>/joins/. Writes are atomic
// (tmp + rename) so a crash mid-write never corrupts the parked handshakes.
// ---------------------------------------------------------------------------

interface FileBoxShape {
  version: 1;
  /** token -> entries */
  boxes: Record<string, CommunityJoinEntry[]>;
}

export class FileCommunityJoinStore implements CommunityJoinQueueStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  /** communityId is node-known, but sanitize into a safe filename regardless. */
  private fileFor(communityId: string): string {
    const safe = communityId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
    return path.join(this.dir, `${safe}.json`);
  }

  private read(communityId: string): FileBoxShape {
    try {
      const raw = fs.readFileSync(this.fileFor(communityId), 'utf8');
      const parsed = JSON.parse(raw) as FileBoxShape;
      if (parsed?.version === 1 && typeof parsed.boxes === 'object' && parsed.boxes !== null) return parsed;
    } catch {
      // Missing or unreadable file = empty boxes (never throws upward).
    }
    return { version: 1, boxes: {} };
  }

  private write(communityId: string, shape: FileBoxShape): void {
    const file = this.fileFor(communityId);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(shape), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }

  park(communityId: string, token: string, entry: CommunityJoinEntry): void {
    const shape = this.read(communityId);
    const list = shape.boxes[token] ?? [];
    list.push(entry);
    shape.boxes[token] = list;
    this.write(communityId, shape);
  }

  list(communityId: string, token: string): CommunityJoinEntry[] {
    return [...(this.read(communityId).boxes[token] ?? [])];
  }

  ack(communityId: string, token: string, ids: readonly string[]): number {
    const shape = this.read(communityId);
    const list = shape.boxes[token] ?? [];
    const drop = new Set(ids);
    const kept = list.filter((entry) => !drop.has(entry.id));
    const removed = list.length - kept.length;
    if (removed > 0) {
      if (kept.length === 0) delete shape.boxes[token];
      else shape.boxes[token] = kept;
      this.write(communityId, shape);
    }
    return removed;
  }

  sweep(nowMs: number): number {
    let removed = 0;
    let files: string[] = [];
    try {
      files = fs.readdirSync(this.dir).filter((f) => f.endsWith('.json'));
    } catch {
      return 0;
    }
    for (const file of files) {
      const communityId = file.slice(0, -'.json'.length);
      const shape = this.read(communityId);
      let changed = false;
      for (const [token, list] of Object.entries(shape.boxes)) {
        const kept = list.filter((entry) => Date.parse(entry.expiresAt) > nowMs);
        removed += list.length - kept.length;
        if (kept.length !== list.length) {
          changed = true;
          if (kept.length === 0) delete shape.boxes[token];
          else shape.boxes[token] = kept;
        }
      }
      if (changed) this.write(communityId, shape);
    }
    return removed;
  }

  count(communityId: string, token: string): number {
    return (this.read(communityId).boxes[token] ?? []).length;
  }

  tokenCount(communityId: string): number {
    return Object.keys(this.read(communityId).boxes).length;
  }

  byteCount(communityId: string): number {
    let bytes = 0;
    for (const list of Object.values(this.read(communityId).boxes)) {
      for (const entry of list) bytes += entry.envelopeB64.length;
    }
    return bytes;
  }
}
