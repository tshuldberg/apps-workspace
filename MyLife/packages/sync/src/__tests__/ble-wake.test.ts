import { describe, it, expect, vi } from 'vitest';
import { BleTransport, SimulatedBleBackend } from '../transport/ble-transport';
import type { BleBackend, BleWakeUpPayload } from '../transport/ble-transport';
import { DATA_TRANSPORT_LAYER_IDS } from '../transport/transport-manager';

function realBleBackendDouble(): BleBackend & { injectWakeUp(p: BleWakeUpPayload): void } {
  const sim = new SimulatedBleBackend();
  return {
    isReal: true,
    startAdvertising: (p) => sim.startAdvertising(p),
    startScanning: () => sim.startScanning(),
    stopAdvertising: () => sim.stopAdvertising(),
    stopScanning: () => sim.stopScanning(),
    onWakeUp: (h) => sim.onWakeUp(h),
    destroy: () => sim.destroy(),
    injectWakeUp: (p) => sim.injectWakeUp(p),
  };
}

describe('BLE is wake-only', () => {
  it('the wake payload carries ONLY {deviceId, pendingModules, totalBytes}', () => {
    const backend = new SimulatedBleBackend();
    const received: BleWakeUpPayload[] = [];
    const transport = new BleTransport({ backend, onWakeUp: (p) => received.push(p) });
    transport.startScanning();

    backend.injectWakeUp({
      deviceId: 'device-a',
      pendingModules: ['notes', 'journal'],
      totalBytes: 4096,
    });

    expect(received).toHaveLength(1);
    // No file/media bytes ride along: the payload has exactly the three
    // wake-up fields and nothing that could carry data.
    expect(Object.keys(received[0]!).sort()).toEqual([
      'deviceId',
      'pendingModules',
      'totalBytes',
    ]);
    expect(received[0]).not.toHaveProperty('data');
    expect(received[0]).not.toHaveProperty('payload');
    expect(received[0]).not.toHaveProperty('bytes');
  });

  it('the transport exposes no data-moving surface (no connect/send/onData)', () => {
    const transport = new BleTransport({ backend: new SimulatedBleBackend() });
    expect(transport).not.toHaveProperty('connect');
    expect(transport).not.toHaveProperty('send');
    expect(transport).not.toHaveProperty('onData');
    expect(transport).not.toHaveProperty('getConnections');
  });

  it('is EXCLUDED from the data transport layers (layer 3 not a data layer)', () => {
    expect(DATA_TRANSPORT_LAYER_IDS.has(3)).toBe(false);
    // The other rungs (LAN/nearby/webrtc/relay) ARE data layers.
    expect(DATA_TRANSPORT_LAYER_IDS.has(1)).toBe(true);
    expect(DATA_TRANSPORT_LAYER_IDS.has(2)).toBe(true);
    expect(DATA_TRANSPORT_LAYER_IDS.has(4)).toBe(true);
    expect(DATA_TRANSPORT_LAYER_IDS.has(5)).toBe(true);
  });

  it('totalBytes is only a hint and does not deliver those bytes', () => {
    const backend = new SimulatedBleBackend();
    const onWakeUp = vi.fn();
    const transport = new BleTransport({ backend, onWakeUp });
    transport.startScanning();

    // A large totalBytes hint must not translate into any transferred data.
    backend.injectWakeUp({
      deviceId: 'device-big',
      pendingModules: ['surf'],
      totalBytes: 100 * 1024 * 1024,
    });

    const payload = onWakeUp.mock.calls[0]![0] as BleWakeUpPayload;
    expect(typeof payload.totalBytes).toBe('number');
    expect(Object.keys(payload)).toHaveLength(3);
  });
});

describe('BLE availability gating', () => {
  it('is unavailable with no backend or a Simulated backend', () => {
    expect(new BleTransport().isAvailable).toBe(false);
    expect(new BleTransport({ backend: new SimulatedBleBackend() }).isAvailable).toBe(false);
  });

  it('is available only with a real-marked backend', () => {
    expect(new BleTransport({ backend: realBleBackendDouble() }).isAvailable).toBe(true);
  });

  it('still delivers wake-ups honestly with a real backend', () => {
    const backend = realBleBackendDouble();
    const onWakeUp = vi.fn();
    const transport = new BleTransport({ backend, onWakeUp });
    transport.startScanning();

    expect(transport.isAvailable).toBe(true);
    expect(transport.isScanning).toBe(true);

    backend.injectWakeUp({ deviceId: 'device-z', pendingModules: ['notes'], totalBytes: 128 });
    expect(onWakeUp).toHaveBeenCalledOnce();
    expect(Object.keys(onWakeUp.mock.calls[0]![0] as object)).toHaveLength(3);
  });
});
