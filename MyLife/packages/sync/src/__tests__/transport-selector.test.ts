import { describe, it, expect } from 'vitest';
import {
  selectDialableTransportLayers,
  buildTransportLayerDialOrder,
  DATA_TRANSPORT_LAYER_IDS,
  TransportManager,
} from '../transport/transport-manager';
import { WebRTCTransport, SimulatedWebRTCBackend } from '../transport/webrtc-transport';
import type { WebRTCBackend } from '../transport/webrtc-transport';
import { NearbyTransport, SimulatedNearbyBackend } from '../transport/nearby-transport';
import type { NearbyPeerBackend } from '../transport/nearby-transport';
import { isRealBackend, TRANSPORT_UNAVAILABLE_MESSAGE } from '../transport/data-transport-backend';
import { MDNS_SERVICE_PORT } from '../transport/lan-discovery';
import type { DiscoveredPeer } from '../types';

// ---------------------------------------------------------------------------
// Real-backend test doubles: report isReal:true (rung available) while moving
// bytes through the in-memory Simulated backend. Production real adapters live
// in apps/meerkat; these only exercise the "backend present" branch.
// ---------------------------------------------------------------------------

function realWebRTCBackendDouble(): WebRTCBackend {
  const sim = new SimulatedWebRTCBackend();
  return {
    isReal: true,
    connectToPeer: (peerId) => sim.connectToPeer(peerId),
    createPeerConnection: (config) => sim.createPeerConnection(config),
    onPeerFound: (handler) => sim.onPeerFound(handler),
    onIncomingSession: (handler) => sim.onIncomingSession(handler),
    destroy: () => sim.destroy(),
  };
}

function realNearbyBackendDouble(): NearbyPeerBackend {
  const sim = new SimulatedNearbyBackend();
  return {
    isReal: true,
    advertise: (type, name) => sim.advertise(type, name),
    browse: (type) => sim.browse(type),
    stopAdvertising: () => sim.stopAdvertising(),
    stopBrowsing: () => sim.stopBrowsing(),
    connectToPeer: (id) => sim.connectToPeer(id),
    onPeerFound: (h) => sim.onPeerFound(h),
    onPeerLost: (h) => sim.onPeerLost(h),
    onIncomingSession: (h) => sim.onIncomingSession(h),
    destroy: () => sim.destroy(),
  };
}

function makePeer(overrides: Partial<DiscoveredPeer> = {}): DiscoveredPeer {
  return {
    deviceId: 'peer-device-001',
    displayName: 'Test Peer',
    host: '192.168.1.42',
    port: MDNS_SERVICE_PORT,
    discoveredAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// selectDialableTransportLayers (pure)
// ---------------------------------------------------------------------------

describe('selectDialableTransportLayers', () => {
  it('intersects the preferred list + default ladder with the available set', () => {
    // buildTransportLayerDialOrder([4,1]) = [4,1,5,2,3]; keep only DATA layers
    // that are available {1,4,5} -> [4,1,5].
    expect(selectDialableTransportLayers([4, 1], [1, 4, 5])).toEqual([4, 1, 5]);
  });

  it('never offers BLE (3) even when it is listed available', () => {
    const result = selectDialableTransportLayers([3, 1], [1, 3]);
    expect(result).not.toContain(3);
    expect(result).toEqual([1]);
  });

  it('drops an unavailable native rung and falls through to lower layers', () => {
    // WebRTC(4) preferred but not available -> falls through to 5 then 1.
    expect(selectDialableTransportLayers([4], [1, 5])).toEqual([5, 1]);
  });

  it('returns nothing when no layer is available', () => {
    expect(selectDialableTransportLayers([4, 1], [])).toEqual([]);
  });

  it('honors a strict ranked attempt (no fallback ladder)', () => {
    expect(selectDialableTransportLayers([5], [5], false)).toEqual([5]);
    // WebRTC preferred + unavailable, no fallback -> empty.
    expect(selectDialableTransportLayers([4], [1, 5], false)).toEqual([]);
  });

  it('only ever contains DATA transport layers', () => {
    const result = selectDialableTransportLayers([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
    for (const layerId of result) {
      expect(DATA_TRANSPORT_LAYER_IDS.has(layerId)).toBe(true);
    }
    expect(result).not.toContain(3);
  });

  it('shares the same DATA-layer definition as buildTransportLayerDialOrder', () => {
    // The full ladder contains BLE(3); the dialable selection must not.
    expect(buildTransportLayerDialOrder([])).toContain(3);
    expect(selectDialableTransportLayers([], [1, 2, 3, 4, 5])).not.toContain(3);
  });
});

// ---------------------------------------------------------------------------
// isRealBackend / availability marker
// ---------------------------------------------------------------------------

describe('isRealBackend', () => {
  it('is false for null / undefined / Simulated backends', () => {
    expect(isRealBackend(null)).toBe(false);
    expect(isRealBackend(undefined)).toBe(false);
    expect(isRealBackend(new SimulatedWebRTCBackend())).toBe(false);
    expect(isRealBackend(new SimulatedNearbyBackend())).toBe(false);
  });

  it('is true only for a backend marked isReal', () => {
    expect(isRealBackend({ isReal: true })).toBe(true);
    expect(isRealBackend(realWebRTCBackendDouble())).toBe(true);
  });

  it('exposes honest unavailable copy', () => {
    expect(TRANSPORT_UNAVAILABLE_MESSAGE).toBe('Not available on this build');
  });
});

// ---------------------------------------------------------------------------
// Transport-level availability
// ---------------------------------------------------------------------------

describe('transport availability gating', () => {
  it('WebRTCTransport is unavailable with no backend or a Simulated backend', () => {
    expect(new WebRTCTransport().isAvailable).toBe(false);
    expect(new WebRTCTransport({ backend: new SimulatedWebRTCBackend() }).isAvailable).toBe(false);
  });

  it('WebRTCTransport is available only with a real-marked backend', () => {
    expect(new WebRTCTransport({ backend: realWebRTCBackendDouble() }).isAvailable).toBe(true);
  });

  it('NearbyTransport is unavailable with no backend or a Simulated backend', () => {
    expect(new NearbyTransport().isAvailable).toBe(false);
    expect(new NearbyTransport({ backend: new SimulatedNearbyBackend() }).isAvailable).toBe(false);
  });

  it('NearbyTransport is available only with a real-marked backend', () => {
    expect(new NearbyTransport({ backend: realNearbyBackendDouble() }).isAvailable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TransportManager availability + never-dial-Simulated
// ---------------------------------------------------------------------------

describe('TransportManager native-rung availability', () => {
  it('reports only LAN + relay as available data layers with no native backends', () => {
    const manager = new TransportManager({ deviceId: 'me', displayName: 'Me', syncTier: 'p2p' });
    expect(manager.getAvailableDataLayers().sort()).toEqual([1, 5]);
  });

  it('adds Nearby(2) and WebRTC(4) once real backends are injected', () => {
    const manager = new TransportManager({
      deviceId: 'me',
      displayName: 'Me',
      syncTier: 'p2p',
      loadWebRTCBackend: () => realWebRTCBackendDouble(),
      loadNearbyBackend: () => realNearbyBackendDouble(),
    });
    expect(manager.getAvailableDataLayers().sort()).toEqual([1, 2, 4, 5]);
  });

  it('treats a null-returning factory (native absent) as unavailable', () => {
    const manager = new TransportManager({
      deviceId: 'me',
      displayName: 'Me',
      syncTier: 'p2p',
      loadWebRTCBackend: () => null,
      loadNearbyBackend: () => null,
    });
    expect(manager.getAvailableDataLayers()).not.toContain(2);
    expect(manager.getAvailableDataLayers()).not.toContain(4);
  });

  it('never dials the WebRTC rung when only the Simulated backend is present', async () => {
    const manager = new TransportManager({ deviceId: 'me', displayName: 'Me', syncTier: 'p2p' });
    await manager.initialize();

    // Strict WebRTC-only attempt: no real backend => rung unavailable => the
    // peer is unreachable (the Simulated backend is never dialed).
    await expect(
      manager.connectToPeer('ghost', { preferredLayerIds: [4], fallbackToDefaultLadder: false }),
    ).rejects.toThrow('not reachable on any available transport');

    await manager.destroy();
  });

  it('dials the WebRTC rung once a real backend is injected', async () => {
    const manager = new TransportManager({
      deviceId: 'me',
      displayName: 'Me',
      syncTier: 'p2p',
      loadWebRTCBackend: () => realWebRTCBackendDouble(),
    });
    await manager.initialize();

    const conn = await manager.connectToPeer('peer', {
      preferredLayerIds: [4],
      fallbackToDefaultLadder: false,
    });
    expect(conn.transport).toBe('wan_webrtc');

    await manager.destroy();
  });

  it('falls through an unavailable native rung to LAN', async () => {
    const manager = new TransportManager({ deviceId: 'me', displayName: 'Me', syncTier: 'p2p' });
    await manager.initialize();

    manager.lanDiscovery.simulateDiscovery(makePeer({ deviceId: 'lan-peer' }));

    const conn = await manager.connectToPeer('lan-peer', { preferredLayerIds: [4, 2, 1] });
    expect(conn.transport).toBe('lan');

    await manager.destroy();
  });
});
