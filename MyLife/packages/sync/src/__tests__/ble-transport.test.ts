import { describe, it, expect, vi } from 'vitest';
import { BleTransport, SimulatedBleBackend } from '../transport/ble-transport';
import type { BleWakeUpPayload } from '../transport/ble-transport';

// ---------------------------------------------------------------------------
// BleTransport
// ---------------------------------------------------------------------------

describe('BleTransport', () => {
  // -------------------------------------------------------------------------
  // Wake-up signals
  // -------------------------------------------------------------------------

  describe('wake-up signals', () => {
    it('receives wake-up payload from nearby device', () => {
      const backend = new SimulatedBleBackend();
      const onWakeUp = vi.fn();
      const transport = new BleTransport({ backend, onWakeUp });

      transport.startScanning();

      const payload: BleWakeUpPayload = {
        deviceId: 'device-a',
        pendingModules: ['notes', 'journal'],
        totalBytes: 4096,
      };
      backend.injectWakeUp(payload);

      expect(onWakeUp).toHaveBeenCalledOnce();
      expect(onWakeUp).toHaveBeenCalledWith(payload);
    });

    it('fires multiple wake-ups while scanning', () => {
      const backend = new SimulatedBleBackend();
      const onWakeUp = vi.fn();
      const transport = new BleTransport({ backend, onWakeUp });

      transport.startScanning();

      backend.injectWakeUp({
        deviceId: 'device-a',
        pendingModules: ['notes'],
        totalBytes: 512,
      });

      backend.injectWakeUp({
        deviceId: 'device-b',
        pendingModules: ['budget'],
        totalBytes: 1024,
      });

      expect(onWakeUp).toHaveBeenCalledTimes(2);
      expect(onWakeUp.mock.calls[0]![0].deviceId).toBe('device-a');
      expect(onWakeUp.mock.calls[1]![0].deviceId).toBe('device-b');
    });

    it('does not fire after destroy', () => {
      const backend = new SimulatedBleBackend();
      const onWakeUp = vi.fn();
      const transport = new BleTransport({ backend, onWakeUp });

      transport.startScanning();
      transport.destroy();

      backend.injectWakeUp({
        deviceId: 'device-a',
        pendingModules: ['notes'],
        totalBytes: 1024,
      });

      expect(onWakeUp).not.toHaveBeenCalled();
    });

    it('does not require onWakeUp callback', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      transport.startScanning();

      // Should not throw when no callback is registered.
      expect(() =>
        backend.injectWakeUp({
          deviceId: 'device-a',
          pendingModules: ['notes'],
          totalBytes: 256,
        }),
      ).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Advertising
  // -------------------------------------------------------------------------

  describe('advertising', () => {
    it('starts and stops advertising', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      expect(transport.isAdvertising).toBe(false);

      transport.startAdvertising({
        deviceId: 'self-device',
        pendingModules: ['budget', 'recipes'],
        totalBytes: 8192,
      });
      expect(transport.isAdvertising).toBe(true);

      transport.stopAdvertising();
      expect(transport.isAdvertising).toBe(false);
    });

    it('startAdvertising is idempotent', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      transport.startAdvertising({
        deviceId: 'self',
        pendingModules: ['notes'],
        totalBytes: 100,
      });
      transport.startAdvertising({
        deviceId: 'self',
        pendingModules: ['notes', 'journal'],
        totalBytes: 200,
      });

      expect(transport.isAdvertising).toBe(true);
    });

    it('stopAdvertising is no-op when not advertising', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      transport.stopAdvertising();
      expect(transport.isAdvertising).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Scanning
  // -------------------------------------------------------------------------

  describe('scanning', () => {
    it('starts and stops scanning', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      expect(transport.isScanning).toBe(false);

      transport.startScanning();
      expect(transport.isScanning).toBe(true);

      transport.stopScanning();
      expect(transport.isScanning).toBe(false);
    });

    it('startScanning is idempotent', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      transport.startScanning();
      transport.startScanning();
      expect(transport.isScanning).toBe(true);
    });

    it('stopScanning is no-op when not scanning', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      transport.stopScanning();
      expect(transport.isScanning).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // BLE is NOT a data transport
  // -------------------------------------------------------------------------

  describe('BLE is NOT a data transport', () => {
    it('has no connect or send methods', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      // BLE transport is wake-up only. It must not expose data transfer methods.
      expect(transport).not.toHaveProperty('connect');
      expect(transport).not.toHaveProperty('send');
    });

    it('has no onData or getConnections methods', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      expect(transport).not.toHaveProperty('onData');
      expect(transport).not.toHaveProperty('getConnections');
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  describe('lifecycle', () => {
    it('stops scanning and advertising on destroy', () => {
      const backend = new SimulatedBleBackend();
      const onWakeUp = vi.fn();
      const transport = new BleTransport({ backend, onWakeUp });

      transport.startScanning();
      transport.startAdvertising({
        deviceId: 'self',
        pendingModules: ['notes'],
        totalBytes: 256,
      });

      transport.destroy();

      expect(transport.isScanning).toBe(false);
      expect(transport.isAdvertising).toBe(false);

      // After destroy, wake-ups should not fire.
      backend.injectWakeUp({
        deviceId: 'device-x',
        pendingModules: ['notes'],
        totalBytes: 512,
      });
      expect(onWakeUp).not.toHaveBeenCalled();
    });

    it('destroy is idempotent', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      transport.destroy();
      expect(() => transport.destroy()).not.toThrow();
    });

    it('scanning state resets after destroy', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      transport.startScanning();
      transport.destroy();

      expect(transport.isScanning).toBe(false);
    });

    it('throws after destroy on startScanning', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      transport.destroy();

      expect(() => transport.startScanning()).toThrow(
        'BleTransport has been destroyed',
      );
    });

    it('throws after destroy on startAdvertising', () => {
      const backend = new SimulatedBleBackend();
      const transport = new BleTransport({ backend });

      transport.destroy();

      expect(() =>
        transport.startAdvertising({
          deviceId: 'self',
          pendingModules: [],
          totalBytes: 0,
        }),
      ).toThrow('BleTransport has been destroyed');
    });
  });

  // -------------------------------------------------------------------------
  // Wake-up signal edge cases
  // -------------------------------------------------------------------------

  describe('BLE wake-up signal edge cases', () => {
    it('handles payload with empty pending modules', () => {
      const backend = new SimulatedBleBackend();
      const onWakeUp = vi.fn();
      const transport = new BleTransport({ backend, onWakeUp });
      transport.startScanning();

      backend.injectWakeUp({
        deviceId: 'device-empty',
        pendingModules: [],
        totalBytes: 0,
      });

      expect(onWakeUp).toHaveBeenCalledWith({
        deviceId: 'device-empty',
        pendingModules: [],
        totalBytes: 0,
      });
    });

    it('handles payload with many modules', () => {
      const backend = new SimulatedBleBackend();
      const onWakeUp = vi.fn();
      const transport = new BleTransport({ backend, onWakeUp });
      transport.startScanning();

      const manyModules = ['notes', 'journal', 'recipes', 'budget', 'books', 'mood', 'health'];
      backend.injectWakeUp({
        deviceId: 'device-busy',
        pendingModules: manyModules,
        totalBytes: 1048576,
      });

      expect(onWakeUp.mock.calls[0]![0].pendingModules).toHaveLength(7);
    });

    it('handles large totalBytes value', () => {
      const backend = new SimulatedBleBackend();
      const onWakeUp = vi.fn();
      const transport = new BleTransport({ backend, onWakeUp });
      transport.startScanning();

      const largePayload: BleWakeUpPayload = {
        deviceId: 'device-big',
        pendingModules: ['surf'],
        totalBytes: 100 * 1024 * 1024, // 100 MB
      };
      backend.injectWakeUp(largePayload);

      expect(onWakeUp).toHaveBeenCalledWith(largePayload);
    });
  });
});

// ---------------------------------------------------------------------------
// SimulatedBleBackend (standalone)
// ---------------------------------------------------------------------------

describe('SimulatedBleBackend', () => {
  it('injectWakeUp fires the registered handler', () => {
    const backend = new SimulatedBleBackend();
    const handler = vi.fn();
    backend.onWakeUp(handler);

    backend.injectWakeUp({
      deviceId: 'device-a',
      pendingModules: ['notes'],
      totalBytes: 100,
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('ignores injectWakeUp after destroy', () => {
    const backend = new SimulatedBleBackend();
    const handler = vi.fn();
    backend.onWakeUp(handler);

    backend.destroy();
    backend.injectWakeUp({
      deviceId: 'device-a',
      pendingModules: ['notes'],
      totalBytes: 100,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('no-op methods do not throw', () => {
    const backend = new SimulatedBleBackend();

    expect(() => backend.startAdvertising({
      deviceId: 'self',
      pendingModules: [],
      totalBytes: 0,
    })).not.toThrow();
    expect(() => backend.startScanning()).not.toThrow();
    expect(() => backend.stopAdvertising()).not.toThrow();
    expect(() => backend.stopScanning()).not.toThrow();
    expect(() => backend.destroy()).not.toThrow();
  });
});
