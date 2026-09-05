/**
 * Live-wake: persistent mailbox listeners (founder direction 2026-08-01).
 *
 * Delivery today is park-and-poll: a sender parks sealed envelopes in the
 * recipient's pair-private relay mailbox and the recipient polls (focused-
 * channel live loop, focus drains, foreground rounds). This engine removes the
 * polling latency: while the app is foregrounded it holds ONE persistent relay
 * session per inbound mailbox token, so the relay forwards each parked envelope
 * the moment the sender ships it.
 *
 * CRITICAL correctness: a connected session CONSUMES envelopes -- the relay
 * forwards to a live peer instead of parking. A listener that dropped a frame
 * (or woke a separate drain) would LOSE it: by the time a drain joined, the
 * mailbox would be empty. Therefore the listener IS the drain: every inbound
 * frame goes through the ONE dispatcher (`applyMailboxEnvelope`) with the same
 * fail-closed rejected counting as runMailboxDrainJob. On (re)connect the relay
 * drains anything parked while we were away into the same handler, so catch-up
 * and live delivery are a single code path that cannot drift.
 *
 * Honesty: statuses derive only from real connect/close events; `onApplied`
 * fires only for outcomes that applied something real (never 'rejected').
 * The existing polling paths stay as idempotent backstops.
 *
 * Idiom: long-lived per-token listener with bounded reconnect, mirroring
 * CallSignalTransport (WP-25G). RN-safe: no expo/native imports; the backend,
 * relay-URL resolver, and timers are injected.
 */

import type { DeviceIdentity } from '../types';
import type { RelayBackend, RelaySession } from '../transport/relay-transport';
import { deriveMailboxDrainTokens } from './mailbox';
import { msUntilNextDayBucket, relayTokenDayBucket } from './day-bucket';
import {
  applyMailboxEnvelope,
  type MailboxDispatchOutcome,
  type MailboxEnvelopeHandlers,
} from './mailbox-dispatch';
import type { MailboxDrainPeer } from './mailbox-drain';

export type MailboxListenStatus = 'stopped' | 'connecting' | 'listening' | 'unavailable';

export interface MailboxListenToken {
  token: string;
  label: string;
}

export interface MailboxListenCounts {
  /** Envelopes received over live listeners (drained-on-join + forwarded). */
  received: number;
  /** Envelopes that applied something real (any non-rejected outcome). */
  applied: number;
  /** Envelopes dropped fail-closed by the dispatcher (or a throwing handler). */
  rejected: number;
}

export interface MailboxListenEngineOptions {
  identity: DeviceIdentity;
  backend: RelayBackend;
  /**
   * The health-gated relay URL choke point (the app injects
   * ensureEffectiveRelayUrl). Re-resolved on every (re)connect attempt. A
   * null/empty/non-ws value means the relay is honestly absent: the engine
   * reports 'unavailable' and keeps retrying on the last backoff delay.
   */
  relayUrl: () => Promise<string | null> | string | null;
  /** The paired peers whose inbound mailboxes to hold open (drain-shaped). */
  peers: () => readonly MailboxDrainPeer[];
  /** Extra labeled tokens (community join/grant, dm-group-commit, public-join). */
  extraTokens?: () => readonly MailboxListenToken[];
  /**
   * The ONE dispatcher handler set (same builder the drains use). A thunk is
   * resolved per envelope so a host that rebuilds its handlers (React
   * callbacks) never leaves the engine holding a stale closure.
   */
  handlers: MailboxEnvelopeHandlers | (() => MailboxEnvelopeHandlers);
  /** Signed hosted entitlement token for first-party hosted relays. */
  entitlementToken?: () => string | undefined;
  /** Fires for every envelope that applied something real. */
  onApplied?: (outcome: MailboxDispatchOutcome, label: string) => void;
  /** Fires on aggregate status transitions (real socket events only). */
  onStatus?: (status: MailboxListenStatus) => void;
  /** Bounded reconnect schedule in ms; the last entry repeats. */
  reconnectDelaysMs?: number[];
  /**
   * Cap on simultaneous listener sockets (relay maxConnectionsPerClient is 64
   * by default; stay well under it). Peer tokens take priority; overflow
   * tokens stay on the polling paths.
   */
  maxListeners?: number;
  /** Timer seams (tests inject instant timers). */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /**
   * Wall clock for the day-bucketed mailbox token window (current + previous
   * UTC day). Defaults to Date.now; tests inject it.
   */
  now?: () => number;
}

const DEFAULT_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
const DEFAULT_MAX_LISTENERS = 24;

interface ListenerState {
  token: string;
  label: string;
  session: RelaySession | null;
  attempt: number;
  timer: unknown;
  /** Guards the async connect gap: a stale connect must not resurrect a listener. */
  generation: number;
  connecting: boolean;
}

function usableRelayUrl(value: string | null): string | null {
  return value && value.startsWith('ws') ? value : null;
}

/**
 * Hold persistent listeners on this device's inbound mailbox tokens and apply
 * every received envelope through the one fail-closed dispatcher.
 */
export class MailboxListenEngine {
  private readonly opts: MailboxListenEngineOptions;
  private readonly delays: number[];
  private readonly maxListeners: number;
  private readonly listeners = new Map<string, ListenerState>();
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private started = false;
  private dayRollTimer: unknown = null;
  private lastStatus: MailboxListenStatus = 'stopped';
  private readonly totals: MailboxListenCounts = { received: 0, applied: 0, rejected: 0 };
  /** Serializes envelope application so row merges never interleave. */
  private applyChain: Promise<void> = Promise.resolve();

  constructor(options: MailboxListenEngineOptions) {
    this.opts = options;
    const delays = options.reconnectDelaysMs?.filter((d) => Number.isFinite(d) && d > 0);
    this.delays = delays && delays.length > 0 ? delays : DEFAULT_RECONNECT_DELAYS_MS;
    this.maxListeners = Math.max(1, options.maxListeners ?? DEFAULT_MAX_LISTENERS);
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  /** Real cumulative envelope counts (never fabricated). */
  counts(): MailboxListenCounts {
    return { ...this.totals };
  }

  status(): MailboxListenStatus {
    return this.lastStatus;
  }

  /** Number of tokens currently held (open or reconnecting). */
  listenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Compute the capped desired token set: peer mailboxes first, then extras.
   * Each peer holds TWO tokens (current + previous UTC day bucket) because
   * mailbox tokens rotate daily; the previous-bucket listener also catches a
   * sender whose clock has not rolled past the boundary yet.
   */
  private desiredTokens(): MailboxListenToken[] {
    const tokens: MailboxListenToken[] = [];
    const seen = new Set<string>();
    const nowMs = (this.opts.now ?? Date.now)();
    for (const peer of this.opts.peers()) {
      if (peer.revoked || !peer.isActive || !peer.pairSharedSecretHex) continue;
      for (const token of deriveMailboxDrainTokens(
        peer.pairSharedSecretHex,
        this.opts.identity.publicKey,
        nowMs,
      )) {
        if (seen.has(token)) continue;
        seen.add(token);
        tokens.push({ token, label: `peer:${peer.deviceId}` });
      }
    }
    for (const extra of this.opts.extraTokens?.() ?? []) {
      if (seen.has(extra.token)) continue;
      seen.add(extra.token);
      tokens.push(extra);
    }
    return tokens.slice(0, this.maxListeners);
  }

  /**
   * Re-derive the token window just after each UTC day boundary. The callback
   * refreshes ONLY when the bucket really rolled (refreshTokens then re-arms
   * for the next day); an early fire does nothing and does NOT re-arm, so an
   * injected instant test timer cannot recurse. The host's own refreshTokens
   * calls (peer changes, foreground events) re-arm it as a backstop; a
   * backward clock step therefore delays one rotation until the next host
   * refresh, with the still-valid previous-bucket listener covering the gap.
   */
  private armDayRollTimer(): void {
    if (!this.started || this.dayRollTimer !== null) return;
    const armedAtMs = (this.opts.now ?? Date.now)();
    this.dayRollTimer = this.setTimer(() => {
      this.dayRollTimer = null;
      if (!this.started) return;
      const nowMs = (this.opts.now ?? Date.now)();
      if (relayTokenDayBucket(nowMs) !== relayTokenDayBucket(armedAtMs)) this.refreshTokens();
    }, msUntilNextDayBucket(armedAtMs) + 1_000);
  }

  start(): void {
    if (this.started) {
      this.refreshTokens();
      return;
    }
    this.started = true;
    this.refreshTokens();
    if (this.listeners.size === 0) this.emitStatus('unavailable');
  }

  /** Diff the desired token set: close removed listeners, open added ones. */
  refreshTokens(): void {
    if (!this.started) return;
    this.armDayRollTimer();
    const desired = this.desiredTokens();
    const desiredByToken = new Map(desired.map((entry) => [entry.token, entry]));

    for (const [token, state] of [...this.listeners]) {
      if (!desiredByToken.has(token)) this.teardownListener(state, true);
    }
    for (const entry of desired) {
      if (!this.listeners.has(entry.token)) {
        const state: ListenerState = {
          token: entry.token,
          label: entry.label,
          session: null,
          attempt: 0,
          timer: null,
          generation: 0,
          connecting: false,
        };
        this.listeners.set(entry.token, state);
        void this.connectListener(state);
      }
    }
    this.recomputeStatus();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.dayRollTimer !== null) {
      this.clearTimer(this.dayRollTimer);
      this.dayRollTimer = null;
    }
    for (const state of [...this.listeners.values()]) this.teardownListener(state, true);
    this.emitStatus('stopped');
  }

  private teardownListener(state: ListenerState, remove: boolean): void {
    state.generation += 1;
    if (state.timer !== null) {
      this.clearTimer(state.timer);
      state.timer = null;
    }
    const session = state.session;
    state.session = null;
    if (session) void session.close().catch(() => undefined);
    if (remove) this.listeners.delete(state.token);
  }

  private async connectListener(state: ListenerState): Promise<void> {
    if (!this.started || state.connecting || state.session) return;
    state.connecting = true;
    const generation = state.generation;
    this.recomputeStatus();

    let session: RelaySession | null = null;
    try {
      const rawUrl = await this.opts.relayUrl();
      const url = usableRelayUrl(rawUrl);
      if (!url) throw new Error('No relay URL configured.');
      session = await this.opts.backend.connect(url, state.token, {
        entitlementToken: this.opts.entitlementToken?.(),
      });
    } catch {
      state.connecting = false;
      if (this.started && generation === state.generation) this.scheduleReconnect(state);
      this.recomputeStatus();
      return;
    }

    state.connecting = false;
    if (!this.started || generation !== state.generation) {
      // Stopped (or token removed) while the connect was in flight.
      void session.close().catch(() => undefined);
      return;
    }

    state.session = session;
    state.attempt = 0;
    session.onMessage((bytes) => {
      this.enqueueEnvelope(new Uint8Array(bytes), state.label);
    });
    session.onClose?.(() => {
      if (generation !== state.generation) return;
      state.session = null;
      if (this.started) this.scheduleReconnect(state);
      this.recomputeStatus();
    });
    this.recomputeStatus();
  }

  private scheduleReconnect(state: ListenerState): void {
    if (state.timer !== null) return;
    const delay = this.delays[Math.min(state.attempt, this.delays.length - 1)]!;
    state.attempt += 1;
    const generation = state.generation;
    state.timer = this.setTimer(() => {
      state.timer = null;
      if (this.started && generation === state.generation) void this.connectListener(state);
    }, delay);
  }

  /** Serialize envelope application; a throwing handler counts rejected and never kills the listener. */
  private enqueueEnvelope(bytes: Uint8Array, label: string): void {
    this.applyChain = this.applyChain.then(async () => {
      this.totals.received += 1;
      let outcome: MailboxDispatchOutcome;
      try {
        const handlersOpt = this.opts.handlers;
        const handlers = typeof handlersOpt === 'function' ? handlersOpt() : handlersOpt;
        outcome = await applyMailboxEnvelope(this.opts.identity, bytes, handlers);
      } catch {
        this.totals.rejected += 1;
        return;
      }
      if (outcome.kind === 'rejected' || (outcome.kind === 'channel-message' && outcome.applied === 0)) {
        this.totals.rejected += 1;
        return;
      }
      this.totals.applied += 1;
      try {
        this.opts.onApplied?.(outcome, label);
      } catch {
        // an observer must never break delivery
      }
    });
  }

  private recomputeStatus(): void {
    if (!this.started) return;
    let next: MailboxListenStatus = 'unavailable';
    const states = [...this.listeners.values()];
    if (states.some((s) => s.session !== null)) next = 'listening';
    else if (states.some((s) => s.connecting)) next = 'connecting';
    this.emitStatus(next);
  }

  private emitStatus(status: MailboxListenStatus): void {
    if (status === this.lastStatus) return;
    this.lastStatus = status;
    try {
      this.opts.onStatus?.(status);
    } catch {
      // an observer must never break the engine
    }
  }
}
