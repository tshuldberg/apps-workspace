// Native transport availability + honesty (Plan 20, Phase 11, mobile half).
//
// Runs in the node/vitest env where the react-native-webrtc / Nearby / BLE
// native modules are ABSENT (exactly like Expo Go). Proves:
//   - each *-backend loader returns null when its native module is absent, so
//     the rung reports "Not available on this build" and is never dialed (NC-11);
//   - the Settings rung logic reflects that unavailability;
//   - WebRTC connected state is forwarded ONLY from a real connection-state event
//     (never a timer / optimistic flip);
//   - BLE stays wake-only: the wake payload carries only the three fields and is
//     excluded from the data-transport layers (NC-12).

import { describe, it, expect } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  isRealBackend,
  TRANSPORT_UNAVAILABLE_MESSAGE,
  DATA_TRANSPORT_LAYER_IDS,
  selectDialableTransportLayers,
  NativeSyncEngine,
  generateDeviceIdentity,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
} from '@mylife/sync';
import {
  MEERKAT_SYNC_PREFIXES,
  MEERKAT_SYNC_MODULE_ID,
  MEERKAT_SYNC_POLICIES,
} from '../(root)/data/sync-core';
import { loadWebRTCBackend } from '../(root)/data/webrtc-backend';
import { loadNearbyBackend } from '../(root)/data/nearby-backend';
import {
  loadBleBackend,
  encodeBleWakePayload,
  decodeBleWakePayload,
} from '../(root)/data/ble-backend';
import {
  dataTransportFactories,
  getDataTransportAvailability,
  buildNativeTransportRungs,
  nativeLayerAllowedAcrossCommunities,
} from '../(root)/data/transport-backends';

const NEARBY = 2;
const WEBRTC = 4;
const LAN = 1;

describe('native transport loaders (no native module present)', () => {
  it('every loader returns null when its native module is absent', () => {
    expect(loadWebRTCBackend()).toBeNull();
    expect(loadNearbyBackend()).toBeNull();
    expect(loadBleBackend()).toBeNull();
  });

  it('isRealBackend gates a missing/absent backend as not live', () => {
    expect(isRealBackend(loadWebRTCBackend())).toBe(false);
    expect(isRealBackend(loadNearbyBackend())).toBe(false);
    expect(isRealBackend(loadBleBackend())).toBe(false);
    expect(isRealBackend(null)).toBe(false);
    expect(isRealBackend(undefined)).toBe(false);
  });

  it('exposes the three real factories for TransportManager injection', () => {
    expect(typeof dataTransportFactories.loadWebRTCBackend).toBe('function');
    expect(typeof dataTransportFactories.loadNearbyBackend).toBe('function');
    expect(typeof dataTransportFactories.loadBleBackend).toBe('function');
    // The injected factories resolve to null here (no native modules).
    expect(dataTransportFactories.loadWebRTCBackend?.()).toBeNull();
    expect(dataTransportFactories.loadNearbyBackend?.()).toBeNull();
    expect(dataTransportFactories.loadBleBackend?.()).toBeNull();
  });

  it('an engine built with the app factories reports ZERO native layers here (AM5 honest gate)', () => {
    // This is exactly what the foreground round reads for `nativeDataAvailable`:
    // with no native modules present, getAvailableNativeDataLayers() is empty, so
    // runAutoConnectJob never plans a native dial and connectNativeDataTransport is
    // never called. Nothing can fabricate a native rung.
    configureSyncSecretStore(createInMemorySyncSecretStore());
    const testDb = createInMemoryTestDatabase();
    try {
      const engine = new NativeSyncEngine({
        db: testDb.adapter,
        identity: generateDeviceIdentity('Phone'),
        modulePrefixes: MEERKAT_SYNC_PREFIXES,
        enabledModules: [MEERKAT_SYNC_MODULE_ID],
        modulePolicies: MEERKAT_SYNC_POLICIES,
        dataTransportFactories,
      });
      expect(engine.getAvailableNativeDataLayers()).toEqual([]);
      expect(engine.getAvailableNativeDataLayers().length > 0).toBe(false);
    } finally {
      testDb.close();
    }
  });
});

describe('Settings availability surface', () => {
  it('reports every native rung unavailable on a no-native-module build', () => {
    expect(getDataTransportAvailability()).toEqual({
      webrtc: false,
      nearby: false,
      ble: false,
    });
  });

  it('renders each rung as "Not available on this build" and never dials it', () => {
    const rungs = buildNativeTransportRungs(getDataTransportAvailability());
    expect(rungs.map((r) => r.id)).toEqual(['webrtc', 'nearby', 'ble']);
    for (const rung of rungs) {
      expect(rung.available).toBe(false);
      expect(rung.detail).toBe(TRANSPORT_UNAVAILABLE_MESSAGE);
    }
  });

  it('the selector drops unavailable native rungs (nearby=2, webrtc=4) and BLE(3)', () => {
    // With no native backend present, only LAN(1) + relay(5) remain dialable.
    const availableLayerIds = [1, 5];
    const dialable = selectDialableTransportLayers([2, 4, 3, 1, 5], availableLayerIds);
    expect(dialable).toEqual([1, 5]);
    expect(dialable).not.toContain(2);
    expect(dialable).not.toContain(4);
    expect(dialable).not.toContain(3);
  });

  it('an available native rung surfaces only when its backend really loads', () => {
    const rungs = buildNativeTransportRungs({ webrtc: true, nearby: false, ble: false });
    const webrtc = rungs.find((r) => r.id === 'webrtc');
    expect(webrtc?.available).toBe(true);
    expect(webrtc?.detail).not.toBe(TRANSPORT_UNAVAILABLE_MESSAGE);
    // A rung the backend did not load stays honest.
    expect(rungs.find((r) => r.id === 'nearby')?.detail).toBe(TRANSPORT_UNAVAILABLE_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// AM5/15b Plan 27 (NC-3): the auto-connect round's per-layer policy predicate
// resolves CONSERVATIVELY across all joined communities — deny a native layer if
// ANY community forbids it, so a single local_only community can never be
// under-restricted into a WebRTC dial. This is exactly what SyncProvider feeds
// runAutoConnectJob as transportPolicyAllows.
// ---------------------------------------------------------------------------

describe('nativeLayerAllowedAcrossCommunities (conservative Plan 27, NC-3)', () => {
  it('allows both native layers when EVERY community permits them', () => {
    expect(nativeLayerAllowedAcrossCommunities(['any', 'local_preferred'], WEBRTC)).toBe(true);
    expect(nativeLayerAllowedAcrossCommunities(['any', 'local_preferred'], NEARBY)).toBe(true);
  });

  it('DENIES WebRTC if ANY community is local_only (never under-restricts)', () => {
    // local_only forbids the WAN WebRTC transport; a single such community denies it.
    expect(nativeLayerAllowedAcrossCommunities(['any', 'local_only'], WEBRTC)).toBe(false);
    // Nearby is a LOCAL transport, which local_only still permits.
    expect(nativeLayerAllowedAcrossCommunities(['any', 'local_only'], NEARBY)).toBe(true);
  });

  it('allows everything when there are no communities (nothing forbids)', () => {
    expect(nativeLayerAllowedAcrossCommunities([], WEBRTC)).toBe(true);
    expect(nativeLayerAllowedAcrossCommunities([], NEARBY)).toBe(true);
  });

  it('does not gate a non-native layer (LAN passes through)', () => {
    expect(nativeLayerAllowedAcrossCommunities(['local_only'], LAN)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WebRTC connected state is never fabricated (fake native module injection)
// ---------------------------------------------------------------------------

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  connectionState = 'new';
  iceConnectionState = 'new';
  lastRemote: { type: string; sdp: string } | null = null;
  private readonly handlers: Record<string, Array<() => void>> = {};

  constructor(_config?: unknown) {
    FakePeerConnection.instances.push(this);
  }

  addEventListener(type: string, handler: () => void): void {
    (this.handlers[type] ??= []).push(handler);
  }

  createDataChannel(): {
    readyState: string;
    binaryType: string;
    send(): void;
    close(): void;
    addEventListener(): void;
  } {
    return { readyState: 'connecting', binaryType: '', send() {}, close() {}, addEventListener() {} };
  }

  async createOffer(): Promise<{ type: string; sdp: string }> {
    return { type: 'offer', sdp: 'OFFER' };
  }

  async createAnswer(): Promise<{ type: string; sdp: string }> {
    return { type: 'answer', sdp: 'ANSWER' };
  }

  async setLocalDescription(): Promise<void> {}

  async setRemoteDescription(desc: { type: string; sdp: string }): Promise<void> {
    this.lastRemote = desc;
  }

  async addIceCandidate(): Promise<void> {}

  close(): void {}

  fire(type: string): void {
    for (const handler of this.handlers[type] ?? []) handler();
  }
}

function fakeWebRTCModule() {
  return {
    RTCPeerConnection: FakePeerConnection,
    RTCIceCandidate: class {
      constructor(init: unknown) {
        Object.assign(this, init);
      }
    },
    RTCSessionDescription: class {
      type: string;
      sdp: string;
      constructor(init: { type: string; sdp: string }) {
        this.type = init.type;
        this.sdp = init.sdp;
      }
    },
  };
}

describe('WebRTC connected state honesty (injected native module)', () => {
  it('a present backend is real, and connected state comes ONLY from a real event', () => {
    FakePeerConnection.instances = [];
    const backend = loadWebRTCBackend({
      module: fakeWebRTCModule(),
    } as unknown as Parameters<typeof loadWebRTCBackend>[0]);
    expect(backend).not.toBeNull();
    expect(isRealBackend(backend)).toBe(true);

    const session = backend!.createPeerConnection();
    const states: string[] = [];
    session.onConnectionStateChange((state: string) => states.push(state));

    // No timer, no optimistic flip: nothing is reported before a real event.
    expect(states).toEqual([]);

    const pc = FakePeerConnection.instances[0];
    pc.connectionState = 'connecting';
    pc.fire('connectionstatechange');
    // A real 'connecting' event does NOT masquerade as connected.
    expect(states).toEqual(['connecting']);

    pc.connectionState = 'connected';
    pc.fire('connectionstatechange');
    expect(states).toEqual(['connecting', 'connected']);
  });

  it('reconstructs the SDP type from the offer/answer role (initiator)', async () => {
    FakePeerConnection.instances = [];
    const backend = loadWebRTCBackend({
      module: fakeWebRTCModule(),
    } as unknown as Parameters<typeof loadWebRTCBackend>[0]);
    const session = backend!.createPeerConnection();
    const pc = FakePeerConnection.instances[0];

    const offerSdp = await session.createOffer();
    expect(offerSdp).toBe('OFFER');
    // Initiator that made an offer resolves an incoming remote SDP as the answer.
    await session.setRemoteDescription('ANSWER-SDP');
    expect(pc.lastRemote).toEqual({ type: 'answer', sdp: 'ANSWER-SDP' });
  });

  it('reconstructs the SDP type from the offer/answer role (responder)', async () => {
    FakePeerConnection.instances = [];
    const backend = loadWebRTCBackend({
      module: fakeWebRTCModule(),
    } as unknown as Parameters<typeof loadWebRTCBackend>[0]);
    const session = backend!.createPeerConnection();
    const pc = FakePeerConnection.instances[0];

    // Responder sets the remote description BEFORE creating an answer -> it is an offer.
    await session.setRemoteDescription('OFFER-SDP');
    expect(pc.lastRemote).toEqual({ type: 'offer', sdp: 'OFFER-SDP' });
    const answerSdp = await session.createAnswer('OFFER-SDP');
    expect(answerSdp).toBe('ANSWER');
  });
});

// ---------------------------------------------------------------------------
// BLE stays wake-only
// ---------------------------------------------------------------------------

describe('BLE wake payload (wake-only, NC-12)', () => {
  it('is excluded from the data-transport layers', () => {
    expect(DATA_TRANSPORT_LAYER_IDS.has(3)).toBe(false);
    expect([...DATA_TRANSPORT_LAYER_IDS].sort()).toEqual([1, 2, 4, 5]);
  });

  it('round-trips the three wake fields', () => {
    const payload = {
      deviceId: 'ab'.repeat(32),
      pendingModules: ['community', 'meerkat-sync'],
      totalBytes: 4096,
    };
    expect(decodeBleWakePayload(encodeBleWakePayload(payload))).toEqual(payload);
  });

  it('drops any smuggled fields so the wake carries no data bytes', () => {
    const smuggled = new TextEncoder().encode(
      JSON.stringify({
        deviceId: 'aa',
        pendingModules: [],
        totalBytes: 0,
        fileBytes: 'ZGVhZGJlZWY=',
        payload: 'nope',
      }),
    );
    const decoded = decodeBleWakePayload(smuggled);
    expect(decoded).toEqual({ deviceId: 'aa', pendingModules: [], totalBytes: 0 });
    expect(Object.keys(decoded ?? {})).toEqual(['deviceId', 'pendingModules', 'totalBytes']);
  });

  it('fails closed on malformed notifies', () => {
    expect(decodeBleWakePayload(new TextEncoder().encode('not json'))).toBeNull();
    expect(
      decodeBleWakePayload(
        new TextEncoder().encode(JSON.stringify({ deviceId: 1, pendingModules: [], totalBytes: 0 })),
      ),
    ).toBeNull();
    expect(
      decodeBleWakePayload(
        new TextEncoder().encode(JSON.stringify({ deviceId: 'x', pendingModules: 'no', totalBytes: 0 })),
      ),
    ).toBeNull();
    expect(
      decodeBleWakePayload(
        new TextEncoder().encode(JSON.stringify({ deviceId: 'x', pendingModules: [], totalBytes: -1 })),
      ),
    ).toBeNull();
  });
});
