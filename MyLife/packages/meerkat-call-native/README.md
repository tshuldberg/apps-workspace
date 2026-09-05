# @mylife/meerkat-call-native

Owned Expo native module for Meerkat's operating-system call surfaces:

- iOS PushKit token registration and VoIP push receipt, plus CallKit incoming and outgoing call control.
- Android self-managed calls through AndroidX Core Telecom `CallsManager`.

This package owns no identity verification, media, signaling, membership, or call-state truth. Those remain in `@mylife/sync` and the app. Native displays use a generic localized Meerkat caller line. A server-supplied name is never rendered. `updateCall` accepts an optional caller line only through the explicitly named `locallyVerifiedCallerName` field, which the app may populate from locally verified pairing data.

## Honesty contract

The Swift and Kotlin bodies are real authored implementations. They are **UNVERIFIED** until a signed Expo dev build compiles them and the physical-device matrix proves them. Source authorship, TypeScript tests, plist entries, and manifest permissions are not device evidence.

When the native side is absent in Expo Go, plain Node, vitest, or an unlinked binary, `loadNativeCallModule()` returns `null`. `NativeCallClient.getCapability()` returns `{ platform: 'unknown', available: false, reason: 'native-module-absent' }`. Event subscriptions become inert removable subscriptions, and every command rejects with `NativeCallUnavailableError`. No call is reported as supported, ringing, answered, connected, muted, routed, or ended without a linked native module and a real native result.

The device matrix owns proof. Until it passes, product and release artifacts must describe this package as authored but unverified.

## Privacy boundary

- PushKit payload parsing consumes only a random call UUID and a video boolean.
- Malformed and duplicate VoIP pushes are still reported to CallKit before the PushKit completion handler runs, then immediately ended as failed.
- CallKit receives a generic localized caller line, never a server-supplied identity.
- Android Telecom receives a generic display name and a random local SIP-shaped address. Calls are excluded from the system call log where the platform supports that flag.
- No media bytes, SDP, ICE, device keys, peer names, community names, or signaling payloads belong in this package.

## Surface

| File | Role |
|---|---|
| `src/index.ts` | Import-safe typed bridge, nullable loader, events, commands, and honest capability facade. |
| `src/native-types.ts` | Raw Expo event and command contract implemented by Swift and Kotlin. |
| `src/loader.ts` | Single lazy `expo-modules-core` loader. It returns `null` on every absence. |
| `app.plugin.js` | Additive, idempotent iOS background modes and Android `MANAGE_OWN_CALLS`. |
| `ios/` | PushKit and CallKit module plus podspec. Authored, unverified. |
| `android/` | Core Telecom module, Gradle config, and library manifest. Authored, unverified. |

Native module names are `MeerkatCallKit` on iOS and `MeerkatTelecom` on Android.

## Native invariants

### iOS

- Every VoIP push calls `CXProvider.reportNewIncomingCall` before its PushKit completion handler runs.
- Malformed and duplicate call UUIDs use a fresh random surrogate UUID, are reported, and are then ended with `CXCallEndedReason.failed`.
- Active and recently ended UUID maps are bounded. End events are emitted exactly once.
- Answer, end, mute, hold, audio activation, audio deactivation, and provider reset map to typed JavaScript events.
- Screen sharing is a documented seam only. This packet intentionally creates no Broadcast Upload Extension or App Group.

### Android

- API levels below 26, invalid Telecom builds, missing `MANAGE_OWN_CALLS`, and OEM failures report `isSupported() = false` and reject commands with stable coded errors. They never crash the app.
- Incoming and outgoing calls use AndroidX Core Telecom `CallsManager` and a persistent app registration.
- Answer, disconnect, active, inactive, mute-flow, and audio-endpoint changes map to typed JavaScript events.
- Core Telecom exposes mute as a system-to-app flow but no calling-app mute setter. `setMuted` therefore rejects with `ERR_MUTE_CONTROL_SYSTEM_OWNED`; the app's media engine owns its own microphone mute. The module never fabricates success.
- The app owns the user-visible foreground service or call-style notification required while a media call is active. This module starts no service.

## Config plugin

`app.plugin.js` adds configuration without replacing host values:

- iOS `UIBackgroundModes`: `audio`, `voip`, and `remote-notification`.
- Android permission: `android.permission.MANAGE_OWN_CALLS`.

PushKit has no user-facing Info.plist usage-description key. APNs entitlement selection, the `.voip` topic, signing, and credentials belong to the host app and EAS credentials.

## Exact founder-ops remainder

1. Create and install a signed Expo dev build that runs `expo prebuild`, CocoaPods, and the Android Gradle build. Resolve any native compiler or linker diagnostics before treating the module as available.
2. Configure the Apple APNs auth key in the app or EAS credentials. The APNs auth key implicitly covers PushKit VoIP delivery, so no separate PushKit certificate is required for token-based APNs. Verify the signed app entitlement and the `<bundle-id>.voip` topic.
3. Run and capture the physical matrix: iOS foreground, background, terminated, locked, duplicate, malformed, busy, and competing-call paths; Android API and OEM coverage for incoming, outgoing, answer, disconnect, hold, Bluetooth, wired, speaker, earpiece, unsupported devices, and competing calls.

Only that dev-build and physical-device evidence can close WP-25F native verification.
