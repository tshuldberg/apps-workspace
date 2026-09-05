/**
 * Transport manager that coordinates LAN, nearby peer, BLE, WebRTC,
 * and encrypted relay transports.
 *
 * Auto-selects the best available transport for connecting to a peer
 * using a ranked ladder: LAN first, then nearby peer (Apple Multipeer /
 * Android Wi-Fi Direct), then BLE wake-up (signal only, no data channel),
 * then WebRTC, then encrypted relay (terminal).
 *
 * Tier enforcement gates which layers a device may use based on its
 * SyncTier subscription level.
 */

import type { TransportConnection, DiscoveredPeer, SyncTier, SyncTransport } from '../types';
import type { CommunityTransportPolicy } from '../protocol/community';
import { LANDiscovery } from './lan-discovery';
import type { LANDiscoveryOptions } from './lan-discovery';
import { LANTransport } from './lan-transport';
import { NearbyTransport } from './nearby-transport';
import { BleTransport } from './ble-transport';
import type { BleWakeUpPayload } from './ble-transport';
import { WebRTCTransport } from './webrtc-transport';
import { RelayTransport } from './relay-transport';
import type {
  WebRTCBackendFactory,
  NearbyBackendFactory,
  BleBackendFactory,
} from './data-transport-backend';

export interface TransportManagerOptions {
  /** This device's public key / identifier. */
  deviceId: string;
  /** Human-readable name for this device. */
  displayName: string;
  /** Port for LAN discovery and transport. */
  lanPort?: number;
  /** Called when a new peer is discovered on any transport. */
  onPeerDiscovered?: (peer: DiscoveredPeer) => void;
  /** Called when a peer is no longer reachable. */
  onPeerLost?: (deviceId: string) => void;
  /** Called when a new connection is established (inbound or outbound). */
  onConnection?: (connection: TransportConnection) => void;
  /** Called when a BLE wake-up signal is received from a nearby device. */
  onBleWakeUp?: (payload: BleWakeUpPayload) => void;
  /** WebRTC ICE server configuration. */
  iceServers?: Array<{ urls: string | string[] }>;
  /** Relay server URL. */
  relayUrl?: string;
  /** User's sync tier for transport access control. */
  syncTier?: SyncTier;
  /**
   * App-injected factory for the REAL native WebRTC backend (lazy-requires
   * react-native-webrtc). Returns null when the native module is absent, which
   * leaves the WebRTC rung unavailable (Simulated fallback), never dialed.
   */
  loadWebRTCBackend?: WebRTCBackendFactory;
  /** App-injected factory for the REAL native Nearby backend (or null). */
  loadNearbyBackend?: NearbyBackendFactory;
  /** App-injected factory for the REAL native BLE wake backend (or null). */
  loadBleBackend?: BleBackendFactory;
}

export interface TransportDialOptions {
  /** Layer IDs to try before the default ladder. Layer 3 is BLE wake-up only. */
  preferredLayerIds?: number[];
  /** Relay token to use if layer 5 is attempted. */
  relayToken?: string;
  /** Defaults to true so failed ranked choices still fall through safely. */
  fallbackToDefaultLadder?: boolean;
  /**
   * HARD cap (Plan 27): layer ids that must never be dialed for this connect,
   * enforced INSIDE the dial paths so no combination of preferredLayerIds and
   * fallbackToDefaultLadder can re-append a forbidden rung. Derive from a
   * community's signed policy with forbiddenLayerIdsForPolicy. A per-user
   * preference can never override this upward (NC-3).
   */
  forbiddenLayerIds?: readonly number[];
}

/**
 * The dial layers a community's SIGNED transport policy forbids (Plan 27).
 * `local_only` forbids the WAN data layers (4 WebRTC, 5 relay); LAN (1) and
 * Nearby (2) stay dialable and BLE (3) is wake-only by construction (NC-2),
 * so it needs no entry. This is DIAL defense-in-depth: the row gates in
 * sync-session.ts are the actual guarantee.
 */
export function forbiddenLayerIdsForPolicy(policy: CommunityTransportPolicy): number[] {
  return policy === 'local_only' ? [4, 5] : [];
}

/**
 * Default dial ladder (MK-014, decisions D1/D2): relay first -- it works on
 * any network and hides metadata behind ephemeral tokens -- then LAN on
 * shared Wi-Fi, then direct WebRTC, then nearby. BLE (3) stays wake-up-only.
 */
const DEFAULT_TRANSPORT_LAYER_ORDER = [5, 1, 4, 2, 3] as const;

/**
 * Layer ids that can carry sync DATA. BLE (3) is deliberately absent: it is a
 * wake-only rung (GATT notify) and moves no file/media bytes (NC-12 / L8).
 */
export const DATA_TRANSPORT_LAYER_IDS: ReadonlySet<number> = new Set([1, 2, 4, 5]);

export function buildTransportLayerDialOrder(
  preferredLayerIds: readonly number[] = [],
  fallbackToDefaultLadder = true,
): number[] {
  const seen = new Set<number>();
  const order: number[] = [];

  for (const layerId of preferredLayerIds) {
    if (!DEFAULT_TRANSPORT_LAYER_ORDER.includes(layerId as (typeof DEFAULT_TRANSPORT_LAYER_ORDER)[number])) {
      continue;
    }
    if (seen.has(layerId)) continue;
    seen.add(layerId);
    order.push(layerId);
  }

  if (fallbackToDefaultLadder) {
    for (const layerId of DEFAULT_TRANSPORT_LAYER_ORDER) {
      if (seen.has(layerId)) continue;
      seen.add(layerId);
      order.push(layerId);
    }
  }

  return order;
}

/**
 * Compute the final, dialable transport ladder.
 *
 * Intersects the peer's preferred layer list with the default ladder
 * (buildTransportLayerDialOrder), then keeps ONLY layers that are both a DATA
 * transport (BLE excluded) and currently AVAILABLE (their real native backend
 * is present). A rung whose backend is missing/Simulated is dropped, so the
 * selector never offers or dials a "Not available on this build" rung. Order is
 * preserved so failed higher choices fall through to lower ones.
 */
export function selectDialableTransportLayers(
  preferredLayerIds: readonly number[] = [],
  availableLayerIds: Iterable<number> = [],
  fallbackToDefaultLadder = true,
): number[] {
  const available = new Set(availableLayerIds);
  return buildTransportLayerDialOrder(preferredLayerIds, fallbackToDefaultLadder).filter(
    (layerId) => DATA_TRANSPORT_LAYER_IDS.has(layerId) && available.has(layerId),
  );
}

function transportToLayerId(transport: SyncTransport): number {
  switch (transport) {
    case 'lan':
      return 1;
    case 'nearby':
      return 2;
    case 'ble':
      return 3;
    case 'wan_webrtc':
      return 4;
    case 'wan_relay':
      return 5;
  }
}

/**
 * Coordinates all transport layers (LAN, nearby peer, BLE).
 *
 * Provides a single interface for:
 * - Discovering peers across all transports
 * - Connecting to peers using the best available transport
 * - Tracking active connections
 * - Receiving BLE wake-up signals from nearby devices
 */
export class TransportManager {
  private readonly _options: TransportManagerOptions;
  private readonly _lanDiscovery: LANDiscovery;
  private readonly _lanTransport: LANTransport;
  private readonly _nearbyTransport: NearbyTransport;
  private readonly _bleTransport: BleTransport;
  private readonly _webrtcTransport: WebRTCTransport;
  private readonly _relayTransport: RelayTransport;
  private readonly _outboundDialDeviceIds: Set<string> = new Set();
  private _initialized = false;
  private _destroyed = false;

  constructor(options: TransportManagerOptions) {
    this._options = options;

    const discoveryOpts: LANDiscoveryOptions = {
      deviceId: options.deviceId,
      displayName: options.displayName,
      port: options.lanPort,
    };

    this._lanDiscovery = new LANDiscovery(discoveryOpts);
    this._lanTransport = new LANTransport({
      listenPort: options.lanPort,
      onConnection: (connection) => this._handleTransportConnection(connection),
    });

    // Resolve the app-injected native backends. Each factory lazy-requires its
    // native module (react-native-webrtc / Nearby / BLE) and returns null when
    // absent, mirroring apps/meerkat/app/(root)/data/lan-backend.ts. A null (or
    // omitted factory) leaves the rung on its Simulated fallback with
    // isAvailable === false, so the selector never offers or dials it.
    const nearbyBackend = options.loadNearbyBackend?.() ?? undefined;
    const bleBackend = options.loadBleBackend?.() ?? undefined;
    const webrtcBackend = options.loadWebRTCBackend?.() ?? undefined;

    this._nearbyTransport = new NearbyTransport({
      backend: nearbyBackend,
      onConnection: (connection) => this._handleTransportConnection(connection),
    });

    this._bleTransport = new BleTransport({
      backend: bleBackend,
      onWakeUp: (payload) => {
        this._options.onBleWakeUp?.(payload);
      },
    });

    this._webrtcTransport = new WebRTCTransport({
      backend: webrtcBackend,
      iceServers: options.iceServers,
      onConnection: (connection) => this._handleTransportConnection(connection),
    });

    this._relayTransport = new RelayTransport({
      relayUrl: options.relayUrl,
      onConnection: (connection) => this._handleTransportConnection(connection),
    });

    // Wire up LAN discovery events
    this._lanDiscovery.on({
      onPeerFound: (peer) => {
        this._options.onPeerDiscovered?.(peer);
      },
      onPeerLost: (deviceId) => {
        this._options.onPeerLost?.(deviceId);
      },
    });
  }

  /** Whether the manager has been initialized. */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /** Access the underlying LAN discovery instance (for testing / simulation). */
  get lanDiscovery(): LANDiscovery {
    return this._lanDiscovery;
  }

  /** Access the underlying LAN transport instance. */
  get lanTransport(): LANTransport {
    return this._lanTransport;
  }

  /** Access the underlying nearby transport instance. */
  get nearbyTransport(): NearbyTransport {
    return this._nearbyTransport;
  }

  /** Access the underlying BLE transport instance. */
  get bleTransport(): BleTransport {
    return this._bleTransport;
  }

  /** Access the underlying WebRTC transport instance. */
  get webrtcTransport(): WebRTCTransport {
    return this._webrtcTransport;
  }

  /** Access the underlying relay transport instance. */
  get relayTransport(): RelayTransport {
    return this._relayTransport;
  }

  /**
   * Initialize all transport layers.
   *
   * Starts LAN discovery (advertising + browsing), begins listening
   * for incoming LAN connections, starts nearby peer advertising and
   * browsing, and starts BLE scanning for wake-up signals.
   */
  async initialize(): Promise<void> {
    this._assertNotDestroyed();
    if (this._initialized) return;

    // LAN transport
    this._lanDiscovery.startAdvertising();
    this._lanDiscovery.startBrowsing();
    await this._lanTransport.startListening();

    // Nearby transport (Apple Multipeer / Android Wi-Fi Direct)
    this._nearbyTransport.startAdvertising(this._options.displayName);
    this._nearbyTransport.startBrowsing();

    // BLE scanning for wake-up signals
    this._bleTransport.startScanning();

    this._initialized = true;
  }

  /**
   * Connect to a peer using the best available transport.
   *
   * Walks the transport ladder: LAN first, then nearby peer, then
   * BLE wake-up (signal only), then WebRTC, then encrypted relay
   * (terminal). Tier enforcement gates which layers are attempted.
   *
   * @throws Error if the peer is not reachable on any transport layer.
   */
  async connectToPeer(
    deviceId: string,
    options: TransportDialOptions = {},
  ): Promise<TransportConnection> {
    this._assertNotDestroyed();

    const layerOrder = buildTransportLayerDialOrder(
      options.preferredLayerIds,
      options.fallbackToDefaultLadder ?? true,
    );
    const forbidden = new Set(options.forbiddenLayerIds ?? []);

    // Check existing connections across all transports. A forbidden layer's
    // existing connection is NOT reused for this dial either (Plan 27): the
    // caller asked for a connect its policy permits.
    const existing = this._getExistingConnection(deviceId, layerOrder, forbidden);
    if (existing) return existing;

    const availableDataLayers = new Set(this.getAvailableDataLayers());

    for (const layerId of layerOrder) {
      if (!this._isTierAllowed(layerId)) continue;
      if (!DATA_TRANSPORT_LAYER_IDS.has(layerId)) {
        // BLE is wake-up only. It participates in preference ranking but
        // cannot create a data channel, so continue to the next candidate.
        continue;
      }
      if (!availableDataLayers.has(layerId)) {
        // Native rung with no real backend on this build (Simulated / native
        // module absent). Never offer or dial it; fall through to the next.
        continue;
      }

      const connection = await this._tryConnectViaLayer(
        layerId,
        deviceId,
        options.relayToken,
        forbidden,
      );
      if (connection) return connection;
    }

    throw new Error(
      `Peer ${deviceId} is not reachable on any available transport layer.`,
    );
  }

  /**
   * Connect to a peer via the encrypted relay with an explicit token.
   *
   * Use this when the session protocol has already negotiated the relay
   * token during workspace auth. The generic `connectToPeer()` method
   * cannot pass a token, so relay-backed sessions should call this
   * directly.
   */
  async connectToPeerViaRelay(
    deviceId: string,
    token: string,
    options: { forbiddenLayerIds?: readonly number[] } = {},
  ): Promise<TransportConnection> {
    this._assertNotDestroyed();
    if (token.trim().length === 0) {
      throw new Error('Relay token is required for relay transport.');
    }

    // Plan 27: the relay BYPASS path must honor the same hard cap as the
    // ladder walk -- a local_only community's dial can never reach the relay
    // through this door either.
    if ((options.forbiddenLayerIds ?? []).includes(5)) {
      throw new Error('Relay transport is forbidden by this community\'s transport policy.');
    }

    if (!this._isTierAllowed(5)) {
      throw new Error(
        `Relay transport is not allowed for sync tier "${this._options.syncTier ?? 'local_only'}".`,
      );
    }

    this._outboundDialDeviceIds.add(deviceId);
    try {
      return await this._relayTransport.connectToPeer(deviceId, token);
    } finally {
      this._outboundDialDeviceIds.delete(deviceId);
    }
  }

  /**
   * The data-transport layers that are currently dialable on this build.
   *
   * LAN (1) and relay (5) retain their existing presence-based availability
   * (LAN needs a discovered peer, relay needs a token, both checked at dial
   * time). The native rungs Nearby (2) and WebRTC (4) are included ONLY when
   * their real native backend is present (isAvailable). BLE (3) is never here
   * (wake-only). Feed this to selectDialableTransportLayers for a UI ladder.
   */
  getAvailableDataLayers(): number[] {
    const layers: number[] = [1, 5];
    if (this._nearbyTransport.isAvailable) layers.push(2);
    if (this._webrtcTransport.isAvailable) layers.push(4);
    return layers.filter((layerId) => DATA_TRANSPORT_LAYER_IDS.has(layerId));
  }

  /** Get all discovered peers across all transports (deduplicated). */
  getDiscoveredPeers(): DiscoveredPeer[] {
    const lanPeers = this._lanDiscovery.getVisiblePeers();
    const nearbyPeers = this._nearbyTransport.getDiscoveredPeers();

    // Deduplicate by deviceId, LAN takes priority.
    // WebRTC and relay peers are not discoverable via broadcast; they
    // appear only after an explicit connection is established.
    const seen = new Set<string>();
    const merged: DiscoveredPeer[] = [];

    for (const peer of lanPeers) {
      seen.add(peer.deviceId);
      merged.push(peer);
    }
    for (const peer of nearbyPeers) {
      if (!seen.has(peer.deviceId)) {
        merged.push(peer);
      }
    }

    return merged;
  }

  /** Get all active connections across all transports. */
  getActiveConnections(): TransportConnection[] {
    return [
      ...this._lanTransport.getConnections(),
      ...this._nearbyTransport.getConnections(),
      ...this._webrtcTransport.getConnections(),
      ...this._relayTransport.getConnections(),
    ];
  }

  /** Check if a specific peer has an active connection. */
  isConnected(deviceId: string): boolean {
    return (
      this._lanTransport.getConnection(deviceId) !== undefined ||
      this._nearbyTransport.getConnection(deviceId) !== undefined ||
      this._webrtcTransport.getConnection(deviceId) !== undefined ||
      this._relayTransport.getConnection(deviceId) !== undefined
    );
  }

  /** Disconnect from a specific peer across all transports. */
  async disconnect(deviceId: string): Promise<void> {
    await this._lanTransport.closeConnection(deviceId);
    await this._nearbyTransport.closeConnection(deviceId);
    await this._webrtcTransport.closeConnection(deviceId);
    await this._relayTransport.closeConnection(deviceId);
  }

  /** Shut down all transports and clean up. */
  async destroy(): Promise<void> {
    if (this._destroyed) return;

    this._lanDiscovery.destroy();
    await this._lanTransport.destroy();
    await this._nearbyTransport.destroy();
    this._bleTransport.destroy();
    await this._webrtcTransport.destroy();
    await this._relayTransport.destroy();

    this._initialized = false;
    this._destroyed = true;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Check whether a transport layer is allowed for the current sync tier.
   *
   * Tier-scope compatibility matrix (architecture doc Section 14):
   * - local_only: LAN (1), Nearby (2), BLE (3)
   * - p2p:        LAN (1), Nearby (2), BLE (3), WebRTC (4)
   * - free_cloud:    all layers (1-5)
   * - starter_cloud: all layers (1-5)
   * - power_cloud:   all layers (1-5)
   */
  private _isTierAllowed(layerId: number): boolean {
    const tier = this._options.syncTier ?? 'local_only';
    const allowed: Record<string, number[]> = {
      local_only: [1, 2, 3],
      p2p: [1, 2, 3, 4],
      free_cloud: [1, 2, 3, 4, 5],
      starter_cloud: [1, 2, 3, 4, 5],
      power_cloud: [1, 2, 3, 4, 5],
    };
    return (allowed[tier] ?? []).includes(layerId);
  }

  private _getExistingConnection(
    deviceId: string,
    layerOrder: number[],
    forbiddenLayerIds: ReadonlySet<number> = new Set(),
  ): TransportConnection | null {
    const connections = [
      this._lanTransport.getConnection(deviceId),
      this._nearbyTransport.getConnection(deviceId),
      this._webrtcTransport.getConnection(deviceId),
      this._relayTransport.getConnection(deviceId),
    ].filter((conn): conn is TransportConnection => conn !== undefined)
      // Plan 27: never hand back an existing connection on a forbidden layer;
      // the caller asked for a connect its community policy permits.
      .filter((conn) => !forbiddenLayerIds.has(transportToLayerId(conn.transport)));

    for (const layerId of layerOrder) {
      const match = connections.find((conn) => transportToLayerId(conn.transport) === layerId);
      if (match) return match;
    }

    return connections[0] ?? null;
  }

  private async _tryConnectViaLayer(
    layerId: number,
    deviceId: string,
    relayToken: string | undefined,
    forbiddenLayerIds: ReadonlySet<number> = new Set(),
  ): Promise<TransportConnection | null> {
    // Plan 27 HARD cap: enforced HERE, inside the dial, so no ladder-building
    // combination (preferredLayerIds + fallbackToDefaultLadder re-appending
    // WAN) can ever reach a forbidden rung.
    if (forbiddenLayerIds.has(layerId)) return null;
    this._outboundDialDeviceIds.add(deviceId);
    try {
      switch (layerId) {
        case 1: {
          const lanPeer = this._lanDiscovery
            .getVisiblePeers()
            .find((peer) => peer.deviceId === deviceId);
          if (!lanPeer) return null;
          return await this._lanTransport.connect(lanPeer);
        }
        case 2: {
          const nearbyPeer = this._nearbyTransport
            .getDiscoveredPeers()
            .find((peer) => peer.deviceId === deviceId);
          if (!nearbyPeer) return null;
          return await this._nearbyTransport.connect(deviceId);
        }
        case 4:
          return await this._webrtcTransport.connect(deviceId);
        case 5:
          if (!relayToken || relayToken.trim().length === 0) return null;
          return await this._relayTransport.connectToPeer(deviceId, relayToken);
        default:
          return null;
      }
    } catch {
      return null;
    } finally {
      this._outboundDialDeviceIds.delete(deviceId);
    }
  }

  private _handleTransportConnection(connection: TransportConnection): void {
    if (this._outboundDialDeviceIds.has(connection.remoteDeviceId)) {
      return;
    }
    this._options.onConnection?.(connection);
  }

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('TransportManager has been destroyed.');
    }
  }
}
