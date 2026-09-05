# Plan 42 - Meerkat Native Transport, Push Wake, and Background Execution

> Active production plan created 2026-07-09 from the adversarial launch audit.
> This plan closes the gap between TypeScript capability shells and transport or
> wake behavior that works on signed physical-device builds.

## Status

- **Active queue plan. CODEABLE SCOPE COMPLETE 2026-07-11 on `feature/meerkat-production-readiness-2026-07-09` (`635f4949`). Shipped: the push delivery gateway with dependency-free APNs/FCM/RFC-8291-web-push adapters and an AES-256-GCM keyring cipher (`2b0d9898`); the RN-safe push client on both sync barrels (`2740fb6a`); the owned `@mylife/meerkat-native-transport` package with honest null-on-absent bridges, loader owned-name-only cleanup, module-scope background task definitions, trigger coalescing, and registerPushWake wiring (`32a9fc28`); the authored Swift MultipeerConnectivity/CoreBluetooth and Kotlin Wi-Fi Direct/DNS-SD/BLE native sources, tracked for a dev build (`1ec2b5be`); web push with a structurally isolated closed-page limit (`56df52a9`); and transport diagnostics, six self-tested static NC gates in `check:parity`, the device-matrix runbook, and the honest AC/NC status ledger (`635f4949`). REMAINING is hardware-gated founder-ops: two signed dev builds transferring real bytes over native transports (AC-42.1/2), BLE wake proof (AC-42.3), background-drain and rotation/revoke device evidence (AC-42.7/9), and the full foreground/background/terminated/reboot/battery/offline/radio device matrix (AC-42.11), plus provisioning the APNs/FCM/VAPID credentials. See the status ledger `docs/plans/queue/42-status-ledger.md` for the definitive per-criterion mapping. Meerkat stays production NO-GO.**
- **Feeds:** Plan 25 calls and rooms, Plan 40 final launch, and Plan 43 hosted history.

### Execution contract (2026-07-11)

Grounded in the code map. Verification honesty rule: native Swift and
Kotlin sources are AUTHORED in-repo but cannot be compiled or
device-proven here; the runtime availability system already reports
their rungs unavailable until a dev build proves them, and no
authored-but-unproven path may ever set `isReal` or claim AC-42.1/2/3
evidence. Provider credentials, dev builds, and the physical device
matrix are founder-ops.

1. **WP-42A, push gateway and client (P4 + P3).** A new push-gateway
   service bin in meerkat-relay following every established service
   idiom (state-authority runtime selection over the Phase 1 push
   stores, health endpoints, private metrics, redaction, canary boot,
   compose entry with mounted secrets): the `/v1/push/*` HTTP surface
   from the plan, provider adapters behind one contract with
   dependency-free APNs HTTP/2, FCM v1 OAuth, and Web Push VAPID
   implementations (a dependency requires explicit justification),
   token encryption via PushTokenCipher, acceptance recorded never
   "delivered" (NC-42.4), no identity in any push record (NC-42.3),
   fake-provider adapters for hermetic tests plus env-gated sandbox
   tests. Client side: PushRelayClient stub replaced with the real
   gateway client in packages/sync, registration binding, capability
   minting and sharing, opaque wake payloads (AC-42.5).
2. **WP-42B, native module package and background lifecycle (P0 + P5).**
   An owned Expo config-plugin package exposing exactly the
   NativeNearbyModule, NativeNearbySession, NativeBleModule contracts
   the adapters already probe, with the TS bridge and plugin wiring;
   loader cleanup so only owned module names are probed (NC-42.2).
   Background: task definitions move to module scope before React
   mounts (NC-42.7), trigger coalescing to one drain (AC-42.8),
   registerPushWake implemented and wired into boot and sign-out with
   token rotation and revoke paths (AC-42.9 codeable surface).
3. **WP-42C, native transport authorship (P1 + P2).** Swift
   MultipeerConnectivity plus BLE wake peripheral/central and Kotlin
   Wi-Fi Direct plus DNS-SD plus BLE sources inside the owned package,
   matching the bridge contracts, wake-payload-only BLE (NC-42.6),
   prominently marked UNVERIFIED pending dev-build compilation and the
   device matrix. Authorship is not evidence and the docs say so.
4. **WP-42D, web push (P6).** Service worker, permission UX, VAPID
   subscription with rotation, click routing, closed-page honesty
   (AC-42.10), database mutation kept in the page client.
5. **WP-42E, hardening and gates (P7 codeable surface).** Diagnostics,
   parity gates, the device-matrix runbook updated to cover every
   AC/NC, and the honest status ledger of which criteria remain
   hardware-gated.

Order: WP-42A and WP-42B in parallel (disjoint files), then WP-42C and
WP-42D in parallel, then WP-42E. Every package lands only after
adversarial review and the full battery.
- **Depends on:** the shipped transport manager, Noise session, relay mailbox,
  background-sync core, and the PostgreSQL production substrate in Plan 44.
- **Launch rule:** Meerkat is not production-ready while Nearby, BLE wake, push
  wake, or scheduled background sync are represented by optional loaders, no-op
  clients, or bundle-only evidence.

## Current Code Grounding

The following code is real and must be reused:

- `packages/sync/src/transport/transport-manager.ts` owns ranked transport
  selection and honest availability.
- `apps/meerkat/app/(root)/data/webrtc-backend.ts` moves real data through the
  installed WebRTC native module.
- `apps/meerkat/app/(root)/data/nearby-backend.ts` and `ble-backend.ts` implement
  TypeScript adapters and test injection, but every production native module they
  attempt to load is absent.
- `packages/sync/src/protocol/push-relay-client.ts` is an explicit no-op stub.
- `apps/meerkat/app/(root)/data/background-sync.ts` contains the real bounded
  mailbox drain.
- `background-task-registration.ts` registers Expo scheduling, but defines the
  task inside `registerBackgroundSync`. Expo requires `TaskManager.defineTask` at
  global module scope because a headless launch mounts no React views.
- `registerPushWake` exists but is not part of the app boot lifecycle, and a
  foreground notification listener cannot prove background or terminated wake.
- No server registration API, APNs sender, FCM sender, token rotation path, or web
  push service worker exists.

## What Already Exists

| Existing capability | Decision |
|---|---|
| Ranked LAN, Nearby, BLE, WebRTC, relay ladder | Reuse without a second selector. |
| Noise handshake, SAS, frame envelope, replay guard | Reuse without changing cryptography. |
| Nearby and BLE TypeScript backend contracts | Keep the contracts and replace candidate package probing with one owned Expo module. |
| Background mailbox drain | Invoke from foreground, scheduled, and push triggers through one coordinator. |
| Relay mailbox and opaque token groups | Reuse for data. Push carries a wake hint only. |
| Expo Notifications and TaskManager dependencies | Keep, but correct lifecycle and add real registration and server delivery. |

## Binding Architecture Decisions

1. Build one owned Expo native module, `@mylife/meerkat-native-transport`, instead
   of relying on uninstalled third-party package names.
2. iOS Nearby uses MultipeerConnectivity. Android Nearby uses `WifiP2pManager`,
   with DNS-SD service discovery and a TCP byte stream after the group forms.
3. BLE remains wake-only. It advertises or notifies only the bounded wake payload;
   it never carries document, media, or file bytes.
4. General push uses native APNs and FCM tokens. Expo Push Service is not the
   production dependency.
5. A push registration is addressed by random capabilities, not device public
   keys. The push service never receives a Meerkat identity, community id, message
   id, caller name, or plaintext content.
6. The push gateway uses a store interface. File storage remains available for
   single-node self-hosting. First-party production uses the Plan 44 PostgreSQL
   adapter and KMS-backed token encryption.
7. Ordinary background sync is best-effort because iOS and Android schedule it.
   The UI never promises a cadence. Calls use the separate Plan 25 VoIP path.
8. Web Push can notify and wake an open client. A terminated service worker does
   not mutate the page's SQLite database. It shows an honest notification and
   drains after the user opens or an active client receives the wake.

Official capability anchors:

- Expo TaskManager requires global-scope task definition:
  <https://docs.expo.dev/versions/latest/sdk/task-manager/>
- Expo BackgroundTask is deferrable and OS-scheduled:
  <https://docs.expo.dev/versions/latest/sdk/background-task/>

## NOT in Scope

- Calls, CallKit, PushKit, Android Telecom, and in-call background survival are
  owned by Plan 25. Plan 42 provides the general push foundation they extend.
- Public archive scanning and always-on history are owned by Plan 43.
- Production database clustering, backup, and release provenance are owned by
  Plan 44.
- Replacing LAN, WebRTC data transport, Noise, SAS, or the ranked selector is not
  part of this plan because those implementations are already real.

## End-to-End Architecture

```text
Nearby data path

TransportManager
      |
      v
@mylife/meerkat-native-transport
      |                         |
      | iOS                     | Android
      v                         v
MultipeerConnectivity       Wi-Fi Direct + DNS-SD
      |                         |
      +----------- bytes -------+
                    |
                    v
          Noise session + frames
                    |
                    v
             existing sync engine

Wake path

Peer learns random wake capability through an encrypted paired session
                    |
                    v
POST /v1/push/wakes { capability, opaquePayload, urgency }
                    |
                    v
rate and size gate -> capability lookup -> APNs / FCM / Web Push
                    |
                    v
OS wake -> top-level task -> runBackgroundSyncOnce
                    |
                    v
notification only after real applied changes
```

## Native Module Contract

Create `packages/meerkat-native-transport/` as an Expo module with a TypeScript
surface and Swift/Kotlin implementations.

```ts
export interface NativeNearbyTransport {
  advertise(input: { serviceType: string; displayName: string }): Promise<void>;
  browse(input: { serviceType: string }): Promise<void>;
  connect(peerId: string): Promise<string>;
  send(sessionId: string, bytes: Uint8Array): Promise<void>;
  close(sessionId: string): Promise<void>;
  addListener(event: 'peerFound' | 'peerLost' | 'sessionOpened' | 'data' | 'sessionClosed', listener: (event: unknown) => void): Subscription;
}

export interface NativeBleWakeTransport {
  advertise(payload: Uint8Array): Promise<void>;
  scan(): Promise<void>;
  stop(): Promise<void>;
  addListener(event: 'wake', listener: (payload: Uint8Array) => void): Subscription;
}
```

Native invariants:

- Every session has a random local handle. OS peer identifiers never become a
  Meerkat identity.
- Maximum pending send bytes and session counts are clamped.
- Event listeners are removed on sign-out, module destroy, and hot reload.
- App background, radio-off, permission denial, and peer loss close the session
  exactly once.
- Native exceptions map to stable error codes. JavaScript never parses localized
  platform error strings.
- The module contains no cryptography and logs no peer display name or payload.

## Push Address and Server Model

Each install creates:

- `registrationId`: random 256-bit server lookup id.
- `registrationSecret`: random 256-bit update and delete secret, held in secure
  storage only.
- one or more `wakeCapability` values shared only through encrypted paired flows.
- native provider token and token generation, never written to SQLite in plaintext.

Server tables, implemented through file and PostgreSQL stores:

```sql
CREATE TABLE push_registrations (
  registration_id_hash bytea PRIMARY KEY,
  platform text NOT NULL CHECK (platform IN ('apns','fcm','webpush')),
  token_ciphertext bytea NOT NULL,
  token_key_version integer NOT NULL,
  token_generation integer NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE push_capabilities (
  capability_hash bytea PRIMARY KEY,
  registration_id_hash bytea NOT NULL REFERENCES push_registrations ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('sync_wake','call_wake')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE push_attempts (
  attempt_id uuid PRIMARY KEY,
  capability_hash bytea NOT NULL,
  provider text NOT NULL,
  provider_status text NOT NULL,
  provider_reference text,
  created_at timestamptz NOT NULL
);
```

`push_attempts` stores no provider token or payload. Retain bounded operational
records for delivery diagnostics, then delete them on a documented schedule.

## HTTP API

| Method and path | Purpose | Authentication |
|---|---|---|
| `POST /v1/push/registrations` | Create or rotate provider token | registration secret proof plus attested app request when available |
| `DELETE /v1/push/registrations/:id` | Revoke install and all capabilities | registration secret proof |
| `POST /v1/push/capabilities` | Mint or rotate a recipient-specific wake capability | registration secret proof |
| `DELETE /v1/push/capabilities/:hash` | Revoke a peer's wake permission | registration secret proof |
| `POST /v1/push/wakes` | Send bounded opaque wake payload | bearer wake capability, rate limited |
| `GET /v1/push/status/:attemptId` | Return provider acceptance only | wake capability proof |

The status API may say `provider_accepted`, `provider_rejected`, or `unknown`. It
must never say delivered because APNs and FCM acceptance does not prove app receipt.

## Background Execution State Machine

```text
disabled
   | user enables and permissions pass
   v
registered ---- boot verifies persistent registration ----+
   |                                                     |
   | scheduled event / foreground wake / push task       |
   v                                                     |
queued -> running -> applied_changes -> notify ----------+
            |              |
            |              +-> applied == 0 -> no notification
            v
      skipped_battery / retryable_error / terminal_config_error
```

Implementation requirements:

- Move `TaskManager.defineTask(BACKGROUND_SYNC_TASK, ...)` to module scope.
- Define the notification background task at module scope and register it with
  Expo Notifications.
- Import the task definition module from the app entry path before React mounts.
- App boot checks `isTaskRegisteredAsync`, setting, permission, and push token
  generation, then reconciles registration idempotently.
- Push token refresh rotates the server token before deleting the old generation.
- `runBackgroundSyncOnce` remains the only mailbox-drain coordinator.
- Concurrent foreground, scheduled, and push runs share a mutex and coalesce into
  one run, with one follow-up pass when new work arrived during execution.
- Respect the OS time budget and checkpoint each bounded drain page.
- Foreground status shows last attempted, last completed, applied count, and exact
  error. It never displays `always on`.

## Build Phases

### Phase 0 - Contract, package, and capability cleanup

- Create the Expo module and config plugin.
- Replace four speculative module names in Nearby and BLE loaders with the owned
  package.
- Add stable native error codes and capability probes.
- Add a reachability test that fails when a production loader can only return null.

### Phase 1 - iOS Nearby and BLE

- Implement MultipeerConnectivity advertise, browse, invite, accept, stream,
  backpressure, disconnect, and app lifecycle handling.
- Implement CoreBluetooth peripheral and central wake roles with service and
  characteristic UUIDs owned by Meerkat.
- Add local-network, Bonjour, and Bluetooth usage descriptions through the plugin.

### Phase 2 - Android Nearby and BLE

- Implement Wi-Fi Direct group discovery, DNS-SD metadata, connection, owner socket,
  client socket, byte framing, and teardown.
- Implement BLE advertiser, GATT server, scanner, and wake characteristic.
- Add Android 12+ Bluetooth and Android 13+ nearby Wi-Fi runtime permission flows.
- Add foreground-service usage only while a user-visible nearby transfer requires it.

### Phase 3 - Push protocol and client

- Replace `PushRelayClient` with injected HTTP I/O, timeouts, response validation,
  rotation, unregister, and stable errors.
- Add secure registration and wake-capability storage on mobile.
- Add encrypted sharing and revocation of wake capabilities through paired flows.

### Phase 4 - Push gateway

- Build registration, capability, wake, and status routes in `meerkat-relay`.
- Implement APNs HTTP/2 token auth, FCM HTTP v1, and Web Push VAPID adapters.
- Add token encryption, provider credential rotation, retry with jitter, provider
  invalid-token cleanup, request caps, and abuse controls.
- Add file-store conformance tests and Plan 44 PostgreSQL conformance tests.

### Phase 5 - Correct background lifecycle

- Move both task definitions to module scope.
- Wire task registration and `registerPushWake` into app boot and sign-out.
- Add execution coalescing, time-budget checkpoints, and token refresh handling.
- Schedule community snapshot rebuilds through the same bounded coordinator.

### Phase 6 - Web Push

- Add a service worker, permission UX, VAPID subscription rotation, click routing,
  and active-client wake messaging.
- Keep database mutation in the page client. Closed-page pushes show a notification
  and drain after open.

### Phase 7 - Hardening and release proof

- Add transport and push diagnostics with bounded, non-identifying metrics.
- Add physical-device matrices, OS-version coverage, radio failure tests, and
  background or terminated-state tests.
- Add parity checks that fail on no-op push code, speculative native requires, or
  `TaskManager.defineTask` inside a function.

## Failure Modes

| Failure | Handling | Test | User-visible result |
|---|---|---|---|
| Nearby peer disappears during send | close once, fail pending writes, selector tries next rung | native integration and device test | exact fallback or transfer failed copy |
| Permission revoked after prior success | capability probe returns unavailable | permission-revoke device test | permission action, never fake available |
| BLE payload is oversized or malformed | reject before event emission | codec fuzz test | silent wake drop, diagnostics count |
| Push token rotates while a wake is sent | generations overlap until new registration commits | server concurrency test | no false delivery claim |
| APNs or FCM rejects token | invalidate registration and surface re-register state | provider adapter test | background wake unavailable until repaired |
| Three triggers arrive together | coalesce to one drain plus bounded follow-up | fake-timer concurrency test | one accurate notification |
| iOS kills the app after force quit | no cadence promise | physical terminated-state test | last-run timestamp remains honest |
| Service worker has no active client | show notification only | browser E2E | opens app, then drains |
| Push capability is guessed or replayed | 256-bit token, rate gate, expiry, rotation | abuse integration test | request rejected without identity leak |

No listed failure may be silent in operational monitoring. User copy may remain
quiet for malformed hostile wakes, but a bounded rejection metric must exist.

## Test Review Diagram

```text
[native contract] -> [iOS Nearby] -> [Noise transfer] -> [fallback]
        |                  |               |                |
      unit              device E2E      existing E2E     device E2E

[secure token] -> [registration API] -> [APNs/FCM] -> [top-level task]
       |                 |                  |                |
     unit            integration        sandbox/mock      integration

[three triggers] -> [coordinator mutex] -> [bounded drain] -> [honest notify]
       |                    |                    |                 |
   concurrency          fake timers          live relay       UI/device
```

Required tests:

- Native unit tests for event mapping, lifecycle, framing, caps, and teardown.
- Two-device iOS and Android Nearby transfer tests with Noise on top.
- Cross-platform fallback test from unavailable Nearby to WebRTC, LAN, or relay.
- BLE wake tests proving no file bytes can cross the contract.
- Push client contract and fuzz tests for malformed responses.
- Push gateway integration tests with APNs and FCM local adapters plus sandbox
  credentials in protected CI.
- Background cold-launch test proving task definitions exist before registration.
- Trigger-coalescing tests with fake clocks and an in-flight drain.
- Browser tests for permission denied, subscription rotation, closed page, click,
  and active-client wake.
- Physical iOS and Android tests for foreground, background, force-quit, reboot,
  token rotation, low battery, radio off, and permission revocation.

## Performance and Capacity Requirements

- Native pending send queue: bounded by bytes and frames, with backpressure.
- Push payload: maximum 2 KiB after encoding.
- Push wake API: per-capability and per-IP limits, burst and sustained.
- Background drain: bounded by elapsed time, rows, and bytes.
- Native discovery must stop when the owning screen or automatic session closes.
- No unbounded listener, session, attempt, or token table.
- Load test at 10 times forecast wake volume and provider-error storms before launch.

## Parallel Work Lanes

| Lane | Modules | Depends on |
|---|---|---|
| A: native module | `packages/meerkat-native-transport`, mobile config | Phase 0 contract |
| B: push gateway | `packages/meerkat-relay` | push protocol and Plan 44 DB foundation |
| C: mobile background | `apps/meerkat` | push protocol; can mock gateway |
| D: web push | `apps/meerkat-web` | push protocol; can mock gateway |
| E: QA and parity | tests, scripts, tickets | merged A through D |

Launch A, B, C, and D in parallel after Phase 0. Lanes A and C both touch mobile
configuration, so one owner must coordinate `app.config.ts`. Merge all lanes before
Lane E. Use the repository file ownership zones if agents are used.

## Acceptance Criteria

- AC-42.1: Two signed iOS builds discover and transfer real encrypted bytes through
  MultipeerConnectivity.
- AC-42.2: Two signed Android builds discover and transfer real encrypted bytes
  through Wi-Fi Direct.
- AC-42.3: BLE wakes a peer and carries no document, media, or file bytes.
- AC-42.4: A missing native module reports unavailable and the selector falls back.
- AC-42.5: A paired peer can send an opaque push wake without exposing either
  device identity to the push gateway.
- AC-42.6: APNs and FCM provider acceptance is recorded without claiming delivery.
- AC-42.7: Scheduled and push tasks are defined before React mounts and execute the
  real bounded mailbox drain.
- AC-42.8: Concurrent triggers do not apply events or notifications twice.
- AC-42.9: Token rotation, revoke, reinstall, sign-out, and permission revoke work.
- AC-42.10: Web Push works in supported browsers and states its closed-page limit.
- AC-42.11: Physical device evidence covers foreground, background, terminated,
  reboot, low battery, offline, and radio-permission cases.

## Negative Criteria

- NC-42.1: No simulated backend may set `isReal=true`.
- NC-42.2: No speculative package require may remain in production loaders.
- NC-42.3: No push record may contain device pubkey, community id, message id,
  caller identity, or plaintext content.
- NC-42.4: No push provider acceptance may be labeled delivered.
- NC-42.5: No background interval or `always on` promise may be shown.
- NC-42.6: No BLE code path may accept arbitrary payload bytes.
- NC-42.7: No background task may be defined inside a React lifecycle or
  registration function.

## Required Gates

- Function test scaffolds and `pnpm gate:function:changed` for every logic change.
- Sync, Meerkat app, web, and relay test suites.
- Native iOS XCTest and Android instrumentation tests.
- Expo prebuild diff review and signed development builds.
- `pnpm check:meerkat-parity`, `pnpm check:generated-artifacts`, and
  `pnpm check:parity --quiet`.
- Browser QA and the full physical-device matrix.
- Security review of push token custody, capability rotation, and log output.

## Close Criteria

Plan 42 moves to `docs/plans/done/` only after all acceptance and negative criteria
pass, native packages are present in the lockfile and signed builds, the push gateway
runs through real APNs and FCM credentials, physical-device evidence is attached,
and Plan 40 links the exact commits, builds, and server release.
