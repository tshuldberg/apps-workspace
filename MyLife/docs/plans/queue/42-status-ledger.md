# Plan 42 status ledger — the honest close-out (WP-42E)

> Created 2026-07-11. This is the definitive "what remains" for Plan 42. It maps
> every acceptance criterion (AC-42.1..11) and negative criterion (NC-42.1..7) to
> one of three honest states, with the exact evidence for each. No AC is marked
> satisfied on code alone if it requires device proof.

## Status legend

- **CODE-COMPLETE** — the codeable surface is implemented and unit/contract-tested.
  For a hardware AC this means the software half is done; it does NOT mean the AC
  is satisfied (see the AC's HARDWARE-GATED remainder).
- **STATIC-GATE-ENFORCED** — a CI check fails if the invariant regresses. Proven by
  `pnpm check:meerkat-transport-nc` (self-tested: each gate catches a planted
  violation) plus its vitest twin `packages/meerkat-relay/src/__tests__/transport-nc-gate.test.ts`.
- **HARDWARE-GATED / FOUNDER-OPS** — cannot be closed without signed physical-device
  builds, real radios, live provider credentials, or OS scheduling. Evidence lands
  in the Plan 40 release ledger `docs/releases/meerkat/<release-id>/evidence.json`.
  The device steps are in `docs/guides/meerkat-native-transport-device-matrix.md`.

## What WP-42E added (this work package)

| Deliverable | Where |
|---|---|
| Transport + push diagnostics (pure) | `apps/meerkat/app/(root)/data/transport-diagnostics.ts` |
| Diagnostics runtime binder (real seams) | `apps/meerkat/app/(root)/data/transport-diagnostics-runtime.ts` |
| Diagnostics debug view (hidden route) | `apps/meerkat/app/(root)/(tabs)/transport-diagnostics.tsx` (+ `_layout.tsx` registration, Settings button) |
| Diagnostics honesty tests | `apps/meerkat/app/(root)/data/__tests__/transport-diagnostics.test.ts` (12 tests) |
| NC-42 static gate + self-test | `scripts/check-meerkat-transport-nc.mjs`; wired as `check:meerkat-transport-nc` into `check:parity` |
| NC gate suite coverage | `packages/meerkat-relay/src/__tests__/transport-nc-gate.test.ts` (3 tests) |
| Device-matrix runbook | `docs/guides/meerkat-native-transport-device-matrix.md` |
| This ledger | `docs/plans/queue/42-status-ledger.md` (+ `.html`) |

## Acceptance criteria

| AC | State | Evidence / where it lands |
|---|---|---|
| **AC-42.1** two signed iOS builds transfer real bytes over MultipeerConnectivity | CODE-COMPLETE (native authored, unproven) + HARDWARE-GATED | Swift `packages/meerkat-native-transport/ios/MeerkatNearbyModule.swift` + bridge `packages/meerkat-native-transport/src/index.ts`; adapter `apps/meerkat/app/(root)/data/nearby-backend.ts`. Native authored in commit `1ec2b5be`, package in `32a9fc28`. Byte-transfer proof: device-matrix AC-42.1 → Plan 40 evidence. |
| **AC-42.2** two signed Android builds transfer real bytes over Wi-Fi Direct | CODE-COMPLETE (native authored, unproven) + HARDWARE-GATED | Kotlin `packages/meerkat-native-transport/android/.../MeerkatNearbyModule.kt` + same bridge/adapter. Proof: device-matrix AC-42.2 → Plan 40 evidence. |
| **AC-42.3** BLE wakes a peer and carries no data bytes | CODE-COMPLETE + STATIC-GATE-ENFORCED (NC-42.6) + HARDWARE-GATED | Wake codec `apps/meerkat/app/(root)/data/ble-backend.ts` (three-field only); Swift/Kotlin `MeerkatBleWakeModule.*`. Wake-on-hardware + no-data proof: device-matrix AC-42.3 → Plan 40 evidence. |
| **AC-42.4** missing native module reports unavailable and the selector falls back | CODE-COMPLETE | Selector fallback `packages/sync/src/transport/transport-manager.ts` (`selectDialableTransportLayers`, `getAvailableDataLayers`); availability `apps/meerkat/app/(root)/data/transport-backends.ts`; surfaced in the diagnostics screen. Unit-proven; the device no-crash-fallback is device-matrix AC-42.4. |
| **AC-42.5** paired peer sends an opaque push wake without exposing device identity | CODE-COMPLETE + STATIC-GATE-ENFORCED (NC-42.3) + HARDWARE-GATED (live provider) | Client `packages/sync/src/protocol/push-relay-client.ts` (capability-addressed); registration `apps/meerkat/app/(root)/data/push-wake-boot.ts` (random handle); gateway records hashes only `packages/meerkat-relay/src/push-store.ts`. Commits `2740fb6a`, `2b0d9898`. Live wake proof: device-matrix AC-42.5 → Plan 40. |
| **AC-42.6** provider acceptance recorded without claiming delivery | CODE-COMPLETE + STATIC-GATE-ENFORCED (NC-42.4) | Status model `push-relay-client.ts` (`provider_accepted`/`provider_rejected`/`unknown`); gateway `packages/meerkat-relay/src/push-gateway.ts` / `push-gateway-http.ts`. Live provider confirmation is device-matrix AC-42.6. |
| **AC-42.7** scheduled + push tasks defined before React mounts; real drain | CODE-COMPLETE + STATIC-GATE-ENFORCED (NC-42.7) + HARDWARE-GATED (headless run) | Module-scope defs `apps/meerkat/app/(root)/data/background-task-definitions.ts`; imported from the app entry before React. Commit `32a9fc28`. Headless-drain proof (force-quit, OS-timed): device-matrix AC-42.7 → Plan 40. |
| **AC-42.8** concurrent triggers do not apply events or notifications twice | CODE-COMPLETE | Coalescer `apps/meerkat/app/(root)/data/background-coalescer.ts` + `background-coalescer.test.ts`. Device confirmation is device-matrix AC-42.8. |
| **AC-42.9** rotation, revoke, reinstall, sign-out, permission revoke | CODE-COMPLETE + HARDWARE-GATED | Rotation/revoke `push-wake-core.ts` + `push-wake-boot.ts` + `push-relay-client.ts` (`rotateToken`, `unregister`, `revokeCapability`); handle re-mint on reinstall. Each sub-case device-proven: device-matrix AC-42.9 → Plan 40. |
| **AC-42.10** Web Push works in supported browsers; states its closed-page limit | CODE-COMPLETE + HARDWARE-GATED (browser) | Service worker `apps/meerkat-web/public/sw.js`; core `apps/meerkat-web/src/lib/web-push-core.ts`; registration `web-push-registration.ts`. Commit `56df52a9`. Closed-page behavior in a real browser: device-matrix AC-42.10. |
| **AC-42.11** physical device state matrix (fg/bg/terminated/reboot/battery/offline/radio) | HARDWARE-GATED | The full matrix is device-matrix AC-42.11 → Plan 40 evidence. No code can substitute for it. |

## Negative criteria

| NC | State | Enforcement |
|---|---|---|
| **NC-42.1** no simulated backend sets `isReal=true` | STATIC-GATE-ENFORCED | `check-meerkat-transport-nc.mjs` gate NC-42.1 scans the `Simulated*` backends in `packages/sync/src/transport/*.ts`. Self-test plants an `isReal = true` and confirms the catch. |
| **NC-42.2** no speculative package require in production loaders | STATIC-GATE-ENFORCED | Gate NC-42.2 scans `nearby-backend.ts` / `ble-backend.ts` for a direct `require('react-native-*')` or `requireNativeModule(`; both now probe only the owned `@mylife/meerkat-native-transport`. |
| **NC-42.3** no push record carries pubkey/community id/message id/identity/plaintext | STATIC-GATE-ENFORCED | Gate NC-42.3 scans `push-store.ts`, `push-gateway*.ts`, `push-relay-client.ts` for forbidden field-name keys; addresses/secrets are `*Hash` only, payloads opaque. |
| **NC-42.4** no push acceptance labeled delivered | STATIC-GATE-ENFORCED | Gate NC-42.4 forbids a `'delivered'` status literal in the push files (comments stripped before scan). |
| **NC-42.5** no background interval or "always on" promise shown | CODE-COMPLETE (honesty by construction) | The background status UI shows last attempted/completed/applied/error only (`apps/meerkat/app/(root)/(tabs)/settings.tsx`, `capability-status.ts` "scheduled background runs need a dev build"). No timer/cadence copy. Not a single static token, so it is not one of the token gates; enforced by the honest surfaces + the meerkat-parity copy locks. |
| **NC-42.6** no BLE code path accepts arbitrary payload bytes | STATIC-GATE-ENFORCED | Gate NC-42.6 asserts `decodeBleWakePayload` reconstructs only the three wake fields and never spreads the raw parsed object. |
| **NC-42.7** no background task defined inside a React/registration function | STATIC-GATE-ENFORCED | Gate NC-42.7 forbids `defineTask(` in `background-task-registration.ts` and in any `(tabs)`/`providers` React file; definitions live at module scope in `background-task-definitions.ts`. |

## The exact founder-ops / hardware-gated remainder

Everything below is what Plan 42 still needs and CANNOT be closed in code:

1. **Signed dev/EAS builds** (two iOS, two Android, three for convergence) linking
   the owned native module, LAN/WebRTC modules, and the background/notifications
   modules. These compile the authored Swift/Kotlin; until they exist the native
   rungs honestly read `Unavailable`.
2. **Live push provider credentials**: APNs auth key + FCM service account + Web
   Push VAPID keys, mounted into a deployed push gateway
   (`docs/guides/deploy-the-meerkat-push-gateway.md`). Without them the push
   channels read `not_configured` / `no_native_token`.
3. **The physical device matrix** in `docs/guides/meerkat-native-transport-device-matrix.md`:
   AC-42.1, AC-42.2, AC-42.3, AC-42.5, AC-42.6, AC-42.7 (headless), AC-42.9, AC-42.10
   (closed-page), and the full AC-42.11 state matrix. Each records device models, OS
   versions, networks, timestamps, session-row byte counts, and gateway attempt ids.
4. **Landing the evidence** in the Plan 40 release ledger
   `docs/releases/meerkat/<release-id>/evidence.json` (+ HTML twin), which then links
   the exact commits, signed builds, and the running push gateway.

Plan 42 moves to `docs/plans/done/` ONLY after items 1–4 are complete. The codeable
scope (WP-42A through WP-42E) is done: the diagnostics surface, the NC static gates,
the device-matrix runbook, and this ledger close WP-42E and the codeable half of
Plan 42.
