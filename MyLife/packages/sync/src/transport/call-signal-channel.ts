/**
 * Plan 25 WP-25G: near-real-time transport for WP-25B call signals over the
 * existing Meerkat relay. No new signaling server: the relay stays an opaque
 * carrier. Every frame is a sealed call-signal frame (sealCallSignalFrame)
 * addressed by a pair-private ephemeral token (deriveCallInviteToken for
 * invites, deriveCallSignalToken(pairSecret, callId) for the rest), so the
 * relay sees a token, ciphertext sizes, and timing only.
 *
 * Delivery model: while a peer holds an open listener on a token, the relay
 * forwards frames immediately (this is what makes a call ring in near-real
 * time). When the peer is offline, the relay parks the frame in its TTL
 * mailbox and drains it on the peer's next join, where the 120s signal TTL in
 * verifyCallSignal drops anything stale. This class never fabricates
 * delivery or connectivity: sendFrame resolves true only after a real socket
 * send, and listener status is derived from real connect/close events only.
 */

import type { RelayBackend, RelaySession } from './relay-transport';

export type CallSignalListenerStatus =
  | 'connecting'
  | 'listening'
  | 'unavailable'
  | 'stopped';

export interface CallSignalTransportDeps {
  backend: RelayBackend;
  /**
   * The health-gated relay URL choke point (the app injects effectiveRelayUrl).
   * A null/empty/non-ws value means the relay is honestly absent: listeners
   * report 'unavailable' and sends fail with false.
   */
  relayUrl: () => string | null;
  /** Bounded reconnect schedule in ms; the last entry repeats. */
  reconnectDelaysMs?: number[];
}

export interface CallSignalListenerHandle {
  stop(): void;
  status(): CallSignalListenerStatus;
}

interface ListenerState {
  token: string;
  onFrame: (frame: Uint8Array) => void;
  onStatus?: (status: CallSignalListenerStatus) => void;
  session: RelaySession | null;
  attempt: number;
  timer: ReturnType<typeof setTimeout> | null;
  stopped: boolean;
  status: CallSignalListenerStatus;
}

const DEFAULT_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

function usableRelayUrl(value: string | null): string | null {
  return value && value.startsWith('ws') ? value : null;
}

export class CallSignalTransport {
  private readonly deps: CallSignalTransportDeps;
  private readonly delays: number[];
  private readonly listeners = new Map<string, ListenerState>();
  private destroyed = false;

  constructor(deps: CallSignalTransportDeps) {
    this.deps = deps;
    const delays = deps.reconnectDelaysMs?.filter((d) => Number.isFinite(d) && d > 0);
    this.delays = delays && delays.length > 0 ? delays : DEFAULT_RECONNECT_DELAYS_MS;
  }

  /**
   * Hold an open listener on a token so inbound frames arrive in near-real
   * time. Frames are delivered raw and UNVERIFIED: the consumer must open the
   * sealed frame and pass it through verifyCallSignal before acting (NC-25.2).
   * Listening again on the same token replaces the previous listener.
   */
  listen(
    token: string,
    onFrame: (frame: Uint8Array) => void,
    onStatus?: (status: CallSignalListenerStatus) => void,
  ): CallSignalListenerHandle {
    if (this.destroyed || token.trim().length === 0) {
      onStatus?.('stopped');
      return { stop: () => undefined, status: () => 'stopped' };
    }
    const existing = this.listeners.get(token);
    if (existing) {
      this.listeners.delete(token);
      this.teardownListener(existing);
    }
    const state: ListenerState = {
      token,
      onFrame,
      onStatus,
      session: null,
      attempt: 0,
      timer: null,
      stopped: false,
      status: 'connecting',
    };
    this.listeners.set(token, state);
    try {
      onStatus?.('connecting');
    } catch {
      // Status observers cannot interrupt the transport.
    }
    void this.openListener(state);
    return {
      stop: () => {
        if (this.listeners.get(token) === state) this.listeners.delete(token);
        this.teardownListener(state);
      },
      status: () => state.status,
    };
  }

  /**
   * Send one sealed frame on a token. Reuses this transport's open listener
   * session for the token when present, else makes a one-shot connection.
   * Returns true ONLY after a real socket send succeeded; the relay forwards
   * it immediately when the peer is joined, or parks it (TTL mailbox) when
   * not. False is the honest failure: nothing left this device.
   */
  async sendFrame(token: string, frame: Uint8Array): Promise<boolean> {
    if (this.destroyed || token.trim().length === 0) return false;

    const listener = this.listeners.get(token);
    if (listener?.session && !listener.stopped) {
      try {
        await listener.session.send(frame);
        return true;
      } catch {
        // Fall through to a fresh one-shot connection below.
      }
    }

    const url = usableRelayUrl(this.deps.relayUrl());
    if (!url) return false;
    let session: RelaySession | null = null;
    try {
      session = await this.deps.backend.connect(url, token);
      await session.send(frame);
      return true;
    } catch {
      return false;
    } finally {
      if (session) {
        try {
          await session.close();
        } catch {
          // A close failure cannot un-send the frame.
        }
      }
    }
  }

  /** Whether a live listener session is currently held on this token. */
  isListening(token: string): boolean {
    const state = this.listeners.get(token);
    return Boolean(state && !state.stopped && state.session && state.status === 'listening');
  }

  destroy(): void {
    this.destroyed = true;
    for (const state of [...this.listeners.values()]) this.teardownListener(state);
    this.listeners.clear();
  }

  private async openListener(state: ListenerState): Promise<void> {
    if (state.stopped || this.destroyed) return;
    const url = usableRelayUrl(this.deps.relayUrl());
    if (!url) {
      this.setStatus(state, 'unavailable');
      this.scheduleReconnect(state);
      return;
    }
    this.setStatus(state, 'connecting');
    let session: RelaySession;
    try {
      session = await this.deps.backend.connect(url, state.token);
    } catch {
      this.setStatus(state, 'unavailable');
      this.scheduleReconnect(state);
      return;
    }
    if (state.stopped || this.destroyed) {
      try {
        await session.close();
      } catch {
        // Already stopping; nothing to recover.
      }
      return;
    }
    state.session = session;
    state.attempt = 0;
    session.onMessage((frame) => {
      if (state.stopped) return;
      try {
        state.onFrame(frame);
      } catch {
        // A consumer failure cannot take the listener down.
      }
    });
    session.onClose?.(() => {
      if (state.stopped || state.session !== session) return;
      state.session = null;
      this.setStatus(state, 'unavailable');
      this.scheduleReconnect(state);
    });
    this.setStatus(state, 'listening');
  }

  private scheduleReconnect(state: ListenerState): void {
    if (state.stopped || this.destroyed || state.timer) return;
    const delay = this.delays[Math.min(state.attempt, this.delays.length - 1)] as number;
    state.attempt += 1;
    state.timer = setTimeout(() => {
      state.timer = null;
      void this.openListener(state);
    }, delay);
    (state.timer as { unref?: () => void }).unref?.();
  }

  private teardownListener(state: ListenerState): void {
    state.stopped = true;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    const session = state.session;
    state.session = null;
    if (session) {
      try {
        void Promise.resolve(session.close()).catch(() => undefined);
      } catch {
        // Teardown remains authoritative when close throws.
      }
    }
    this.setStatus(state, 'stopped');
  }

  private setStatus(state: ListenerState, status: CallSignalListenerStatus): void {
    if (state.status === status) return;
    state.status = status;
    try {
      state.onStatus?.(status);
    } catch {
      // Status observers cannot interrupt the transport.
    }
  }
}

export function createCallSignalTransport(deps: CallSignalTransportDeps): CallSignalTransport {
  return new CallSignalTransport(deps);
}
