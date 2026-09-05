# @mylife/meerkat-native-transport

Owned Expo native module for Meerkat's peer transport rungs:

- **Nearby (data):** MultipeerConnectivity on iOS, Wi-Fi Direct + DNS-SD on Android.
- **BLE (wake-only):** CoreBluetooth / android.bluetooth. Carries only the bounded wake payload, never file data (NC-42.6).

It replaces the four speculative third-party module names the app adapters used to probe (`react-native-nearby-connections`, `react-native-multipeer-connectivity`, `@mylife/nearby-ios`, `@mylife/nearby-android`, `@mylife/ble-wake`, `react-native-ble-wake`) with one owned package (NC-42.2).

## Honesty contract

When the native side is absent -- Expo Go, plain Node/vitest, or a dev build that has not compiled the Swift/Kotlin yet -- every loader returns `null`. The app adapter returns `null`, the `@mylife/sync` engine's `isRealBackend()` gate reports the rung unavailable, and the UI shows "Not available on this build". Nothing in this package fabricates a session, peer, byte, or `isReal: true`.

The Swift (`ios/`) and Kotlin (`android/`) sources are **UNVERIFIED scaffolding**: the Expo module definitions and file layout are authored, but every method body throws a stable "not implemented" error. WP-42C (Plan 42 Phases 1-2) authors the real bodies; only a signed dev build on the physical-device matrix proves AC-42.1 / AC-42.2 / AC-42.3.

## Surface

| File | Role |
|------|------|
| `src/index.ts` | TS bridge exposing the callback-style `NativeNearbyModule` + `NativeBleModule` the app adapters probe. |
| `src/native-types.ts` | The raw event-based native module surface (Plan 42 Native Module Contract) the Swift/Kotlin fulfill. |
| `src/loader.ts` | The single documented native-module loader: lazy-requires `expo-modules-core`, returns null on any absence. |
| `app.plugin.js` | Expo config plugin: local-network + Bonjour + Bluetooth plist keys and Android permissions (idempotent, additive). |
| `expo-module.config.json` | Autolinking manifest naming the native modules. |
| `ios/` | Podspec + Swift module scaffolding (UNVERIFIED). |
| `android/` | build.gradle + Kotlin module scaffolding (UNVERIFIED). |

## Native module names

`MeerkatNearby` and `MeerkatBleWake` (see `NEARBY_NATIVE_MODULE_NAME` / `BLE_WAKE_NATIVE_MODULE_NAME`). These must match the `Name(...)` in the native modules and the entries in `expo-module.config.json`.

## Native authorship status (WP-42C)

The Swift (`ios/`) and Kotlin (`android/`) bodies are now **authored** against the raw contract in `src/native-types.ts`, replacing the previous "not implemented" scaffolds. They remain **UNVERIFIED**: this repo has no iOS or Android toolchain, so the sources have not been compiled or device-proven. Compilation is founder-ops (an Expo dev build); the physical-device matrix is the only evidence for the hardware-gated criteria below. Authorship is not evidence, and nothing in these sources sets `isReal` or the runtime availability flags. The runtime bridge (`src/`) still returns `null` until a compiled native module loads, keeping every rung honestly unavailable in this build.

### Contract-to-symbol coverage

`RawNativeNearbyModule` (`src/native-types.ts`) -> Swift `MeerkatNearbyModule` / Kotlin `MeerkatNearbyModule`:

| Contract method / event | iOS Swift symbol | Android Kotlin symbol |
|---|---|---|
| `advertise({serviceType, displayName})` | `AsyncFunction("advertise")` -> `startAdvertising(serviceTypeRaw:displayName:)` (MC `MCNearbyServiceAdvertiser`) | `AsyncFunction("advertise")` -> `startAdvertising()` (Wi-Fi Direct `addLocalService` + `ServerSocket`) |
| `browse({serviceType})` | `startBrowsing(serviceTypeRaw:)` (`MCNearbyServiceBrowser`) | `startBrowsing()` (`setDnsSdResponseListeners` + `discoverServices`) |
| `stopAdvertising()` | `AsyncFunction("stopAdvertising")` | `stopAdvertising()` (`clearLocalServices` + close accept socket) |
| `stopBrowsing()` | `AsyncFunction("stopBrowsing")` | `stopBrowsing()` (`removeServiceRequest`) |
| `connect({peerId}) -> sessionId` | `connect(peerHandle:promise:)` (`invitePeer`) | `connect(peerHandle:promise:)` (`WifiP2pManager.connect` + TXT-port dial) |
| `send({sessionId, bytes})` | `send(sessionId:data:)` (`MCSession.send .reliable`) | `NearbySession.send()` (length-prefixed TCP frame) |
| `closeSession({sessionId})` | `closeSession(sessionId:reason:)` | `NearbySession.close()` |
| `destroy()` | `teardown()` (`OnDestroy`) | `teardown()` (`OnDestroy`) |
| event `peerFound` | `onFoundPeer` -> `sendEvent("peerFound")` | `onPeerFound` -> `sendEvent("peerFound")` |
| event `peerLost` | `onLostPeer` -> `sendEvent("peerLost")` | (Wi-Fi Direct peer-change; session close on disconnect) |
| event `sessionOpened` | `onPeerConnected` (inbound) -> `sendEvent("sessionOpened")` | `openSessionFromSocket(inbound=true)` -> `sendEvent("sessionOpened")` |
| event `data` | `onReceiveData` -> `sendEvent("data")` | `NearbySession` read loop -> `sendEvent("data")` |
| event `sessionClosed` | `closeSession` -> `sendEvent("sessionClosed")` | `NearbySession.onClosed` -> `sendEvent("sessionClosed")` |

`RawNativeBleWakeModule` (`src/native-types.ts`) -> Swift `MeerkatBleWakeModule` / Kotlin `MeerkatBleWakeModule`:

| Contract method / event | iOS Swift symbol | Android Kotlin symbol |
|---|---|---|
| `advertise({payload})` | `startAdvertising(payload:)` (`CBPeripheralManager`, one read/notify characteristic) | `startAdvertising()` (`BluetoothLeAdvertiser` + GATT server, one read/notify characteristic) |
| `stopAdvertising()` | `BlePeripheralShim.stop()` | `stopAdvertising()` |
| `scan()` | `startScanning()` (`CBCentralManager`) | `startScanning()` (`BluetoothLeScanner`) |
| `stopScanning()` | `BleCentralShim.stop()` | `stopScanning()` |
| `destroy()` | `teardown()` (`OnDestroy`) | `teardown()` (`OnDestroy`) |
| event `wake` | `didUpdateValueFor` -> size gate -> `sendEvent("wake")` | `onCharacteristicRead` -> size gate -> `sendEvent("wake")` |

BLE is wake-only on both platforms (NC-42.6): the GATT server publishes exactly one read/notify characteristic, writes are explicitly refused (`writeNotPermitted` / `GATT_REQUEST_NOT_SUPPORTED`), and a value over `maxWakePayloadBytes` (512) is dropped before any `wake` event.

### Hardware-gated acceptance criteria (authorship is NOT evidence)

These remain **open** until a signed dev build compiles the sources and the physical-device matrix runs. No source in this package may claim them:

- **AC-42.1** two signed iOS builds transfer real encrypted bytes over MultipeerConnectivity.
- **AC-42.2** two signed Android builds transfer real encrypted bytes over Wi-Fi Direct.
- **AC-42.3** BLE wakes a peer and carries no document, media, or file bytes.

`AC-42.4` (missing module reports unavailable, selector falls back) is the only Nearby/BLE criterion provable without hardware, and it is covered by the WP-42B bridge tests (`src/__tests__/bridge.test.ts`), not by this authorship.

## Config plugin permissions (operator note)

`app.plugin.js` writes, idempotently and additively:

- **iOS Info.plist:** `NSLocalNetworkUsageDescription`, `NSBonjourServices` (`_mylife-sync._tcp`, `_meerkat-nearby._tcp`), `NSBluetoothAlwaysUsageDescription` (only if the app has not already set it; `apps/meerkat/app.config.ts` owns the Bluetooth string).
- **Android permissions:** `BLUETOOTH_ADVERTISE`, `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `NEARBY_WIFI_DEVICES` (also in `app.config.ts`; deduped), plus `ACCESS_FINE_LOCATION`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_STATE`, `ACCESS_NETWORK_STATE`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CONNECTED_DEVICE` (added by this plugin; not in `app.config.ts`).

Operator must additionally handle at runtime (not declarable in the manifest): the Android 12+ runtime prompts for `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT`/`BLUETOOTH_ADVERTISE` and `NEARBY_WIFI_DEVICES`, and the `ACCESS_FINE_LOCATION` runtime prompt on Android 11 and below where the BLE scanner and Wi-Fi Direct discovery require it. If the app opts into `neverForLocation` for `BLUETOOTH_SCAN` on 12+, confirm the scanner still surfaces Meerkat wake beacons on the device matrix.
