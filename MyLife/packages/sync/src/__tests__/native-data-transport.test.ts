/**
 * NativeSyncEngine data-transport factories (Plan 29 / AM5): the native facade
 * accepts the app's real WebRTC / Nearby backend factories and dials sessions
 * over them on demand, honoring the ranked-choice selector and Plan 27 policy.
 *
 * These prove: availability derives only from real backends; the highest
 * ranked-and-available layer is dialed; a community's transport policy forbids
 * the WAN native layer (WebRTC) for a local_only community so a beacon/payload
 * never rides it; an all-forbidden or no-factory build dials nothing (honest
 * null, never a fabricated connection).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { createSyncTables } from '../db/schema';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
} from '../index';
import { generateDeviceIdentity } from '../identity/device-identity';
import type { DocumentManager } from '../crdt/document-manager';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { SyncEngine as NativeSyncEngine } from '../engine/sync-engine.native';
import type { DataTransportBackendFactories } from '../transport/data-transport-backend';
import { SimulatedWebRTCBackend, type WebRTCBackend } from '../transport/webrtc-transport';
import { SimulatedNearbyBackend, type NearbyPeerBackend } from '../transport/nearby-transport';

const PREFIXES = new Map<string, string>();

/** A real-marked WebRTC backend (moves bytes in-memory, isReal flips availability on). */
function realWebRTC(): WebRTCBackend {
  const sim = new SimulatedWebRTCBackend();
  return {
    isReal: true,
    connectToPeer: (id) => sim.connectToPeer(id),
    createPeerConnection: (cfg) => sim.createPeerConnection(cfg),
    onPeerFound: (h) => sim.onPeerFound(h),
    onIncomingSession: (h) => sim.onIncomingSession(h),
    destroy: () => sim.destroy(),
  };
}

/** A real backend whose native module cannot negotiate without app signaling. */
function realExternalWebRTC(): WebRTCBackend {
  return {
    ...realWebRTC(),
    signalingMode: 'external',
  };
}

/** A real-marked Nearby backend. */
function realNearby(): NearbyPeerBackend {
  const sim = new SimulatedNearbyBackend();
  return {
    isReal: true,
    advertise: (t, n) => sim.advertise(t, n),
    browse: (t) => sim.browse(t),
    stopAdvertising: () => sim.stopAdvertising(),
    stopBrowsing: () => sim.stopBrowsing(),
    connectToPeer: (id) => sim.connectToPeer(id),
    onPeerFound: (h) => sim.onPeerFound(h),
    onPeerLost: (h) => sim.onPeerLost(h),
    onIncomingSession: (h) => sim.onIncomingSession(h),
    destroy: () => sim.destroy(),
  };
}

let db: InMemoryTestDatabase | null = null;
afterEach(() => { db?.close(); db = null; });

async function makeEngine(factories?: DataTransportBackendFactories): Promise<NativeSyncEngine> {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  const engine = new NativeSyncEngine({
    db: db.adapter,
    identity: generateDeviceIdentity('Self'),
    modulePrefixes: PREFIXES,
    enabledModules: [],
    documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    dataTransportFactories: factories,
  });
  await engine.initialize();
  return engine;
}

describe('NativeSyncEngine native data-transport factories', () => {
  it('reports no native layers and dials nothing without factories', async () => {
    const engine = await makeEngine();
    expect(engine.getAvailableNativeDataLayers()).toEqual([]);
    expect(await engine.dialPeerViaNativeDataTransport('peer')).toBeNull();
    expect(await engine.syncViaNativeDataTransport('peer')).toBeNull();
    await engine.destroy();
  });

  it('reports only the rungs whose real backend is present', async () => {
    const engine = await makeEngine({ loadWebRTCBackend: () => realWebRTC(), loadNearbyBackend: () => null });
    expect(engine.getAvailableNativeDataLayers()).toEqual([4]);
    await engine.destroy();
  });

  it('a Simulated (non-real) backend leaves its rung unavailable', async () => {
    const engine = await makeEngine({ loadWebRTCBackend: () => new SimulatedWebRTCBackend() });
    expect(engine.getAvailableNativeDataLayers()).toEqual([]);
    expect(await engine.dialPeerViaNativeDataTransport('peer')).toBeNull();
    await engine.destroy();
  });

  it('an external-signaling backend is unavailable until signaling is configured', async () => {
    const engine = await makeEngine({ loadWebRTCBackend: () => realExternalWebRTC() });
    expect(engine.getAvailableNativeDataLayers()).toEqual([]);
    expect(await engine.dialPeerViaNativeDataTransport('peer')).toBeNull();
    await engine.destroy();
  });

  it('is local-first by default: dials Nearby before WebRTC when no preference is given', async () => {
    const engine = await makeEngine({ loadWebRTCBackend: () => realWebRTC(), loadNearbyBackend: () => realNearby() });
    expect(engine.getAvailableNativeDataLayers()).toEqual([2, 4]);
    const conn = await engine.dialPeerViaNativeDataTransport('peer');
    expect(conn?.transport).toBe('nearby');
    await conn?.close();
    await engine.destroy();
  });

  it('honors a caller preference for WebRTC over the local-first default', async () => {
    const engine = await makeEngine({ loadWebRTCBackend: () => realWebRTC(), loadNearbyBackend: () => realNearby() });
    const conn = await engine.dialPeerViaNativeDataTransport('peer', { preferredLayerIds: [4] });
    expect(conn?.transport).toBe('wan_webrtc');
    await conn?.close();
    await engine.destroy();
  });

  it('honors a caller preference for Nearby', async () => {
    const engine = await makeEngine({ loadWebRTCBackend: () => realWebRTC(), loadNearbyBackend: () => realNearby() });
    const conn = await engine.dialPeerViaNativeDataTransport('peer', { preferredLayerIds: [2] });
    expect(conn?.transport).toBe('nearby');
    await conn?.close();
    await engine.destroy();
  });

  it('local_only policy forbids WebRTC so it falls to Nearby', async () => {
    const engine = await makeEngine({ loadWebRTCBackend: () => realWebRTC(), loadNearbyBackend: () => realNearby() });
    const conn = await engine.dialPeerViaNativeDataTransport('peer', { communityTransportPolicy: 'local_only' });
    // WebRTC (4) is a WAN data layer forbidden by local_only; Nearby (2) survives.
    expect(conn?.transport).toBe('nearby');
    await conn?.close();
    await engine.destroy();
  });

  it('forbidding every native layer dials nothing', async () => {
    const engine = await makeEngine({ loadWebRTCBackend: () => realWebRTC(), loadNearbyBackend: () => realNearby() });
    expect(await engine.dialPeerViaNativeDataTransport('peer', { forbiddenLayerIds: [2, 4] })).toBeNull();
    await engine.destroy();
  });
});
