/**
 * mDNS/DNS-SD service advertisement and browsing for LAN discovery.
 *
 * Discovers other MyLife devices on the local network using the
 * `_mylife-sync._tcp` service type. Platform-specific mDNS libraries
 * (react-native-zeroconf on mobile, bonjour-service on Node) are
 * injected via the `DiscoveryBackend` interface so the core logic
 * stays platform-agnostic.
 */

import type { DiscoveredPeer } from '../types';

export const MDNS_SERVICE_TYPE = '_mylife-sync._tcp';
export const MDNS_SERVICE_PORT = 42420;
export const MDNS_TXT_VERSION = '1';

// ---------------------------------------------------------------------------
// Discovery Backend Interface
// ---------------------------------------------------------------------------

/** Resolved service discovered via mDNS/DNS-SD. */
export interface ResolvedService {
  name: string;
  host: string;
  port: number;
  txt: Record<string, string>;
}

/**
 * Platform-agnostic backend for mDNS service advertisement and browsing.
 *
 * Implementations:
 * - Mobile: wraps react-native-zeroconf
 * - Node/desktop: wraps bonjour-service
 * - Test: SimulatedDiscoveryBackend (in-memory, no network)
 */
export interface DiscoveryBackend {
  advertise(serviceType: string, port: number, txtRecord: Record<string, string>): void;
  browse(serviceType: string): void;
  stopAdvertising(): void;
  stopBrowsing(): void;
  onServiceFound(handler: (service: ResolvedService) => void): void;
  onServiceLost(handler: (name: string) => void): void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Simulated Backend (testing / development)
// ---------------------------------------------------------------------------

/**
 * In-memory discovery backend for testing and development.
 *
 * Does not touch the network. Services are added and removed via
 * `injectService` / `removeService` helpers so tests can drive
 * discovery deterministically.
 */
export class SimulatedDiscoveryBackend implements DiscoveryBackend {
  private _foundHandler: ((service: ResolvedService) => void) | null = null;
  private _lostHandler: ((name: string) => void) | null = null;
  private _destroyed = false;

  advertise(_serviceType: string, _port: number, _txtRecord: Record<string, string>): void {
    // No-op in simulation mode.
  }

  browse(_serviceType: string): void {
    // No-op in simulation mode.
  }

  stopAdvertising(): void {
    // No-op in simulation mode.
  }

  stopBrowsing(): void {
    // No-op in simulation mode.
  }

  onServiceFound(handler: (service: ResolvedService) => void): void {
    this._foundHandler = handler;
  }

  onServiceLost(handler: (name: string) => void): void {
    this._lostHandler = handler;
  }

  destroy(): void {
    this._foundHandler = null;
    this._lostHandler = null;
    this._destroyed = true;
  }

  /** Inject a service into the simulated network. */
  injectService(service: ResolvedService): void {
    if (this._destroyed) return;
    this._foundHandler?.(service);
  }

  /** Remove a service from the simulated network. */
  removeService(name: string): void {
    if (this._destroyed) return;
    this._lostHandler?.(name);
  }
}

// ---------------------------------------------------------------------------
// LANDiscovery Options & Events
// ---------------------------------------------------------------------------

export interface LANDiscoveryOptions {
  deviceId: string;
  displayName: string;
  port?: number;
  /** Injectable mDNS backend. Falls back to SimulatedDiscoveryBackend. */
  backend?: DiscoveryBackend;
}

/** Event callbacks for LAN discovery lifecycle. */
export interface LANDiscoveryEvents {
  onPeerFound: (peer: DiscoveredPeer) => void;
  onPeerLost: (deviceId: string) => void;
}

// ---------------------------------------------------------------------------
// LANDiscovery
// ---------------------------------------------------------------------------

/**
 * LAN peer discovery via mDNS/DNS-SD.
 *
 * Advertises this device and browses for other MyLife devices on the
 * local network. Stores discovered peers in an in-memory Map keyed
 * by device ID.
 *
 * Platform behavior is delegated to the injected `DiscoveryBackend`.
 * When no backend is provided, a `SimulatedDiscoveryBackend` is used
 * so the class works in tests and on platforms without mDNS support.
 */
export class LANDiscovery {
  private readonly _deviceId: string;
  private readonly _displayName: string;
  private readonly _port: number;
  private readonly _backend: DiscoveryBackend;
  private readonly _peers: Map<string, DiscoveredPeer> = new Map();
  /** Maps mDNS service name to deviceId for removal lookup. */
  private readonly _serviceNameToDeviceId: Map<string, string> = new Map();
  private _listeners: Partial<LANDiscoveryEvents> = {};
  private _advertising = false;
  private _browsing = false;
  private _destroyed = false;

  constructor(options: LANDiscoveryOptions) {
    this._deviceId = options.deviceId;
    this._displayName = options.displayName;
    this._port = options.port ?? MDNS_SERVICE_PORT;
    this._backend = options.backend ?? new SimulatedDiscoveryBackend();

    // Wire backend callbacks to internal handlers.
    this._backend.onServiceFound((service) => this._handleServiceFound(service));
    this._backend.onServiceLost((name) => this._handleServiceLost(name));
  }

  /** Whether the service is currently advertising. */
  get isAdvertising(): boolean {
    return this._advertising;
  }

  /** Whether the service is currently browsing. */
  get isBrowsing(): boolean {
    return this._browsing;
  }

  /**
   * Start advertising this device on the local network.
   *
   * Registers a DNS-SD service record for `_mylife-sync._tcp` with
   * TXT record fields: deviceId, displayName, version.
   */
  startAdvertising(): void {
    this._assertNotDestroyed();
    if (this._advertising) return;
    this._advertising = true;

    this._backend.advertise(MDNS_SERVICE_TYPE, this._port, {
      deviceId: this._deviceId,
      displayName: this._displayName,
      version: MDNS_TXT_VERSION,
    });
  }

  /** Stop advertising. */
  stopAdvertising(): void {
    if (!this._advertising) return;
    this._advertising = false;
    this._backend.stopAdvertising();
  }

  /**
   * Start browsing for other MyLife devices on the network.
   *
   * Discovered services are mapped to `DiscoveredPeer` using the
   * TXT record `deviceId` field. Self-discovery is filtered out.
   */
  startBrowsing(): void {
    this._assertNotDestroyed();
    if (this._browsing) return;
    this._browsing = true;

    this._backend.browse(MDNS_SERVICE_TYPE);
  }

  /** Stop browsing. */
  stopBrowsing(): void {
    if (!this._browsing) return;
    this._browsing = false;
    this._backend.stopBrowsing();
  }

  /** Get currently visible peers. */
  getVisiblePeers(): DiscoveredPeer[] {
    return Array.from(this._peers.values());
  }

  /** Register event handlers. */
  on(events: Partial<LANDiscoveryEvents>): void {
    this._listeners = { ...this._listeners, ...events };
  }

  /**
   * Simulate discovery of a peer. Used for testing and development
   * when the backend is a SimulatedDiscoveryBackend.
   */
  simulateDiscovery(peer: DiscoveredPeer): void {
    this._assertNotDestroyed();
    // Ignore self-discovery
    if (peer.deviceId === this._deviceId) return;

    this._peers.set(peer.deviceId, peer);
    this._listeners.onPeerFound?.(peer);
  }

  /**
   * Simulate a peer leaving the network. Used for testing and
   * development when the backend is a SimulatedDiscoveryBackend.
   */
  simulatePeerLost(deviceId: string): void {
    this._assertNotDestroyed();
    if (!this._peers.has(deviceId)) return;

    this._peers.delete(deviceId);
    this._listeners.onPeerLost?.(deviceId);
  }

  /** Clean up all resources. */
  destroy(): void {
    if (this._destroyed) return;
    this.stopAdvertising();
    this.stopBrowsing();
    this._backend.destroy();
    this._peers.clear();
    this._serviceNameToDeviceId.clear();
    this._listeners = {};
    this._destroyed = true;
  }

  // -------------------------------------------------------------------------
  // Private: Backend event handlers
  // -------------------------------------------------------------------------

  private _handleServiceFound(service: ResolvedService): void {
    if (this._destroyed) return;

    const deviceId = service.txt['deviceId'];
    if (!deviceId) return; // Missing required TXT field; skip.

    // Ignore self-discovery.
    if (deviceId === this._deviceId) return;

    const displayName = service.txt['displayName'] ?? service.name;

    const peer: DiscoveredPeer = {
      deviceId,
      displayName,
      host: service.host,
      port: service.port,
      discoveredAt: Date.now(),
    };

    this._serviceNameToDeviceId.set(service.name, deviceId);
    this._peers.set(deviceId, peer);
    this._listeners.onPeerFound?.(peer);
  }

  private _handleServiceLost(serviceName: string): void {
    if (this._destroyed) return;

    const deviceId = this._serviceNameToDeviceId.get(serviceName);
    if (!deviceId) return;

    this._serviceNameToDeviceId.delete(serviceName);
    this._peers.delete(deviceId);
    this._listeners.onPeerLost?.(deviceId);
  }

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('LANDiscovery has been destroyed.');
    }
  }
}
