/**
 * Plan 27 P2: dial-time defense-in-depth -- the forbiddenLayerIds HARD cap.
 *
 * The row gates (P1) are the guarantee; this layer stops a device from even
 * ATTEMPTING a forbidden transport when only local-only data is pending. The
 * cap is enforced INSIDE the dial paths (_tryConnectViaLayer and
 * connectToPeerViaRelay), never by trusting callers to combine
 * preferredLayerIds + fallbackToDefaultLadder -- a caller preference can
 * never override the cap upward (NC-3).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { TransportManager, forbiddenLayerIdsForPolicy } from '../transport/transport-manager';
import { MDNS_SERVICE_PORT } from '../transport/lan-discovery';
import type { DiscoveredPeer } from '../types';

let manager: TransportManager | null = null;

afterEach(async () => {
  await manager?.destroy();
  manager = null;
});

function makePeer(deviceId: string): DiscoveredPeer {
  return {
    deviceId,
    displayName: 'Peer',
    host: '192.168.1.42',
    port: MDNS_SERVICE_PORT,
    discoveredAt: Date.now(),
  };
}

async function createManager(): Promise<TransportManager> {
  // syncTier free_cloud so the SUBSCRIPTION tier allows every layer incl. the
  // relay: what these tests gate is the per-community transport POLICY cap, a
  // DIFFERENT axis (NC-4) -- the controls prove the tier is not what blocks.
  const m = new TransportManager({ deviceId: 'my-device', displayName: 'Me', syncTier: 'free_cloud' });
  await m.initialize();
  return m;
}

describe('forbiddenLayerIdsForPolicy (Plan 27 P2)', () => {
  it('local_only forbids the WAN data layers; the relaxed policies forbid none', () => {
    expect([...forbiddenLayerIdsForPolicy('local_only')].sort()).toEqual([4, 5]);
    expect(forbiddenLayerIdsForPolicy('local_preferred')).toEqual([]);
    expect(forbiddenLayerIdsForPolicy('any')).toEqual([]);
  });
});

describe('connectToPeer forbiddenLayerIds hard cap', () => {
  it('control: with a token, the relay rung connects (simulated backend)', async () => {
    manager = await createManager();
    const conn = await manager.connectToPeer('relay-peer', {
      relayToken: 'tok-1',
      preferredLayerIds: [5],
    });
    expect(conn.transport).toBe('wan_relay');
  });

  it('the cap blocks an otherwise-succeeding relay dial, even when the caller PREFERS relay', async () => {
    manager = await createManager();
    await expect(manager.connectToPeer('relay-peer', {
      relayToken: 'tok-1',
      preferredLayerIds: [5],
      fallbackToDefaultLadder: true,
      forbiddenLayerIds: [4, 5],
    })).rejects.toThrow('not reachable on any available transport');
  });

  it('local rungs still dial under the cap', async () => {
    manager = await createManager();
    manager.lanDiscovery.simulateDiscovery(makePeer('lan-peer'));
    const conn = await manager.connectToPeer('lan-peer', {
      relayToken: 'tok-1',
      forbiddenLayerIds: [4, 5],
    });
    expect(conn.transport).toBe('lan');
  });
});

describe('connectToPeerViaRelay forbiddenLayerIds hard cap', () => {
  it('control: the explicit relay path connects without a cap', async () => {
    manager = await createManager();
    const conn = await manager.connectToPeerViaRelay('relay-peer', 'tok-2');
    expect(conn.transport).toBe('wan_relay');
  });

  it('the relay bypass path honors the cap too (never rely on the ladder walk alone)', async () => {
    manager = await createManager();
    await expect(manager.connectToPeerViaRelay('relay-peer', 'tok-2', {
      forbiddenLayerIds: forbiddenLayerIdsForPolicy('local_only'),
    })).rejects.toThrow(/transport policy/i);
  });
});
