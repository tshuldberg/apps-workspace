import { describe, it, expect } from 'vitest';
import { TransportManager } from '../transport/transport-manager';
import { MDNS_SERVICE_PORT } from '../transport/lan-discovery';
import { SimulatedWebRTCBackend } from '../transport/webrtc-transport';
import type { WebRTCBackend } from '../transport/webrtc-transport';
import type { DiscoveredPeer, SyncTier } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePeer(overrides: Partial<DiscoveredPeer> = {}): DiscoveredPeer {
  return {
    deviceId: 'tier-peer-001',
    displayName: 'Tier Test Peer',
    host: '192.168.1.42',
    port: MDNS_SERVICE_PORT,
    discoveredAt: Date.now(),
    ...overrides,
  };
}

/**
 * A test double for a REAL native WebRTC backend (isReal:true) so the WebRTC
 * rung is available/dialable. These tests exercise TIER gating (which layers a
 * tier may attempt), which is orthogonal to native availability; a real backend
 * is present so tier -- not "Not available on this build" -- is what gates.
 */
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

function createManager(syncTier?: SyncTier): TransportManager {
  return new TransportManager({
    deviceId: 'my-device-001',
    displayName: 'My Device',
    syncTier,
    loadWebRTCBackend: () => realWebRTCBackendDouble(),
  });
}

// ---------------------------------------------------------------------------
// Tier enforcement
// ---------------------------------------------------------------------------

describe('tier enforcement', () => {
  // Note: These tests exercise the transport ladder's tier gating via the
  // public connectToPeer method on TransportManager. The private
  // _isTierAllowed method controls which layers are attempted. When the
  // tier blocks all internet transports, connectToPeer should still succeed
  // on local transports (LAN/nearby) and only fail with "not reachable"
  // when no local peer is available.

  it('local_only tier allows LAN, nearby, BLE only', async () => {
    const manager = createManager('local_only');
    await manager.initialize();

    // LAN should work when a peer is visible.
    const peer = makePeer({ deviceId: 'lan-peer' });
    manager.lanDiscovery.simulateDiscovery(peer);

    const conn = await manager.connectToPeer('lan-peer');
    expect(conn.transport).toBe('lan');
    expect(conn.remoteDeviceId).toBe('lan-peer');

    // A peer that is NOT visible on any local transport should fail.
    // local_only blocks layers 4 (WebRTC) and 5 (relay), so the ladder
    // exhausts after BLE and gives up.
    await expect(manager.connectToPeer('internet-only-peer')).rejects.toThrow(
      'not reachable on any available transport',
    );

    await manager.destroy();
  });

  it('p2p tier adds WebRTC', async () => {
    const manager = createManager('p2p');
    await manager.initialize();

    // LAN should still work (layers 1-3 allowed).
    const peer = makePeer({ deviceId: 'lan-peer-p2p' });
    manager.lanDiscovery.simulateDiscovery(peer);

    const lanConn = await manager.connectToPeer('lan-peer-p2p');
    expect(lanConn.transport).toBe('lan');

    // A peer not on LAN but reachable via WebRTC (layer 4) should connect
    // via webrtc. The simulated backend always returns a session.
    const webrtcConn = await manager.connectToPeer('webrtc-only-peer');
    expect(webrtcConn.transport).toBe('wan_webrtc');

    await manager.destroy();
  });

  it('free_cloud tier allows all layers including relay', async () => {
    const manager = createManager('free_cloud');
    await manager.initialize();

    // LAN layer still works.
    const peer = makePeer({ deviceId: 'fc-lan-peer' });
    manager.lanDiscovery.simulateDiscovery(peer);

    const lanConn = await manager.connectToPeer('fc-lan-peer');
    expect(lanConn.transport).toBe('lan');

    // When no local transport matches, WebRTC (layer 4) should be tried.
    // Since the simulated backend resolves connectToPeer immediately, it
    // should succeed on WebRTC before reaching relay.
    const wanConn = await manager.connectToPeer('wan-peer');
    expect(wanConn.transport).toBe('wan_webrtc');

    await manager.destroy();
  });

  it('relay blocked for p2p-tier users', async () => {
    const manager = createManager('p2p');
    await manager.initialize();

    // p2p tier allows layers 1-4 but blocks layer 5 (relay).
    // If WebRTC also fails (simulated backend always succeeds, so this
    // test verifies the tier does not escalate to relay for p2p users).
    // We verify indirectly: connect a peer via WebRTC to confirm that
    // the transport used is NOT relay.
    const conn = await manager.connectToPeer('remote-peer');
    expect(conn.transport).toBe('wan_webrtc');
    expect(conn.transport).not.toBe('wan_relay');

    await manager.destroy();
  });

  it('default tier (no tier set) blocks internet transports', async () => {
    // When no syncTier is specified, the manager should default to
    // local_only behavior and block layers 4 and 5.
    const manager = createManager(undefined);
    await manager.initialize();

    // No local peers visible and no internet layers means exhaustion.
    await expect(manager.connectToPeer('no-tier-peer')).rejects.toThrow(
      'not reachable on any available transport',
    );

    await manager.destroy();
  });

  it('starter_cloud tier allows all layers', async () => {
    const manager = createManager('starter_cloud');
    await manager.initialize();

    const conn = await manager.connectToPeer('cloud-peer');
    expect(['wan_webrtc', 'wan_relay']).toContain(conn.transport);

    await manager.destroy();
  });

  it('power_cloud tier allows all layers', async () => {
    const manager = createManager('power_cloud');
    await manager.initialize();

    const conn = await manager.connectToPeer('power-peer');
    expect(['wan_webrtc', 'wan_relay']).toContain(conn.transport);

    await manager.destroy();
  });
});
