/**
 * RelayHub: transport-agnostic routing core.
 *
 * Holds connections grouped by token, forwards opaque envelopes between peers
 * sharing a token, buffers envelopes for absent peers in a TTL mailbox, and
 * rate-limits each connection. Knows nothing about WebSockets, so it is fully
 * unit-testable with a `send` callback and an injectable clock.
 *
 * The hub never inspects, decodes, or logs envelope contents. It copies the
 * `env` string verbatim. That is the whole privacy guarantee: the relay is a
 * dumb forwarder of ciphertext addressed by ephemeral tokens.
 */

import { RELAY_LIMITS, type RelayLimits, type ServerFrame } from './protocol';

export type SendFn = (frame: ServerFrame) => void;

interface Conn {
  id: string;
  token: string;
  send: SendFn;
  /** Stable per-client key (IP) used for rate + admission; connId when absent. */
  clientKey: string;
}

interface RateState {
  windowStart: number;
  windowCount: number;
}

interface MailboxEntry {
  env: string;
  ts: number;
}

interface RendezvousEntry {
  rec: string;
  expiresAt: number;
}

/** One announcer's opaque host record under a registry rid. */
interface RegistryEntry {
  rec: string;
  expiresAt: number;
}

type RzRate = RateState;

export interface RelayHubOptions {
  now?: () => number;
  limits?: Partial<RelayLimits>;
}

export interface RelayHubStats {
  connections: number;
  tokens: number;
  mailboxedEnvelopes: number;
  rendezvousRecords: number;
  /** Distinct content-registry rids currently held. */
  registryRids: number;
  /** Total announce records across all rids. */
  registryRecords: number;
}

export class RelayHub {
  private readonly now: () => number;
  private readonly limits: RelayLimits;
  private readonly conns = new Map<string, Conn>();
  private readonly groups = new Map<string, Set<string>>();
  private readonly mailbox = new Map<string, MailboxEntry[]>();
  private readonly rendezvous = new Map<string, RendezvousEntry>();
  // Content-host registry: rid -> (announcerKey -> entry). Multi-announcer and
  // non-consuming, the opposite of the single-record one-time rendezvous above.
  private readonly registry = new Map<string, Map<string, RegistryEntry>>();
  // Rate + admission state keyed by CLIENT (IP), so reconnecting with a fresh
  // connection id can no longer reset a limit (closes the audit reconnect-flood
  // finding). Keyed by connId only when the transport supplies no client key.
  private readonly clientConns = new Map<string, number>();
  private readonly relayRate = new Map<string, RateState>();
  private readonly rzRate = new Map<string, RzRate>();

  constructor(options: RelayHubOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.limits = { ...RELAY_LIMITS, ...(options.limits ?? {}) };
  }

  /**
   * Join a connection to a token group. Delivers any mailboxed envelopes that
   * are still within TTL. Returns false (and sends an err frame) if the group
   * is full or the connection already joined.
   */
  join(connId: string, token: string, send: SendFn, clientKey?: string): boolean {
    if (this.conns.has(connId)) {
      send({ t: 'err', code: 'already_joined', msg: 'connection already joined' });
      return false;
    }
    // Global connection cap: a public relay must bound total sockets.
    if (this.conns.size >= this.limits.maxConnections) {
      send({ t: 'err', code: 'server_full', msg: 'relay at capacity' });
      return false;
    }
    const key = clientKey ?? connId;
    // Per-client (per-IP) connection cap: defeats reconnect/connection floods.
    if ((this.clientConns.get(key) ?? 0) >= this.limits.maxConnectionsPerClient) {
      send({ t: 'err', code: 'too_many_connections', msg: 'too many connections from this client' });
      return false;
    }
    const group = this.groups.get(token);
    if (group && group.size >= this.limits.maxPeersPerToken) {
      send({ t: 'err', code: 'token_full', msg: 'too many peers on this token' });
      return false;
    }
    // Global token-group cap (creating a NEW group only).
    if (!group && this.groups.size >= this.limits.maxTokens) {
      send({ t: 'err', code: 'server_full', msg: 'relay token capacity reached' });
      return false;
    }

    const conn: Conn = { id: connId, token, send, clientKey: key };
    this.conns.set(connId, conn);
    this.clientConns.set(key, (this.clientConns.get(key) ?? 0) + 1);
    if (group) {
      group.add(connId);
    } else {
      this.groups.set(token, new Set([connId]));
    }

    const queued = this.drainMailbox(token, conn);
    send({ t: 'ready', peers: this.peerCount(token, connId), queued });
    return true;
  }

  /**
   * Relay an envelope from a joined connection to its peers. Buffers in the
   * mailbox if no peer is currently present. Enforces size and rate limits.
   */
  relay(connId: string, env: string): void {
    const conn = this.conns.get(connId);
    if (!conn) return; // not joined: ignore (server already validated hello-first)

    if (env.length > this.limits.maxEnvelopeChars) {
      conn.send({ t: 'err', code: 'too_large', msg: 'envelope exceeds size limit' });
      return;
    }
    if (!this.allow(conn.clientKey)) {
      conn.send({ t: 'err', code: 'rate_limited', msg: 'too many envelopes' });
      return;
    }

    const ts = this.now();
    const group = this.groups.get(conn.token);
    let delivered = 0;
    if (group) {
      for (const peerId of group) {
        if (peerId === connId) continue;
        const peer = this.conns.get(peerId);
        if (peer) {
          peer.send({ t: 'env', env, ts });
          delivered++;
        }
      }
    }
    if (delivered === 0) {
      this.enqueueMailbox(conn.token, { env, ts });
    }
  }

  /**
   * Publish an opaque rendezvous record under a short id (MK-016). The record
   * is stored verbatim and never parsed; a republish refreshes its TTL. Bounded
   * by a global record cap and a per-connection rate limit. Independent of token
   * pairing -- a publisher need not join a token.
   */
  publish(connId: string, rid: string, rec: string, send: SendFn, ttlMs?: number, clientKey?: string): void {
    if (rec.length > this.limits.maxRendezvousChars) {
      send({ t: 'err', code: 'too_large', msg: 'rendezvous record exceeds size limit' });
      return;
    }
    if (!this.allowRendezvous(this.rzKey(connId, clientKey))) {
      send({ t: 'err', code: 'rate_limited', msg: 'too many rendezvous operations' });
      return;
    }
    // Cap total records, but always let an existing id be refreshed.
    if (!this.rendezvous.has(rid) && this.rendezvous.size >= this.limits.maxRendezvousRecords) {
      send({ t: 'err', code: 'store_full', msg: 'rendezvous store is full' });
      return;
    }
    const ttl = ttlMs && ttlMs > 0 ? Math.min(ttlMs, this.limits.rendezvousTtlMs) : this.limits.rendezvousTtlMs;
    const expiresAt = this.now() + ttl;
    this.rendezvous.set(rid, { rec, expiresAt });
    send({ t: 'pubok', rid, expiresAt });
  }

  /**
   * Resolve and CONSUME a rendezvous record (one-time). Expired or unknown ids
   * return not_found -- the resolver cannot tell which, and a used code is dead.
   */
  resolve(connId: string, rid: string, send: SendFn, clientKey?: string): void {
    if (!this.allowRendezvous(this.rzKey(connId, clientKey))) {
      send({ t: 'err', code: 'rate_limited', msg: 'too many rendezvous operations' });
      return;
    }
    const entry = this.rendezvous.get(rid);
    if (!entry || entry.expiresAt <= this.now()) {
      if (entry) this.rendezvous.delete(rid);
      send({ t: 'err', code: 'not_found', msg: 'no record for this id' });
      return;
    }
    this.rendezvous.delete(rid); // one-time: consumed on first successful resolve
    send({ t: 'rec', rid, rec: entry.rec });
  }

  /**
   * Announce an OPAQUE host record under a content-registry rid (share-link
   * host discovery). Unlike `publish`, this is MULTI-announcer and NON-consuming:
   * each announcer holds one slot keyed by its client key, a re-announce
   * refreshes that single slot (no duplicates), and `lookup` returns the whole
   * live set without deleting it. `rec` is opaque (base64 secretbox of a host
   * url) -- stored verbatim, never decoded or logged, same guarantee as `env`.
   * Shares the rendezvous rate limiter and the rendezvous size cap.
   */
  announce(connId: string, rid: string, rec: string, send: SendFn, ttlMs?: number, clientKey?: string): void {
    if (rec.length > this.limits.maxRendezvousChars) {
      send({ t: 'err', code: 'too_large', msg: 'announce record exceeds size limit' });
      return;
    }
    const key = this.rzKey(connId, clientKey);
    if (!this.allowRendezvous(key)) {
      send({ t: 'err', code: 'rate_limited', msg: 'too many registry operations' });
      return;
    }
    let slots = this.registry.get(rid);
    // Cap total rids, but always let an existing rid take more announcers.
    if (!slots && this.registry.size >= this.limits.maxRegistryRids) {
      send({ t: 'err', code: 'registry_full', msg: 'content registry is full' });
      return;
    }
    if (!slots) {
      slots = new Map<string, RegistryEntry>();
      this.registry.set(rid, slots);
    }
    // Per-rid announcer cap, but always let an existing announcer refresh.
    if (!slots.has(key) && slots.size >= this.limits.maxAnnouncersPerRid) {
      if (slots.size === 0) this.registry.delete(rid);
      send({ t: 'err', code: 'rid_full', msg: 'too many announcers for this content' });
      return;
    }
    const ttl = ttlMs && ttlMs > 0 ? Math.min(ttlMs, this.limits.registryTtlMs) : this.limits.registryTtlMs;
    slots.set(key, { rec, expiresAt: this.now() + ttl });
    send({ t: 'annok', rid });
  }

  /**
   * Look up all LIVE announce records for a rid (non-consuming, idempotent).
   * Expired slots are skipped (and lazily pruned); an unknown rid yields an
   * empty set rather than an error, since "no hosts announced" is a normal
   * resolver outcome. The relay returns the opaque records verbatim.
   */
  lookup(connId: string, rid: string, send: SendFn, clientKey?: string): void {
    if (!this.allowRendezvous(this.rzKey(connId, clientKey))) {
      send({ t: 'err', code: 'rate_limited', msg: 'too many registry operations' });
      return;
    }
    const slots = this.registry.get(rid);
    if (!slots) {
      send({ t: 'hosts', rid, recs: [] });
      return;
    }
    const t = this.now();
    const recs: string[] = [];
    for (const [announcerKey, entry] of slots) {
      if (entry.expiresAt <= t) {
        slots.delete(announcerKey);
        continue;
      }
      recs.push(entry.rec);
    }
    if (slots.size === 0) this.registry.delete(rid);
    send({ t: 'hosts', rid, recs });
  }

  /** Remove a connection, cleaning up its token group + per-client count. */
  leave(connId: string): void {
    const conn = this.conns.get(connId);
    if (!conn) return;
    this.conns.delete(connId);
    const remaining = (this.clientConns.get(conn.clientKey) ?? 1) - 1;
    if (remaining <= 0) this.clientConns.delete(conn.clientKey);
    else this.clientConns.set(conn.clientKey, remaining);
    // Rate state is intentionally NOT deleted here: keeping it until the window
    // ages out (sweep) is what stops a reconnect from resetting a limit.
    const group = this.groups.get(conn.token);
    if (group) {
      group.delete(connId);
      if (group.size === 0) this.groups.delete(conn.token);
    }
  }

  /** Purge expired mailbox + rendezvous entries. Safe to call on a timer. */
  sweep(): void {
    const cutoff = this.now() - this.limits.mailboxTtlMs;
    for (const [token, entries] of this.mailbox) {
      const live = entries.filter((e) => e.ts >= cutoff);
      if (live.length === 0) {
        this.mailbox.delete(token);
      } else if (live.length !== entries.length) {
        this.mailbox.set(token, live);
      }
    }
    const t = this.now();
    for (const [rid, entry] of this.rendezvous) {
      if (entry.expiresAt <= t) this.rendezvous.delete(rid);
    }
    // Prune expired announcer slots and drop any rid left with no live slots.
    for (const [rid, slots] of this.registry) {
      for (const [announcerKey, entry] of slots) {
        if (entry.expiresAt <= t) slots.delete(announcerKey);
      }
      if (slots.size === 0) this.registry.delete(rid);
    }
    // Age out rate state whose window has fully elapsed (bounds memory without
    // letting a reconnect reset an active limit).
    const staleBefore = t - this.limits.rateWindowMs;
    for (const store of [this.relayRate, this.rzRate]) {
      for (const [key, rate] of store) {
        if (rate.windowStart < staleBefore) store.delete(key);
      }
    }
  }

  stats(): RelayHubStats {
    let mailboxed = 0;
    for (const entries of this.mailbox.values()) mailboxed += entries.length;
    let registryRecords = 0;
    for (const slots of this.registry.values()) registryRecords += slots.size;
    return {
      connections: this.conns.size,
      tokens: this.groups.size,
      mailboxedEnvelopes: mailboxed,
      rendezvousRecords: this.rendezvous.size,
      registryRids: this.registry.size,
      registryRecords,
    };
  }

  // -------------------------------------------------------------------------

  private peerCount(token: string, excludeConnId: string): number {
    const group = this.groups.get(token);
    if (!group) return 0;
    let n = 0;
    for (const id of group) if (id !== excludeConnId) n++;
    return n;
  }

  /** The pub/res rate key: a publisher need not join, so fall back to connId. */
  private rzKey(connId: string, clientKey?: string): string {
    return clientKey ?? this.conns.get(connId)?.clientKey ?? connId;
  }

  /** Per-CLIENT envelope rate (survives reconnects within the window). */
  private allow(clientKey: string): boolean {
    return this.tick(this.relayRate, clientKey, this.limits.rateMaxPerWindow);
  }

  /** Per-CLIENT rate limit for pub/res (survives reconnects within the window). */
  private allowRendezvous(clientKey: string): boolean {
    return this.tick(this.rzRate, clientKey, this.limits.rendezvousMaxPerWindow);
  }

  private tick(store: Map<string, RateState>, key: string, max: number): boolean {
    const t = this.now();
    const rate = store.get(key) ?? { windowStart: t, windowCount: 0 };
    if (t - rate.windowStart >= this.limits.rateWindowMs) {
      rate.windowStart = t;
      rate.windowCount = 0;
    }
    rate.windowCount++;
    store.set(key, rate);
    return rate.windowCount <= max;
  }

  private enqueueMailbox(token: string, entry: MailboxEntry): void {
    const entries = this.mailbox.get(token);
    if (entries) {
      entries.push(entry);
      while (entries.length > this.limits.mailboxMax) entries.shift();
      return;
    }
    // A NEW mailbox queue: bounded by the global distinct-mailbox cap so an
    // attacker cannot mint unbounded queues with one envelope each.
    if (this.mailbox.size >= this.limits.maxMailboxTokens) return;
    this.mailbox.set(token, [entry]);
  }

  private drainMailbox(token: string, conn: Conn): number {
    const entries = this.mailbox.get(token);
    if (!entries || entries.length === 0) return 0;
    const cutoff = this.now() - this.limits.mailboxTtlMs;
    const live = entries.filter((e) => e.ts >= cutoff);
    this.mailbox.delete(token);
    for (const e of live) conn.send({ t: 'env', env: e.env, ts: e.ts });
    return live.length;
  }
}
