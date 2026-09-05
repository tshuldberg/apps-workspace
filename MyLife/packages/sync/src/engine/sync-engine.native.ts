/**
 * React Native-safe SyncEngine facade.
 *
 * The full engine depends on Automerge's WASM web bundle through the CRDT
 * document manager. Hermes cannot bundle that path, so native apps use this
 * lightweight facade for bootstrap, status, and outbound change-log recording.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type {
  DeviceIdentity,
  DiscoveredPeer,
  PairedDevice,
  SyncSession,
  SyncTier,
  TransportConnection,
} from '../types';
import { ChangeTracker } from '../crdt/change-tracker';
import { DocumentManager } from '../crdt/document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';
import type { SessionBlobProvider } from '../protocol/blob-transfer';
import type { CommunityTransportPolicy } from '../protocol/community';
import { getPairedDevices } from '../db/queries';
import { WebRTCTransport, type SignalingFn } from '../transport/webrtc-transport';
import { NearbyTransport } from '../transport/nearby-transport';
import type { DataTransportBackendFactories } from '../transport/data-transport-backend';
import {
  forbiddenLayerIdsForPolicy,
  selectDialableTransportLayers,
} from '../transport/transport-manager';
import { SyncStatusStore } from './sync-status';

/** Nearby peer transport layer id (transport-manager L2). */
const NEARBY_LAYER_ID = 2;
/** Direct WebRTC transport layer id (transport-manager L4). */
const WEBRTC_LAYER_ID = 4;

/** Options for a native data-transport dial (WebRTC / Nearby). */
export interface NativeDataTransportDialOptions {
  /** Ranked layer preference (transport-manager ids). The mutual/available intersection is dialed. */
  preferredLayerIds?: readonly number[];
  /** HARD cap: layer ids that must never be dialed (Plan 27, NC-3). */
  forbiddenLayerIds?: readonly number[];
  /** A community's signed transport policy; forbidden layers are derived from it when set. */
  communityTransportPolicy?: CommunityTransportPolicy;
}

export interface NativeWebRTCOffer {
  peerDeviceId: string;
  offerSdp: string;
  signaling: SignalingFn;
}

/** Pair-authenticated SDP/ICE signaling supplied by the native app. */
export interface NativeWebRTCSignaling {
  /** True when the signaling implementation is wired, not a reachability claim. */
  isAvailable(): boolean;
  /** Create one session-scoped signaling channel for an outbound dial. */
  createSignaling(peerDeviceId: string): SignalingFn | null;
  /** Listen for pair-authenticated offers. Returns a teardown function. */
  listenForOffers(handler: (offer: NativeWebRTCOffer) => void): () => void;
  /** Release relay listeners and signaling resources. */
  destroy?(): void;
}

export interface SyncEngineOptions {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  modulePrefixes: Map<string, string>;
  enabledModules: string[];
  modulePolicies?: Map<string, ModuleSyncPolicy>;
  isOwnDevice?: (peerDeviceId: string) => boolean;
  /** Injectable document manager (defaults to the platform-resolved one). */
  documentManager?: DocumentManager;
  /** App-provided storage for blob bytes referenced by synced rows. */
  blobProvider?: SessionBlobProvider;
  syncTier?: SyncTier;
  /**
   * Enable the session gossip phase (Plan 27/28 P4, AM6): when true, every
   * session this engine runs exchanges signed revocations + community
   * descriptors as a GOSSIP message before BYE, so removals/revocations
   * converge across the mesh. The shared foreground round (auto-connect) sets
   * this; default false leaves session timing unchanged.
   */
  gossip?: boolean;
  /**
   * App-injected REAL native data-transport backend factories (WebRTC / Nearby /
   * BLE). When provided, this facade can dial WebRTC/Nearby sessions on demand
   * and handle inbound ones, so the byte-movers the app already defines actually
   * carry sessions. Each factory lazy-requires its native module and returns
   * null when absent (Expo Go / web), leaving that rung unavailable and never
   * dialed. BLE stays wake-only and never carries data. Omit to keep the prior
   * app-dials-externally behavior unchanged.
   */
  dataTransportFactories?: DataTransportBackendFactories;
  /** Required when the real WebRTC backend declares external signaling. */
  webRTCSignaling?: NativeWebRTCSignaling;
  schedulerOptions?: {
    minIntervalMs?: number;
    maxIntervalMs?: number;
    activeIntervalMs?: number;
  };
}

export class SyncEngine {
  private readonly db: DatabaseAdapter;
  private readonly identity: DeviceIdentity;
  private readonly modulePolicies: Map<string, ModuleSyncPolicy>;
  private readonly enabledModules: string[];
  private readonly changeTracker: ChangeTracker;
  private readonly documentManager: DocumentManager;
  private readonly blobProvider?: SessionBlobProvider;
  private readonly gossip: boolean;
  private readonly isOwnDevice?: (peerDeviceId: string) => boolean;
  private readonly statusStore = new SyncStatusStore();
  /** Real native data transports, built only when the app injects factories. */
  private readonly webrtcTransport?: WebRTCTransport;
  private readonly nearbyTransport?: NearbyTransport;
  private readonly webRTCSignaling?: NativeWebRTCSignaling;
  private stopWebRTCSignaling?: () => void;
  private initialized = false;
  private destroyed = false;

  constructor(options: SyncEngineOptions) {
    this.db = options.db;
    this.identity = options.identity;
    this.modulePolicies = options.modulePolicies ?? new Map();
    this.enabledModules = [...options.enabledModules];
    this.documentManager = options.documentManager ?? new DocumentManager();
    this.blobProvider = options.blobProvider;
    this.gossip = options.gossip ?? false;
    this.isOwnDevice = options.isOwnDevice;
    this.webRTCSignaling = options.webRTCSignaling;
    void options.syncTier;
    void options.schedulerOptions;

    // Resolve the app-injected real native byte-movers. Each factory
    // lazy-requires its native module and returns null when absent, which leaves
    // the rung's Simulated fallback in place with isAvailable === false so the
    // selector never offers or dials it. An inbound native session drives a
    // responder session through the same handler the app calls externally.
    const factories = options.dataTransportFactories;
    if (factories) {
      this.webrtcTransport = new WebRTCTransport({
        backend: factories.loadWebRTCBackend?.() ?? undefined,
        onIncomingConnection: (conn) => { void this.handleIncomingConnection(conn); },
      });
      this.nearbyTransport = new NearbyTransport({
        backend: factories.loadNearbyBackend?.() ?? undefined,
        onIncomingConnection: (conn) => { void this.handleIncomingConnection(conn); },
      });
    }

    this.changeTracker = new ChangeTracker({
      db: options.db,
      deviceId: options.identity.publicKey,
      modulePrefixes: options.modulePrefixes,
      modulePolicies: this.modulePolicies,
      onChangeRecorded: () => {
        this.statusStore.setPendingChanges(this.changeTracker.getPendingCount());
      },
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.assertNotDestroyed();

    this.statusStore.setState('idle');
    this.statusStore.setPairedDeviceCount(getPairedDevices(this.db).length);
    this.statusStore.setPendingChanges(this.changeTracker.getPendingCount());
    this.initialized = true;
    if (
      this.webrtcTransport?.isAvailable
      && this.webrtcTransport.requiresExternalSignaling
      && this.webRTCSignaling?.isAvailable()
    ) {
      this.stopWebRTCSignaling = this.webRTCSignaling.listenForOffers((offer) => {
        void this.webrtcTransport?.acceptConnection(
          offer.peerDeviceId,
          offer.offerSdp,
          offer.signaling,
        ).catch(() => undefined);
      });
    }
  }

  async syncNow(): Promise<void> {
    this.assertInitialized();
    this.statusStore.recordSync(`native_${Date.now()}`);
  }

  recordChange(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    rowId: string,
    data: Record<string, unknown> | null,
  ): void {
    this.assertInitialized();
    this.changeTracker.recordChange(table, operation, rowId, data);
    // Reflect the local change into the document using the SAME outbound scope
    // and column filter as the change log, so device_local rows and stripped
    // columns never reach the document (and therefore never the wire).
    const { moduleId, include, data: filteredData } = this.changeTracker.filterForSync(table, operation, data);
    if (moduleId && include) {
      this.documentManager.applyChange(moduleId, { table, rowId, operation, data: filteredData });
    }
  }

  pause(): void {
    this.statusStore.setState('idle');
  }

  resume(): void {
    this.assertNotDestroyed();
  }

  getStatus(): ReturnType<SyncStatusStore['getStatus']> {
    return this.statusStore.getStatus();
  }

  getStatusStore(): SyncStatusStore {
    return this.statusStore;
  }

  getModulePolicies(): Map<string, ModuleSyncPolicy> {
    return new Map(this.modulePolicies);
  }

  getChangeTracker(): ChangeTracker {
    return this.changeTracker;
  }

  getDocumentManager(): DocumentManager {
    return this.documentManager;
  }

  getDiscoveredPeers(): DiscoveredPeer[] {
    return [];
  }

  getPairedDevices(): PairedDevice[] {
    return getPairedDevices(this.db);
  }

  async shareEntity(_opts: {
    toDeviceId: string;
    moduleId: string;
    tableName: string;
    rowId: string;
    data: Record<string, unknown>;
    workspaceId?: string;
  }): Promise<{ shareId: string; delivered: boolean; transport: null }> {
    this.assertInitialized();
    throw new Error('Direct sync sharing is not available in the native sync bundle.');
  }

  async handleIncomingConnection(conn: TransportConnection): Promise<SyncSession | undefined> {
    this.assertInitialized();
    this.statusStore.setState('syncing');
    try {
      const result = await runResponderSession(conn, {
        db: this.db,
        identity: this.identity,
        pairedDevices: getPairedDevices(this.db),
        documentManager: this.documentManager,
        changeTracker: this.changeTracker,
        enabledModules: this.enabledModules,
        modulePolicies: this.modulePolicies,
        isOwnDevice: this.isOwnDevice,
        transport: conn.transport,
        blobProvider: this.blobProvider,
        gossip: this.gossip,
      });
      if (result.session.status === 'completed') this.statusStore.recordSync(result.session.id);
      else this.statusStore.setState('error');
      return result.session;
    } catch {
      this.statusStore.setState('error');
    }
  }

  /**
   * The native DATA transport layers dialable on this build: Nearby (2) and/or
   * WebRTC (4), included only when their real native backend was injected and is
   * present (isAvailable). BLE (3) is never here (wake-only, never data). Empty
   * when no factories were injected. Feed this to the ranked-choice selector.
   */
  getAvailableNativeDataLayers(): number[] {
    const layers: number[] = [];
    if (this.nearbyTransport?.isAvailable) layers.push(NEARBY_LAYER_ID);
    if (
      this.webrtcTransport?.isAvailable
      && (
        !this.webrtcTransport.requiresExternalSignaling
        || this.webRTCSignaling?.isAvailable() === true
      )
    ) layers.push(WEBRTC_LAYER_ID);
    return layers;
  }

  /**
   * Dial a peer over a real native data transport (WebRTC / Nearby), on demand.
   *
   * Intersects the caller's ranked preference with the layers actually available
   * on this build (getAvailableNativeDataLayers) via the shared ranked-choice
   * selector, then drops any layer the community's Plan 27 transport policy
   * forbids (a local_only community never rides WebRTC). Absent an explicit
   * preference the facade is local-first: Nearby (2) is ranked before WebRTC (4)
   * (WebRTC is a WAN rung), so presence and payloads prefer the local transport.
   * Dials the highest surviving candidate and returns its TransportConnection, or
   * null when no native data transport is reachable/permitted (honest: never a
   * fabricated connection). The caller feeds the connection to syncWithConnection.
   */
  async dialPeerViaNativeDataTransport(
    peerDeviceId: string,
    options: NativeDataTransportDialOptions = {},
  ): Promise<TransportConnection | null> {
    this.assertInitialized();

    const forbidden = new Set<number>([
      ...(options.forbiddenLayerIds ?? []),
      ...(options.communityTransportPolicy
        ? forbiddenLayerIdsForPolicy(options.communityTransportPolicy)
        : []),
    ]);

    // Local-first default: prefer Nearby (2) over WebRTC (4) when the caller
    // gives no ranking, overriding the shared ladder's WebRTC-before-Nearby order.
    const preferred = options.preferredLayerIds ?? [NEARBY_LAYER_ID, WEBRTC_LAYER_ID];
    const candidates = selectDialableTransportLayers(
      preferred,
      this.getAvailableNativeDataLayers(),
      true,
    ).filter((layerId) => !forbidden.has(layerId));

    for (const layerId of candidates) {
      try {
        if (layerId === NEARBY_LAYER_ID) {
          if (!this.nearbyTransport) continue;
          return await this.nearbyTransport.connect(peerDeviceId);
        }
        if (!this.webrtcTransport) continue;
        if (!this.webrtcTransport.requiresExternalSignaling) {
          return await this.webrtcTransport.connect(peerDeviceId);
        }
        const signaling = this.webRTCSignaling?.createSignaling(peerDeviceId);
        if (!signaling) continue;
        return await this.webrtcTransport.connectToPeer(peerDeviceId, signaling);
      } catch {
        // A failed rung falls through to the next candidate; never fabricate one.
      }
    }
    return null;
  }

  /**
   * Dial a peer over a native data transport and run a full initiator session,
   * returning the recorded session, or null when no native transport was
   * reachable. The connection is closed after the session completes or throws.
   */
  async syncViaNativeDataTransport(
    peerDeviceId: string,
    options: NativeDataTransportDialOptions = {},
  ): Promise<SyncSession | null> {
    const conn = await this.dialPeerViaNativeDataTransport(peerDeviceId, options);
    if (!conn) return null;
    try {
      return await this.syncWithConnection(conn);
    } finally {
      await conn.close().catch(() => {});
    }
  }

  /**
   * Begin listening for inbound native data sessions: start Nearby advertising +
   * browsing so a co-located peer can open a session (WebRTC inbound is handled
   * by its backend's incoming-session callback, wired in the constructor). No-op
   * when no factories were injected. Inbound sessions drive a responder session
   * through handleIncomingConnection.
   */
  startNativeDataTransportListening(): void {
    this.assertInitialized();
    this.nearbyTransport?.startAdvertising(this.identity.displayName);
    this.nearbyTransport?.startBrowsing();
  }

  /** Stop native inbound listening (Nearby advertising + browsing). */
  stopNativeDataTransportListening(): void {
    this.nearbyTransport?.stopAdvertising();
    this.nearbyTransport?.stopBrowsing();
  }

  /**
   * Dial a peer over an established connection as the initiator and run a
   * full sync session (MK-008). Returns the recorded session.
   */
  async syncWithConnection(conn: TransportConnection): Promise<SyncSession> {
    this.assertInitialized();
    this.statusStore.setState('syncing');
    try {
      const result = await runInitiatorSession(conn, {
        db: this.db,
        identity: this.identity,
        pairedDevices: getPairedDevices(this.db),
        documentManager: this.documentManager,
        changeTracker: this.changeTracker,
        enabledModules: this.enabledModules,
        modulePolicies: this.modulePolicies,
        isOwnDevice: this.isOwnDevice,
        transport: conn.transport,
        blobProvider: this.blobProvider,
        gossip: this.gossip,
      });
      this.statusStore.recordSync(result.session.id);
      return result.session;
    } catch (error) {
      this.statusStore.setState('error');
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.initialized = false;
    this.stopWebRTCSignaling?.();
    this.stopWebRTCSignaling = undefined;
    this.webRTCSignaling?.destroy?.();
    await this.webrtcTransport?.destroy().catch(() => {});
    await this.nearbyTransport?.destroy().catch(() => {});
    this.statusStore.setState('idle');
  }

  private assertInitialized(): void {
    if (!this.initialized) throw new Error('SyncEngine not initialized. Call initialize() first.');
    this.assertNotDestroyed();
  }

  private assertNotDestroyed(): void {
    if (this.destroyed) throw new Error('SyncEngine has been destroyed.');
  }
}
