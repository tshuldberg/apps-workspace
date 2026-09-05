// Honesty tests for the owned native-transport bridge.
//
// The core Plan 42 guarantees this package must uphold:
//  - With no native side present (Expo Go / plain Node / vitest, where
//    expo-modules-core is not installed), both loaders return null cleanly. Null
//    keeps the rung unavailable; nothing is fabricated (AC-42.4).
//  - The loader looks up ONLY the owned module names; it never references a
//    speculative third-party package (NC-42.2), proven by a source lock.
//  - The bridge adapts the raw event surface into the exact callback-style
//    contract the app adapters probe.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  loadNativeNearbyModule,
  loadNativeBleWakeModule,
  bridgeNativeNearbyModule,
  bridgeNativeBleWakeModule,
  NEARBY_NATIVE_MODULE_NAME,
  BLE_WAKE_NATIVE_MODULE_NAME,
} from '../index';
import { loadExpoNativeModule } from '../loader';
import type {
  NativeSubscription,
  RawNativeBleWakeModule,
  RawNativeNearbyModule,
} from '../native-types';

/** A minimal event-emitter fake mirroring the raw native module surface. */
function makeEmitter() {
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  let removeCount = 0;
  return {
    add(eventName: string, listener: (event: unknown) => void): NativeSubscription {
      const arr = listeners.get(eventName) ?? [];
      arr.push(listener);
      listeners.set(eventName, arr);
      return {
        remove() {
          removeCount += 1;
          const cur = listeners.get(eventName) ?? [];
          listeners.set(eventName, cur.filter((l) => l !== listener));
        },
      };
    },
    emit(eventName: string, event: unknown): void {
      for (const l of [...(listeners.get(eventName) ?? [])]) l(event);
    },
    get removeCount() {
      return removeCount;
    },
    listenerCount(): number {
      return [...listeners.values()].reduce((n, arr) => n + arr.length, 0);
    },
  };
}

describe('bridge honesty (no native side)', () => {
  it('loadNativeNearbyModule returns null when expo-modules-core is absent (Expo Go / Node)', () => {
    // expo-modules-core is not installed in the node/vitest env, so the loader
    // must return null rather than throw or fabricate a module.
    expect(loadNativeNearbyModule()).toBeNull();
  });

  it('loadNativeBleWakeModule returns null when expo-modules-core is absent', () => {
    expect(loadNativeBleWakeModule()).toBeNull();
  });

  it('loadExpoNativeModule returns null (never throws) for any name without the native side', () => {
    expect(loadExpoNativeModule('MeerkatNearby')).toBeNull();
    expect(loadExpoNativeModule('MeerkatBleWake')).toBeNull();
    expect(loadExpoNativeModule('does-not-exist')).toBeNull();
  });
});

describe('bridge adapts the raw native surface to the app contract', () => {
  it('exposes the owned module-name constants', () => {
    expect(NEARBY_NATIVE_MODULE_NAME).toBe('MeerkatNearby');
    expect(BLE_WAKE_NATIVE_MODULE_NAME).toBe('MeerkatBleWake');
  });

  it('bridgeNativeNearbyModule returns null for a raw module missing connect()', () => {
    expect(bridgeNativeNearbyModule(null)).toBeNull();
    expect(bridgeNativeNearbyModule({} as unknown as RawNativeNearbyModule)).toBeNull();
  });

  it('adapts a raw nearby module: connect() yields a session whose bytes route to the right handler', async () => {
    const emitter = makeEmitter();
    const sent: { sessionId: string; bytes: Uint8Array }[] = [];
    const closed: string[] = [];
    const raw: RawNativeNearbyModule = {
      advertise: async () => {},
      browse: async () => {},
      stopAdvertising: async () => {},
      stopBrowsing: async () => {},
      connect: async () => 'sess-1',
      send: async (input) => { sent.push(input); },
      closeSession: async (input) => { closed.push(input.sessionId); },
      destroy: async () => {},
      addListener: ((eventName: string, listener: (event: unknown) => void) =>
        emitter.add(eventName, listener)) as RawNativeNearbyModule['addListener'],
    };
    const mod = bridgeNativeNearbyModule(raw);
    expect(mod).not.toBeNull();

    const session = await mod!.connect('peer-A');
    expect(session.peerId).toBe('peer-A');

    const received: Uint8Array[] = [];
    session.onData((bytes) => received.push(bytes));

    // A data event for THIS session routes to its handler.
    emitter.emit('data', { sessionId: 'sess-1', bytes: new Uint8Array([1, 2, 3]) });
    // A data event for a DIFFERENT session is ignored by this handler.
    emitter.emit('data', { sessionId: 'other', bytes: new Uint8Array([9]) });
    expect(received).toHaveLength(1);
    expect([...received[0]]).toEqual([1, 2, 3]);

    await session.send(new Uint8Array([7]));
    expect(sent).toEqual([{ sessionId: 'sess-1', bytes: new Uint8Array([7]) }]);

    await session.close();
    expect(closed).toEqual(['sess-1']);
    // After close, the per-session handler is dropped: further bytes are ignored.
    emitter.emit('data', { sessionId: 'sess-1', bytes: new Uint8Array([4]) });
    expect(received).toHaveLength(1);
  });

  it('nearby destroy() removes every listener (no leak on sign-out / hot reload)', () => {
    const emitter = makeEmitter();
    const raw: RawNativeNearbyModule = {
      advertise: async () => {}, browse: async () => {},
      stopAdvertising: async () => {}, stopBrowsing: async () => {},
      connect: async () => 's', send: async () => {}, closeSession: async () => {},
      destroy: async () => {},
      addListener: ((e: string, l: (event: unknown) => void) => emitter.add(e, l)) as RawNativeNearbyModule['addListener'],
    };
    const mod = bridgeNativeNearbyModule(raw)!;
    mod.onPeerFound(() => {});
    mod.onPeerLost(() => {});
    expect(emitter.listenerCount()).toBeGreaterThan(0);
    mod.destroy();
    expect(emitter.listenerCount()).toBe(0);
  });

  it('bridgeNativeBleWakeModule returns null for a raw module missing scan/advertise', () => {
    expect(bridgeNativeBleWakeModule(null)).toBeNull();
    expect(bridgeNativeBleWakeModule({} as unknown as RawNativeBleWakeModule)).toBeNull();
  });

  it('adapts a raw BLE module: createPeripheral advertises payload bytes, createCentral delivers wake payloads', async () => {
    const emitter = makeEmitter();
    const advertised: Uint8Array[] = [];
    let scanning = false;
    const raw: RawNativeBleWakeModule = {
      advertise: async ({ payload }) => { advertised.push(payload); },
      stopAdvertising: async () => {},
      scan: async () => { scanning = true; },
      stopScanning: async () => { scanning = false; },
      destroy: async () => {},
      addListener: ((e: string, l: (event: unknown) => void) => emitter.add(e, l)) as RawNativeBleWakeModule['addListener'],
    };
    const mod = bridgeNativeBleWakeModule(raw)!;

    const peripheral = mod.createPeripheral();
    await peripheral.startAdvertising(new Uint8Array([5, 6]));
    expect(advertised).toEqual([new Uint8Array([5, 6])]);

    const central = mod.createCentral();
    const woke: Uint8Array[] = [];
    await central.startScanning((bytes) => woke.push(bytes));
    expect(scanning).toBe(true);
    emitter.emit('wake', { payload: new Uint8Array([8, 8]) });
    expect(woke).toHaveLength(1);
    expect([...woke[0]]).toEqual([8, 8]);

    await central.stopScanning();
    expect(scanning).toBe(false);
    // After stop, the wake listener is removed: further wakes are ignored.
    emitter.emit('wake', { payload: new Uint8Array([1]) });
    expect(woke).toHaveLength(1);
  });
});

describe('loader source-lock (NC-42.2)', () => {
  const loaderSource = readFileSync(resolve(__dirname, '..', 'loader.ts'), 'utf8');
  const indexSource = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf8');

  it('the loader only reaches for expo-modules-core, never a speculative transport package', () => {
    // The single require in the loader is expo-modules-core.
    const requires = [...loaderSource.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    expect(requires).toEqual(['expo-modules-core']);
  });

  it('neither the loader nor the bridge references a speculative third-party module name', () => {
    const forbidden = [
      'react-native-nearby-connections',
      'react-native-multipeer-connectivity',
      '@mylife/nearby-ios',
      '@mylife/nearby-android',
      '@mylife/ble-wake',
      'react-native-ble-wake',
    ];
    for (const name of forbidden) {
      expect(loaderSource).not.toContain(name);
      expect(indexSource).not.toContain(name);
    }
  });

  it('the bridge looks modules up by the owned names only', () => {
    expect(indexSource).toContain("NEARBY_NATIVE_MODULE_NAME = 'MeerkatNearby'");
    expect(indexSource).toContain("BLE_WAKE_NATIVE_MODULE_NAME = 'MeerkatBleWake'");
  });
});
