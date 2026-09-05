/**
 * P2PProvider -- Device-to-device sync via WebRTC.
 *
 * Uses WebRTC data channels to transfer changesets between devices.
 * Does NOT require Supabase auth. Pairing is done via 6-digit codes.
 *
 * WebRTC connection management is delegated to WebRTCTransport. This
 * provider is a thin shell that implements SyncProvider and coordinates
 * signaling with the transport layer.
 */

import type {
  SyncProvider,
  SyncStatus,
  SyncEventListener,
  SyncEvent,
  TransportConnection,
} from '../types';
import type { Changeset } from '../changeset';
import type { RTCPeerConnectionLike } from '../signaling/webrtc';
import { WebRTCTransport, SimulatedWebRTCBackend } from '../transport/webrtc-transport';
import type { WebRTCBackend, SignalingFn } from '../transport/webrtc-transport';
import { createPairingSession, isValidPairingCode } from '../signaling/pairing';
import type { PairingSession } from '../signaling/pairing';

/**
 * Transport for signaling messages (SDP offers/answers and ICE candidates).
 * Implementations could use Supabase Realtime, a WebSocket server,
 * manual copy-paste, or any other mechanism.
 */
export interface SignalingTransport {
  /** Send a signaling message to a peer identified by pairing code. */
  send(pairingCode: string, message: SignalingMessage): Promise<void>;
  /** Register handler for incoming signaling messages. Returns unsubscribe. */
  onMessage(pairingCode: string, handler: (message: SignalingMessage) => void): () => void;
}

export type SignalingMessage =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice-candidate'; candidate: string }
  | { type: 'changeset'; data: Changeset };

export interface P2PProviderOptions {
  /** Unique identifier for this device. */
  deviceId: string;
  /**
   * Factory to create platform-specific RTCPeerConnection.
   * Kept for backward compatibility with existing callers. Ignored when
   * `webrtcBackend` is provided.
   */
  createPeerConnection?: () => RTCPeerConnectionLike;
  /** Optional WebRTC backend. Falls back to SimulatedWebRTCBackend. */
  webrtcBackend?: WebRTCBackend;
  /** Transport for exchanging signaling messages. */
  signalingTransport: SignalingTransport;
  /** Called to get the changeset to send to the peer. */
  getOutboundChangeset: () => Promise<Changeset>;
  /** Called when a changeset is received from the peer. */
  onInboundChangeset: (changeset: Changeset) => Promise<void>;
}

export class P2PProvider implements SyncProvider {
  readonly tier = 'p2p' as const;

  private _transport: WebRTCTransport;
  private _activeConnection: TransportConnection | null = null;
  private _pairingSession: PairingSession | null = null;
  private _listeners: Set<SyncEventListener> = new Set();
  private _signalingUnsubscribe: (() => void) | null = null;
  private _connected = false;
  private _paused = false;
  private _lastSyncedAt: Date | null = null;
  private _pendingChanges = 0;
  private readonly _options: P2PProviderOptions;

  constructor(options: P2PProviderOptions) {
    this._options = options;
    this._transport = new WebRTCTransport({
      backend: options.webrtcBackend ?? new SimulatedWebRTCBackend(),
      onConnection: (conn) => this._handleConnection(conn),
    });
  }

  async initialize(): Promise<void> {
    // P2P doesn't auto-connect on init; pairing must be initiated explicitly
  }

  /**
   * Start a pairing session. Returns the 6-digit code for the remote device.
   */
  startPairing(): PairingSession {
    this._pairingSession = createPairingSession(this._options.deviceId);
    this._setupSignaling(this._pairingSession.code);
    return this._pairingSession;
  }

  /**
   * Join a pairing session using a code from another device.
   */
  async joinPairing(code: string): Promise<void> {
    if (!isValidPairingCode(code)) {
      throw new Error('Invalid pairing code. Must be 6 digits.');
    }

    this._setupSignaling(code);

    // Try the simple connect path first (works with simulated backends).
    // Fall back to signaling-driven connect for real WebRTC backends.
    let conn: TransportConnection;
    try {
      conn = await this._transport.connect(code);
    } catch {
      const signalingFn = this._createSignalingFn(code);
      conn = await this._transport.connectToPeer(code, signalingFn);
    }
    this._handleConnection(conn);
  }

  async sync(): Promise<void> {
    if (!this._connected || this._paused || !this._activeConnection) return;

    const changeset = await this._options.getOutboundChangeset();
    if (changeset.changes.length === 0) return;

    const encoded = new TextEncoder().encode(
      JSON.stringify({ type: 'changeset', data: changeset } satisfies SignalingMessage),
    );
    await this._activeConnection.send(encoded);
    this._lastSyncedAt = new Date();
    this._emit({ type: 'sync_complete', timestamp: this._lastSyncedAt });
  }

  async pause(): Promise<void> {
    this._paused = true;
  }

  async resume(): Promise<void> {
    this._paused = false;
  }

  getStatus(): SyncStatus {
    return {
      tier: 'p2p',
      connected: this._connected,
      lastSyncedAt: this._lastSyncedAt,
      storageUsedBytes: 0,
      storageLimitBytes: Infinity,
      pendingChanges: this._pendingChanges,
    };
  }

  async getStorageUsed(): Promise<number> {
    return 0;
  }

  onEvent(listener: SyncEventListener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  async destroy(): Promise<void> {
    this._signalingUnsubscribe?.();
    this._signalingUnsubscribe = null;
    await this._transport.destroy();
    this._activeConnection = null;
    this._connected = false;
    this._pairingSession = null;
    this._listeners.clear();
  }

  /** Whether we have an active peer connection. */
  get connected(): boolean {
    return this._connected;
  }

  /** The current pairing session, if any. */
  get pairingSession(): PairingSession | null {
    return this._pairingSession;
  }

  private _handleConnection(conn: TransportConnection): void {
    this._activeConnection = conn;
    this._connected = true;

    this._emit({ type: 'peer_connected', peerId: conn.remoteDeviceId });
    this._emit({ type: 'status_change', status: this.getStatus() });

    // Listen for incoming data on this connection.
    conn.onData((data) => {
      void this._handleIncomingData(data);
    });
  }

  private _createSignalingFn(code: string): SignalingFn {
    return {
      send: async (data: string) => {
        // Parse the signaling data and send it via the pairing signaling transport.
        try {
          const parsed = JSON.parse(data) as { type: string; sdp?: string; candidate?: string };
          if (parsed.type === 'offer' && parsed.sdp) {
            await this._options.signalingTransport.send(code, {
              type: 'offer',
              sdp: parsed.sdp,
            });
          } else if (parsed.type === 'answer' && parsed.sdp) {
            await this._options.signalingTransport.send(code, {
              type: 'answer',
              sdp: parsed.sdp,
            });
          } else if (parsed.type === 'ice-candidate' && parsed.candidate) {
            await this._options.signalingTransport.send(code, {
              type: 'ice-candidate',
              candidate: parsed.candidate,
            });
          }
        } catch {
          // Ignore serialization errors in signaling bridge.
        }
      },
      onMessage: (handler: (data: string) => void) => {
        return this._options.signalingTransport.onMessage(code, (message) => {
          handler(JSON.stringify(message));
        });
      },
    };
  }

  private _setupSignaling(code: string): void {
    this._signalingUnsubscribe?.();
    this._signalingUnsubscribe = this._options.signalingTransport.onMessage(
      code,
      (message) => { void this._handleSignalingMessage(code, message); },
    );
  }

  private async _handleSignalingMessage(code: string, message: SignalingMessage): Promise<void> {
    switch (message.type) {
      case 'offer': {
        // We are the responder: accept offer and send answer
        const signalingFn = this._createSignalingFn(code);
        const conn = await this._transport.acceptConnection(
          code,
          message.sdp,
          signalingFn,
        );
        this._handleConnection(conn);
        break;
      }
      case 'changeset': {
        await this._options.onInboundChangeset(message.data);
        this._lastSyncedAt = new Date();
        this._emit({ type: 'sync_complete', timestamp: this._lastSyncedAt });
        break;
      }
      // 'answer' and 'ice-candidate' are handled by the WebRTCTransport
      // via the signaling function. No action needed here.
      default:
        break;
    }
  }

  private async _handleIncomingData(data: Uint8Array): Promise<void> {
    try {
      const text = new TextDecoder().decode(data);
      const message = JSON.parse(text) as SignalingMessage;
      if (message.type === 'changeset') {
        await this._options.onInboundChangeset(message.data);
        this._lastSyncedAt = new Date();
        this._emit({ type: 'sync_complete', timestamp: this._lastSyncedAt });
      }
    } catch (err) {
      this._emit({
        type: 'sync_error',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  private _emit(event: SyncEvent): void {
    for (const listener of this._listeners) {
      listener(event);
    }
  }
}
